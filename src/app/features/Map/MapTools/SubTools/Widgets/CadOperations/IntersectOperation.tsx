"use client";

import { Button, Group, Stack, Text } from "@makkah-municipality-gis/ui";
import type UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import { useEffect, useState, useSyncExternalStore } from "react";
import { HiOutlineDocumentArrowDown } from "react-icons/hi2";
import { activeRequestStore } from "@/lib/activeRequest/store";
import { intersectSplitRenderer } from "@/app/features/Map/regulationStyles";
import { refreshRequestResultLayers } from "@/app/features/Map/requestResultLayers";
import { attachRequestReport, saveRequestIntersect } from "../CadUploadTool/requestCad";
import type { CadDrawing } from "../CadUploadTool/store";
import styles from "./CadOperations.module.scss";
import { COPY } from "./constants";
import { useOperationLayer } from "./useOperationLayer";
import { collectPolygonRings, loadReportAerials, type ReportAerials } from "./aerialUnderlay";
import { buildIntersectSplitCollection } from "./intersect";
import IntersectReport, { exportIntersectReportPdf } from "./IntersectReport";
import ReportFormModal from "./ReportFormModal";
import { EMPTY_REPORT_FORM, type ReportFormValues } from "./reportForm";
import { siteLocationOf, siteQrDataUrl } from "./siteQrCode";
import { projectPolygonToUtmRings, UTM_37N_WKID } from "./projectToUtm";
import { buildReportGeometry, type ReportGeometry } from "./reportGeometry";
import { indexSourceVertices, snapRingsToSourceVertices } from "./sourceSnap";
import { conflictsWithRegulation, toContextRows } from "./selectors";
import { querySpatialContext, type SpatialContext } from "./spatialContext";

/** The split's colours and its heavy 2px borders live in the shared style module, so this
 *  transient layer is indistinguishable from the stored server layers the request shows
 *  after a reload. See features/Map/regulationStyles.ts. */
function buildRenderer(): UniqueValueRenderer {
  return intersectSplitRenderer({
    inside: COPY.intersect.legendInside,
    outside: COPY.intersect.legendOutside,
  });
}

const CONTEXT = COPY.intersect.context;
const REPORT_ATTACH = CONTEXT.report.attach;

/** Layer 1's MUNICIPALITY / DISTRICT / LAND_USE are String(255). Joins the matched names
 *  for storage, or returns undefined so an empty result is stored as NULL rather than as
 *  the UI's "غير متوفر" placeholder text. */
function joinNames(matches: Array<{ name: string }>): string | undefined {
  if (matches.length === 0) return undefined;
  return matches.map((m) => m.name).join(" · ").slice(0, 255);
}

/** Presentation only — the rows come from `toContextRows`, the same selector the
 *  printable sheet uses, so the panel and the PDF can never disagree. */
function SpatialContextReadout({
  context,
  regulationConflict,
}: {
  context: SpatialContext;
  regulationConflict: boolean;
}) {
  return (
    <div className={styles.context}>
      <Text size="xs" fw={600}>
        {CONTEXT.title}
      </Text>

      <dl className={styles.contextList}>
        {toContextRows(context, regulationConflict).map((row) => (
          <div key={row.label} className={styles.contextRow}>
            <dt className={styles.contextLabel}>{row.label}</dt>
            <dd className={styles.contextValue}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {context.failed.length > 0 && (
        <div className={styles.error}>{`${CONTEXT.failedPrefix} ${context.failed.join("، ")}`}</div>
      )}
    </div>
  );
}

export default function IntersectOperation({ drawing }: { drawing: CadDrawing }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<SpatialContext | null>(null);
  const [contextBusy, setContextBusy] = useState(false);
  const [contextAt, setContextAt] = useState<Date | null>(null);
  /** التعارض مع خط التنظيم — from the intersect split, so it needs no spatial query. */
  const [regulationConflict, setRegulationConflict] = useState(false);
  /**
   * The moment the PDF is produced — what "تاريخ الإصدار" on the sheet means.
   *
   * Not `contextAt`: that is when the intersect was run, which can be a long while before
   * anyone exports (the panel stays open, the form gets filled in). A report issued today
   * should not be dated to whenever the analysis happened to be computed.
   */
  const [exportedAt, setExportedAt] = useState<Date | null>(null);
  /** PNG data URL of the QR code pointing at the site on Google Maps. */
  const [siteQr, setSiteQr] = useState<string | null>(null);
  const [reportGeometry, setReportGeometry] = useState<ReportGeometry | null>(null);
  const [aerial, setAerial] = useState<ReportAerials | null>(null);
  const [exporting, setExporting] = useState(false);
  /** The pre-export form: its open state, and the values kept between exports. */
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<ReportFormValues>(EMPTY_REPORT_FORM);
  /** Set once the form is submitted; the effect below exports after the sheet re-renders.
   *  Carries the request that was open AT SUBMIT, so the PDF is stored on that request even
   *  if another one is opened while the export runs. `null` → no export pending. */
  const [exportRequest, setExportRequest] = useState<{ requestId: number | null } | null>(
    null,
  );
  /** Storing the exported PDF as an attachment on the request. `file` is kept on failure so
   *  the retry re-sends the very same document rather than re-exporting a new one. */
  const [reportAttachment, setReportAttachment] = useState<
    | { status: "saving" | "saved"; requestId: number }
    | { status: "failed"; requestId: number; file: File }
    | null
  >(null);

  const activeRequest = useSyncExternalStore(
    activeRequestStore.subscribe,
    activeRequestStore.getSnapshot,
    activeRequestStore.getServerSnapshot,
  );

  const { applyLayer, removeLayer, hasOutput } = useOperationLayer("intersect", drawing.drawId);

  const handleApply = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    setContext(null);
    setContextAt(null);
    setReportGeometry(null);
    setSiteQr(null);
    setAerial(null);

    try {
      const result = await buildIntersectSplitCollection(drawing.geoJSON);
      if (!result) throw new Error(COPY.intersect.failed);

      await applyLayer(result.collection, buildRenderer());
      setRegulationConflict(conflictsWithRegulation(result.zones));

      if (!result.zones.includes("inside")) {
        setMessage(COPY.intersect.doneNoOverlap);
      } else if (!result.zones.includes("outside")) {
        setMessage(COPY.intersect.doneFullyInside);
      } else {
        setMessage(COPY.intersect.done);
      }

      // The read-out runs on `insideGeometry` — the exact CAD ∩ regulation polygon —
      // and only when there IS one: an all-outside result has no regulated part to
      // describe, and falling back to the drawing would answer a different question.
      // Its own try/catch, so a failed read-out never rolls back the map layer the
      // user just got.
      if (result.insideGeometry) {
        setContextBusy(true);
        try {
          const insideGeometry = result.insideGeometry;

          // The read-out and the report's geometry are independent, so run them together.
          // The projection has its own catch: if it fails the read-out still shows and the
          // PDF simply leaves the sketch and coordinate tables blank.
          // Project into the CAD FILE's own CRS, not a fixed one, so the rings come back
          // in the same coordinate system as the file's easting/northing below.
          const sourceWkid = drawing.source?.wkid ?? UTM_37N_WKID;

          const [spatialContext, utmRings, outsideUtmRings, plotUtmRings] = await Promise.all([
            querySpatialContext(insideGeometry),
            projectPolygonToUtmRings(insideGeometry, sourceWkid).catch((projectionError) => {
              console.error("[CAD ops] UTM projection for the report failed:", projectionError);
              return null;
            }),
            // The outside half is needed for the "خارج الموقع" layer only, so a failure
            // here degrades the stored result, never the read-out or the report.
            result.outsideGeometry
              ? projectPolygonToUtmRings(result.outsideGeometry, sourceWkid).catch(
                  (projectionError) => {
                    console.error(
                      "[CAD ops] UTM projection of the outside part failed:",
                      projectionError,
                    );
                    return null;
                  },
                )
              : Promise.resolve(null),
            // The whole drawing, for the plot's TOTAL boundary lengths on the report.
            projectPolygonToUtmRings(result.drawingGeometry, sourceWkid).catch(
              (projectionError) => {
                console.error("[CAD ops] UTM projection of the drawing failed:", projectionError);
                return null;
              },
            ),
          ]);

          setContext(spatialContext);

          // Put the file's OWN digits back on every vertex that came from the file, so the
          // report's شرقيات/شماليات match the "قراءة الملف" table exactly instead of being
          // a re-derivation of them via WGS84. Vertices the clip created keep their
          // projected value — they exist in no file. See sourceSnap.ts.
          if (utmRings) {
            const sourceIndex = drawing.source
              ? indexSourceVertices(drawing.source.geoJSON)
              : null;
            const snapped = snapRingsToSourceVertices(utmRings, sourceIndex);

            // The outside half is snapped with the SAME index so both halves carry the
            // file's own coordinates and line up exactly along the regulation line.
            const snappedOutside = outsideUtmRings
              ? snapRingsToSourceVertices(outsideUtmRings, sourceIndex).rings
              : [];

            const snappedPlot = plotUtmRings
              ? snapRingsToSourceVertices(plotUtmRings, sourceIndex)
              : null;

            // One exact-key set for both coordinate tables (after alignment + whole drawing).
            const exactKeys = new Set([...snapped.exact, ...(snappedPlot?.exact ?? [])]);

            setReportGeometry(
              buildReportGeometry(
                snapped.rings,
                exactKeys,
                snappedOutside,
                snappedPlot?.rings ?? [],
              ),
            );
          } else {
            setReportGeometry(null);
          }

          // The site's QR: built from the DRAWING's centroid, so it points at the property
          // rather than wherever the map happens to be centred. Its own catch — an export
          // must not fail because a QR could not be encoded.
          const location = siteLocationOf(result.drawingGeometry);
          setSiteQr(location ? await siteQrDataUrl(location) : null);

          setContextAt(new Date());

          // Persist the split against the open request: inside → layer 1 (with the
          // read-out on the row), outside → layer 0. This is what makes the coloured
          // result survive a reload — the transient layer above does not.
          // Its own try/catch: a storage failure must not discard the result on screen.
          if (activeRequest && utmRings) {
            try {
              await saveRequestIntersect(
                activeRequest.id,
                [utmRings],
                outsideUtmRings ? [outsideUtmRings] : [],
                {
                  municipality: joinNames(spatialContext.municipalities),
                  district: joinNames(spatialContext.neighborhoods),
                  landUse: joinNames(spatialContext.landUses),
                  intersectsUrbanBoundary: spatialContext.failed.includes(CONTEXT.urban)
                    ? undefined
                    : spatialContext.intersectsUrbanBoundary,
                  intersectsHaram: spatialContext.failed.includes(CONTEXT.haram)
                    ? undefined
                    : spatialContext.intersectsHaram,
                },
              );

              // The layers are already on the map (added when the request was opened) but
              // hold pre-save features, so they have to re-read the service.
              await refreshRequestResultLayers(activeRequest.id);
            } catch (saveError) {
              console.error("[CAD ops] failed to store the intersect result:", saveError);
            }
          }

          // The photos for the report's two "مصور جوي" boxes: the Oct-2019 and the 2024
          // imagery, each with the CAD polygon on top. Awaited while `contextBusy` is
          // still on, so the export button cannot be pressed before they are in. Its own
          // try/catch, and each photo fails on its own: if an imagery service is down the
          // report still exports, with that box left blank as before.
          // Needs the file's own coordinates — the imagery is WKID 32637, the same CRS.
          try {
            if (drawing.source && drawing.source.wkid === UTM_37N_WKID) {
              const rings = collectPolygonRings(drawing.source.geoJSON);
              setAerial(await loadReportAerials(rings));
            }
          } catch (aerialError) {
            console.warn("[CAD ops] aerial photos for the report failed:", aerialError);
            setAerial(null);
          }
        } catch (contextError) {
          console.error("[CAD ops] spatial context failed:", contextError);
        } finally {
          setContextBusy(false);
        }
      }
    } catch (err) {
      console.error("[CAD ops] intersect failed:", err);
      setError(err instanceof Error ? err.message : COPY.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const handleFormSubmit = (values: ReportFormValues) => {
    setFormValues(values);
    // Stamped here, in the same commit as the form values, so the two-frame wait before the
    // snapshot covers this too and the sheet is rasterised carrying today's date.
    setExportedAt(new Date());
    setExportRequest({ requestId: activeRequest?.id ?? null });
  };

  /**
   * Stores the exported PDF on the request as an attachment. Runs AFTER the download, so
   * the user has their copy whatever happens here; a failure is reported with a retry
   * rather than failing the export that already succeeded.
   */
  const storeReportOnRequest = async (requestId: number, file: File) => {
    setReportAttachment({ status: "saving", requestId });
    try {
      await attachRequestReport(requestId, file);
      setReportAttachment({ status: "saved", requestId });
    } catch (attachError) {
      console.error("[CAD ops] failed to store the report on the request:", attachError);
      setReportAttachment({ status: "failed", requestId, file });
    }
  };

  /**
   * Export AFTER the sheet has re-rendered with the submitted values.
   *
   * The export rasterises the off-screen sheet, so calling it straight from the submit
   * handler would snapshot the DOM as it was BEFORE React applied the new values — the PDF
   * would come out with the fields still blank. Waiting two animation frames guarantees the
   * commit and the paint have both happened.
   */
  useEffect(() => {
    if (!exportRequest) return;

    let cancelled = false;
    setExporting(true);

    void (async () => {
      try {
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        if (cancelled) return;

        const pdf = await exportIntersectReportPdf(drawing.fileName);
        if (cancelled) return;
        setFormOpen(false);

        // Outside a request (the map used as a plain viewer) there is nothing to attach
        // the report to — the download is the whole export.
        if (exportRequest.requestId !== null) {
          void storeReportOnRequest(exportRequest.requestId, pdf);
        }
      } catch (err) {
        console.error("[CAD ops] PDF export failed:", err);
        if (!cancelled) setError(COPY.errors.generic);
      } finally {
        if (!cancelled) {
          setExporting(false);
          setExportRequest(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // storeReportOnRequest only calls state setters, so it is stable in effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportRequest, drawing.fileName]);

  const handleRemove = () => {
    removeLayer();
    setMessage("");
    setError("");
    setContext(null);
    setContextAt(null);
    setReportGeometry(null);
    setSiteQr(null);
    setAerial(null);
  };

  return (
    <Stack gap={10}>
      <Text size="xs" c="dimmed">
        {COPY.intersect.summary}
      </Text>

      {message && <div className={styles.message}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      {reportAttachment?.status === "saving" && (
        <Text size="xs" c="dimmed">
          {REPORT_ATTACH.saving(reportAttachment.requestId)}
        </Text>
      )}
      {reportAttachment?.status === "saved" && (
        <div className={styles.message}>{REPORT_ATTACH.saved(reportAttachment.requestId)}</div>
      )}
      {reportAttachment?.status === "failed" && (
        <div className={styles.error}>
          {REPORT_ATTACH.failed(reportAttachment.requestId)}{" "}
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={() =>
              void storeReportOnRequest(reportAttachment.requestId, reportAttachment.file)
            }
          >
            {REPORT_ATTACH.retry}
          </Button>
        </div>
      )}

      {contextBusy && (
        <Text size="xs" c="dimmed">
          {CONTEXT.loading}
        </Text>
      )}
      {context && (
        <SpatialContextReadout context={context} regulationConflict={regulationConflict} />
      )}

      {/* Rendered (off-screen) only while there IS a read-out, so the export can never
          produce a PDF for a stale or missing result. */}
      {context && contextAt && (
        <IntersectReport
          fileName={drawing.fileName}
          context={context}
          regulationConflict={regulationConflict}
          geometry={reportGeometry}
          form={formValues}
          siteQr={siteQr}
          generatedAt={exportedAt ?? contextAt}
          aerial={aerial}
        />
      )}

      <ReportFormModal
        opened={formOpen}
        initialValues={formValues}
        geometry={reportGeometry}
        exporting={exporting}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <Group gap={8} wrap="nowrap" className={styles.operationActions}>
        {context && (
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<HiOutlineDocumentArrowDown size={14} />}
            aria-label={CONTEXT.report.exportAria}
            onClick={() => setFormOpen(true)}
            loading={exporting}
            disabled={busy || contextBusy}
          >
            {CONTEXT.report.exportPdf}
          </Button>
        )}
        {hasOutput && (
          <Button variant="default" size="compact-sm" onClick={handleRemove} disabled={busy}>
            {COPY.remove}
          </Button>
        )}
        <Button size="compact-sm" onClick={handleApply} loading={busy}>
          {busy ? COPY.applying : COPY.apply}
        </Button>
      </Group>
    </Stack>
  );
}