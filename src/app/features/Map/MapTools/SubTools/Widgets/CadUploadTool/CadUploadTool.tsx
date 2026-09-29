"use client";

import {
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Text,
} from "@makkah-municipality-gis/ui";
import { useRef, useState, useSyncExternalStore } from "react";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import { activeRequestStore } from "@/lib/activeRequest/store";
import { resolveToken } from "@/lib/designTokens";
import { WIDGET_PANEL_MAX_WIDTH } from "../constants";
import {
  CAD_FILL_COLOR_TOKEN,
  CAD_LINE_COLOR_TOKEN,
  COORDINATE_SYSTEMS,
  COORDINATE_SYSTEM_WKIDS,
  COPY,
  DEFAULT_LINE_WIDTH,
  FILL_PATTERN_OPTIONS,
  LINE_STYLE_OPTIONS,
} from "./constants";
import { formatCoordinate } from "../CadOperations/selectors";
import { drawCadOnMap, removeCadLayer } from "./drawCad";
import {
  extractCoordinateRows,
  featureSetToGeoJSON,
  type GeoJSONFeatureCollection,
} from "./geometry";
import {
  deleteRequestCad,
  deleteRequestIntersect,
  requestCadLayerTitle,
  saveRequestCad,
} from "./requestCad";
import styles from "./CadUploadTool.module.scss";
import {
  CadPanelStatus,
  CoordinateRow,
  FillPatternValue,
  LineStyleValue,
} from "./types";

export default function CadUploadTool({ onClose }: { onClose?: () => void }) {
  void onClose; // panel chrome owns the close button; kept for the ToolPanelHost contract

  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<CadPanelStatus>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coordinateSystem, setCoordinateSystem] = useState<string>(
    COORDINATE_SYSTEMS[0].value,
  );

  const [rows, setRows] = useState<CoordinateRow[]>([]);
  const [geoJSON, setGeoJSON] = useState<GeoJSONFeatureCollection | null>(null);

  const [lineWidth, setLineWidth] = useState(DEFAULT_LINE_WIDTH);
  const [lineStyle, setLineStyle] = useState<LineStyleValue>("dash");
  const [fillPattern, setFillPattern] = useState<FillPatternValue>("transparent");
  const [lineColor, setLineColor] = useState(() =>
    resolveToken(CAD_LINE_COLOR_TOKEN, "#0B5FFF"),
  );
  const [fillColor, setFillColor] = useState(() =>
    resolveToken(CAD_FILL_COLOR_TOKEN, "#F59E0B"),
  );

  // تأكيد المسح + الطبقة الحالية
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<GeoJSONLayer | null>(null);

  const activeRequest = useSyncExternalStore(
    activeRequestStore.subscribe,
    activeRequestStore.getSnapshot,
    activeRequestStore.getServerSnapshot,
  );

  const hasRows = rows.length > 0;

  const handleChooseFile = () => inputRef.current?.click();

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".dwg") && !fileName.endsWith(".dxf")) {
      setError(COPY.errors.extension);
      setStatus("error");
      return;
    }

    setSelectedFile(file);
    setRows([]);
    setGeoJSON(null);
    setError("");
    setMessage("");
    setStatus("idle");
  };

  // بيتنفذ بس لما المستخدم يأكد من الـ Modal
  const handleClearFile = () => {
    // امسح الرسمة من الخريطة + بلّغ لوحة العمليات إن مفيش رسمة
    // (هي بتمسح طبقاتها المشتقة — النطاق والتقاطع مثلًا)
    removeCadLayer(currentLayer);
    setCurrentLayer(null);

    // Clearing the CAD while a request is open also drops the parcel stored against that
    // request — otherwise reopening it would bring back the drawing just removed.
    // Fire-and-forget: the map is already clear, and a failed delete must not block the UI.
    if (activeRequest) {
      // The stored داخل/خارج split is derived from this parcel, so it goes with it —
      // otherwise the request would keep a coloured result for a CAD that no longer exists.
      void Promise.all([
        deleteRequestCad(activeRequest.id),
        deleteRequestIntersect(activeRequest.id),
      ]).catch((deleteError) => {
        console.error("[CAD] failed to delete the stored parcel/result:", deleteError);
      });
    }

    setSelectedFile(null);
    setRows([]);
    setGeoJSON(null);
    setError("");
    setMessage("");
    setStatus("idle");
    setConfirmOpen(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleReadFile = async () => {
    if (!selectedFile) return;

    setStatus("reading");
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/cad/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("CAD API full error:", result);

        const gpMessages: Array<{ type?: string; description?: string }> =
          Array.isArray(result.gpMessages) ? result.gpMessages : [];

        throw new Error(
          [
            result.error,
            // The actual "why" from ArcGIS — an unsupported entity type, a
            // frozen/off layer, a missing spatial reference — lives here, not
            // in `details` (which is just the raw, mostly-uninformative
            // GeoJSON_Result param object).
            gpMessages.length > 0
              ? gpMessages
                  .map((m) => m.description)
                  .filter(Boolean)
                  .join("\n")
              : "",
            result.details
              ? typeof result.details === "string"
                ? result.details
                : JSON.stringify(result.details, null, 2)
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      if (!result.geojson) {
        throw new Error(COPY.errors.noData);
      }

      const featureSet =
        typeof result.geojson === "string"
          ? JSON.parse(result.geojson)
          : result.geojson;
      const converted = featureSetToGeoJSON(featureSet);

      if (converted.features.length === 0) {
        throw new Error(COPY.errors.empty);
      }

      setGeoJSON(converted);
      setRows(extractCoordinateRows(converted));
      setStatus("read");
    } catch (err) {
      console.error("CAD read error:", err);
      setError(err instanceof Error ? err.message : COPY.errors.generic);
      setStatus("error");
    }
  };

  const handleDraw = async () => {
    if (!geoJSON || !selectedFile) return;

    setStatus("drawing");
    setError("");
    setMessage("");

    try {
      const sourceWkid = COORDINATE_SYSTEM_WKIDS[coordinateSystem];

      const { layer } = await drawCadOnMap({
        title: selectedFile.name,
        sourceCollection: geoJSON,
        sourceWkid,
        options: { lineColor, fillColor, lineWidth, lineStyle, fillPattern },
        // Drop the parcel auto-loaded for this request: the upload replaces it.
        replaceTitles: activeRequest ? [requestCadLayerTitle(activeRequest.id)] : undefined,
      });

      setCurrentLayer(layer); // احفظ الطبقة عشان نقدر نمسحها

      let savedNote = "";

      // A CAD drawn while a request is open belongs to THAT request: it is written to the
      // transactions parcel layer keyed by TRANSACTION_ID, replacing whatever was stored
      // for it before. With no request open the CAD is only drawn, exactly as before.
      if (activeRequest) {
        if (!sourceWkid) {
          throw new Error("تعذّر حفظ ملف الكاد للطلب: نظام إحداثيات الملف غير محدد.");
        }

        const saveResult = await saveRequestCad(activeRequest.id, geoJSON, sourceWkid);

        savedNote = ` وتم ربطه بالطلب رقم ${activeRequest.id}.`;

        if (saveResult.skippedNonPolygon > 0) {
          savedNote += ` (لم يتم حفظ ${saveResult.skippedNonPolygon} عنصرًا غير مضلع.)`;
        }
      }

      setMessage(`تمت إضافة ${selectedFile.name} إلى الخريطة بنجاح.${savedNote}`);
      setStatus("read");
    } catch (err) {
      console.error("CAD draw error:", err);
      setError(err instanceof Error ? err.message : COPY.errors.generic);
      setStatus("error");
    }
  };

  return (
    <>
      <Card
        w={440}
        maw={WIDGET_PANEL_MAX_WIDTH}
        p="md"
        radius="md"
        withBorder
        shadow="sm"
      >
        <Stack gap="sm">
          <Text fw={600} size="sm">
            {COPY.title}
          </Text>

          <Stack gap="xs" data-no-drag>
            <input
              ref={inputRef}
              type="file"
              accept=".dwg,.dxf"
              onChange={handleFileSelected}
              className={styles.hiddenInput}
            />

            <Text size="xs" fw={600} className={styles.sectionHeading}>
              {COPY.chooseFileHeading}
            </Text>

            <Group gap={8} wrap="nowrap" className={styles.fileRow}>
              <Text size="xs" c="dimmed" className={styles.fileName}>
                {selectedFile ? selectedFile.name : COPY.noFileChosen}
              </Text>
              <Button
                size="compact-sm"
                onClick={handleChooseFile}
                disabled={status === "reading" || status === "drawing"}
              >
                {selectedFile ? COPY.changeFile : COPY.chooseFile}
              </Button>
            </Group>

            <Text size="xs" fw={600} className={styles.sectionHeading}>
              {COPY.coordinateSystemHeading}
            </Text>

            <Group gap={8} wrap="nowrap" className={styles.fileRow}>
              <Select
                size="xs"
                className={styles.coordinateSelect}
                data={
                  COORDINATE_SYSTEMS as unknown as {
                    value: string;
                    label: string;
                  }[]
                }
                value={coordinateSystem}
                onChange={(next) => next && setCoordinateSystem(next)}
                allowDeselect={false}
              />
              <Button
                size="compact-sm"
                onClick={handleReadFile}
                disabled={
                  !selectedFile || status === "reading" || status === "drawing"
                }
              >
                {status === "reading" ? COPY.reading : COPY.readFile}
              </Button>
            </Group>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{COPY.colNumber}</th>
                    <th>{COPY.colEasting}</th>
                    <th>{COPY.colNorthing}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      {/* Same formatter the survey report uses, so a vertex reads
                          identically in both places. */}
                      <td>{formatCoordinate(row.x)}</td>
                      <td>{formatCoordinate(row.y)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!hasRows && (
                <Text
                  size="xs"
                  c="dimmed"
                  ta="center"
                  className={styles.emptyTable}
                >
                  {COPY.noRows}
                </Text>
              )}
            </div>

            {hasRows && (
              <Stack gap={8} className={styles.styleControls}>
                {/* الصف الأول: نمط التعبئة + شكل الخط */}
                <Group gap={8} wrap="nowrap">
                  <Select
                    size="xs"
                    label={COPY.fillPattern}
                    data={
                      FILL_PATTERN_OPTIONS as unknown as {
                        value: string;
                        label: string;
                      }[]
                    }
                    value={fillPattern}
                    onChange={(next) =>
                      next && setFillPattern(next as FillPatternValue)
                    }
                    className={styles.styleField}
                  />
                  <Select
                    size="xs"
                    label={COPY.lineStyle}
                    data={
                      LINE_STYLE_OPTIONS as unknown as {
                        value: string;
                        label: string;
                      }[]
                    }
                    value={lineStyle}
                    onChange={(next) =>
                      next && setLineStyle(next as LineStyleValue)
                    }
                    className={styles.styleField}
                  />
                </Group>

                {/* الصف الثاني: سماكة الخط + لون التعبئة + لون الخط */}
                <Group gap={8} wrap="nowrap" align="flex-end">
                  <label className={styles.numberField}>
                    <span>{COPY.lineWidth}</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={lineWidth}
                      onChange={(e) =>
                        setLineWidth(
                          Number(e.target.value) || DEFAULT_LINE_WIDTH,
                        )
                      }
                    />
                  </label>
                  <label className={styles.colorField}>
                    <span>{COPY.fillColor}</span>
                    <input
                      type="color"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      disabled={fillPattern === "none"}
                    />
                  </label>
                  <label className={styles.colorField}>
                    <span>{COPY.lineColor}</span>
                    <input
                      type="color"
                      value={lineColor}
                      onChange={(e) => setLineColor(e.target.value)}
                    />
                  </label>
                </Group>
              </Stack>
            )}

            {message && <div className={styles.message}>{message}</div>}
            {error && <div className={styles.error}>{error}</div>}

            {hasRows && (
              <Group gap={8} wrap="nowrap" className={styles.actionsRow}>
                <Button
                  color="red"
                  size="compact-sm"
                  onClick={() => setConfirmOpen(true)}
                >
                  {`${COPY.clearFile}${selectedFile ? ` "${selectedFile.name}"` : ""}`}
                </Button>
                <Button
                  size="compact-sm"
                  onClick={handleDraw}
                  disabled={status === "drawing"}
                >
                  {status === "drawing" ? COPY.drawing : COPY.draw}
                </Button>
              </Group>
            )}
          </Stack>
        </Stack>
      </Card>

      {/* Popup تأكيد المسح */}
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={COPY.clearConfirmTitle}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{COPY.clearConfirmMessage}</Text>
          <Group gap={8} justify="flex-end">
            <Button
              variant="default"
              size="compact-sm"
              onClick={() => setConfirmOpen(false)}
            >
              {COPY.clearConfirmNo}
            </Button>
            <Button color="red" size="compact-sm" onClick={handleClearFile}>
              {COPY.clearConfirmYes}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}