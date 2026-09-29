"use client";

/**
 * The municipality's survey-report form (تقرير مساحي) for the intersect operation,
 * laid out as ONE A4-landscape page, plus the direct PDF export.
 *
 * What is filled in (all derived from data already in memory — exporting never re-runs
 * a spatial query):
 *   - the sketch of the part of the CAD drawing that falls INSIDE the regulation
 *     boundary, with numbered vertices and side lengths;
 *   - البلدية / الحي and the حد الحرم / النطاق العمراني tick boxes, from the
 *     `SpatialContext` read-out (الاستخدام is typed in the pre-export form instead);
 *   - the التعارض مع خط التنظيم نعم / لا boxes, from the intersect split itself;
 *   - the شرقيات/شماليات table, the per-direction lengths and the total area, from the
 *     intersection polygon projected to UTM 37N (`ReportGeometry`).
 * Everything else (owner data, photos, signatures, seal, …) is left blank on purpose.
 *
 * Why the sheet is rasterised (html2canvas-pro) instead of written with a PDF library:
 * the form is Arabic. jsPDF and pdfmake do no bidi reordering and no Arabic glyph
 * shaping, so Arabic comes out disconnected and reversed unless a shaping engine is
 * bundled alongside an embedded Arabic font. Snapshotting the DOM keeps the browser's
 * own shaping, IBM Plex Sans Arabic and `dir="rtl"`; jsPDF only places the image on
 * an A4 page and triggers the download.
 *
 * Mounted through a portal onto <body>, parked off-screen (not `display: none`) so the
 * logo and webfont are already loaded and laid out when the export snapshots it — see
 * `.cad-print-root` in CadOperations.module.scss.
 */

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AerialUnderlay, ReportAerials } from "./aerialUnderlay";
import styles from "./CadOperations.module.scss";
import { resolveToken } from "@/lib/designTokens";
import { hexToRgba } from "../CadUploadTool/geometry";
import { COPY, INTERSECT_INSIDE_COLOR, INTERSECT_OUTSIDE_COLOR_TOKEN } from "./constants";
import type { Direction, ReportGeometry, ReportVertex } from "./reportGeometry";
import { EMPTY_REPORT_FORM, filled, type ReportFormValues } from "./reportForm";
import {
  formatCoordinate,
  formatReportDate,
  formatSignatureDate,
  matchesLabel,
} from "./selectors";
import type { SpatialContext } from "./spatialContext";

const CONTEXT = COPY.intersect.context;
const REPORT = CONTEXT.report;

/** Pre-printed rows per coordinate table. There are two tables (بموجب الطبيعة / بعد
 *  التنظيم) sharing the space one used to have, so each gets half the old 10. More
 *  vertices than this shrink the font. */
const FORM_COORD_ROWS = 5;
/** Beyond this the rows would be unreadably small — the rest is summarised in one line. */
const MAX_COORD_ROWS = 8;

/** Table order on the form: north, south, east, west. */
const DIRECTIONS: Array<{ key: Direction; label: string }> = [
  { key: "north", label: REPORT.limits.north },
  { key: "south", label: REPORT.limits.south },
  { key: "east", label: REPORT.limits.east },
  { key: "west", label: REPORT.limits.west },
];

/** Outline of the CAD polygon on the aerial photos. SVG attributes cannot read design
 *  tokens (the sheet is serialised to an image), so it is a literal. Yellow, because it is
 *  the colour that stays visible on both dark roofs and pale ground. */
const AERIAL_OUTLINE = "#2b00ff";
/** Dark edge under the yellow line — yellow on pale ground alone would disappear. */
const AERIAL_OUTLINE_EDGE = "rgba(0, 0, 0, 0.65)";

const INSIDE_RGB = `rgb(${INTERSECT_INSIDE_COLOR[0]}, ${INTERSECT_INSIDE_COLOR[1]}, ${INTERSECT_INSIDE_COLOR[2]})`;

/** Red — now the OUTSIDE part: the piece of the plot the regulation line does not cover. */
const OUTSIDE_RGB = INSIDE_RGB;

/** Stroke for the part inside the regulation line.
 *
 *  Resolved at RENDER time, not module load: `resolveToken` reads the computed value off
 *  `:root`, which needs the document to exist. Written as a literal `rgb()` on the element
 *  because the sketch is rasterised into the PDF, and CSS variables do not survive that. */
function insideStroke(): string {
  const color = hexToRgba(resolveToken(INTERSECT_OUTSIDE_COLOR_TOKEN, "#1B8354"), 100);
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export type IntersectReportProps = {
  /** The CAD file the intersection was computed from — printed in the footer line. */
  fileName: string;
  /** The already-resolved read-out. Re-rendered here, never re-queried. */
  context: SpatialContext;
  /** التعارض مع خط التنظيم — true when part of the drawing lies outside the regulation line. */
  regulationConflict: boolean;
  /** The intersection polygon in metres. `null` → the sketch and tables stay blank. */
  geometry: ReportGeometry | null;
  /** When the read-out was produced. */
  generatedAt: Date;
  /** The two photos with the CAD polygon over them: Oct 2019 for "مصور جوي يثبت وجود
   *  المبنى" and 2024 for "مصور جوي حديث". Absent / `null` → that box stays blank for the
   *  office to paste a photo into. */
  aerial?: ReportAerials | null;
  /** What the office typed in the pre-export form. Omitted → every one of those fields
   *  prints blank, exactly as the sheet did before the form existed. */
  form?: ReportFormValues;
  /** PNG data URL of the QR code linking to the site on Google Maps. Null/absent → the
   *  باركود box keeps its label, as before. */
  siteQr?: string | null;
};

/** داخل / خارج tick boxes. `known === false` (that layer's query failed) leaves both
 *  boxes empty rather than claiming "outside". */
function InsideOutside({ inside, known }: { inside: boolean; known: boolean }) {
  const box = (on: boolean) => `${styles.checkBox} ${on ? styles.checkBoxOn : ""}`;

  return (
    <span className={styles.checks}>
      <span className={styles.check}>
        <i className={box(known && inside)} />
        {REPORT.property.inside}
      </span>
      <span className={styles.check}>
        <i className={box(known && !inside)} />
        {REPORT.property.outside}
      </span>
    </span>
  );
}

/** نعم / لا tick boxes — the same look as `InsideOutside`, for a yes/no question. */
function YesNo({ yes }: { yes: boolean }) {
  const box = (on: boolean) => `${styles.checkBox} ${on ? styles.checkBoxOn : ""}`;

  return (
    <span className={styles.checks}>
      <span className={styles.check}>
        <i className={box(yes)} />
        {REPORT.property.yes}
      </span>
      <span className={styles.check}>
        <i className={box(!yes)} />
        {REPORT.property.no}
      </span>
    </span>
  );
}

/** A "صورة للمبنى" box: the photo attached in the pre-export form, or the label when none. */
function BuildingPhoto({ src }: { src?: string }) {
  if (!src) return <div className={styles.photoBox}>{REPORT.buildingPhoto}</div>;

  return (
    <div className={`${styles.photoBox} ${styles.photoFilled}`}>
      {/* A plain <img> with inline data, like the QR: the sheet is rasterised for the PDF,
          and a data URL is the one source that survives that without an external fetch. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={REPORT.buildingPhoto} className={styles.photoFilledImage} />
    </div>
  );
}

/** One شرقيات/شماليات table: padded to the form's blank rows, capped with a "… و N" line. */
function CoordinatesTable({ title, vertices }: { title: string; vertices: ReportVertex[] }) {
  const shown = vertices.slice(0, MAX_COORD_ROWS);
  const hiddenCount = vertices.length - shown.length;
  const blankRows = Math.max(0, FORM_COORD_ROWS - shown.length);
  const compact = shown.length > FORM_COORD_ROWS;
  /** Rows this table prints — its share of the stack's height, so the longer table gets
   *  more room instead of both being squeezed to the same size. */
  const rowCount = shown.length + (hiddenCount > 0 ? 1 : 0) + blankRows;

  return (
    <section
      className={`${styles.coords} ${compact ? styles.coordsCompact : ""}`}
      style={{ flexGrow: rowCount }}
    >
      <div className={styles.sectionTitle}>{title}</div>
      <div className={`${styles.coordsRow} ${styles.coordsHead}`}>
        <span>{REPORT.coords.point}</span>
        <span>{REPORT.coords.northing}</span>
        <span>{REPORT.coords.easting}</span>
      </div>
      <div className={styles.coordsBody}>
        {shown.map((vertex) => (
          <div key={vertex.n} className={styles.coordsRow}>
            <span>{vertex.n.toLocaleString("ar-EG")}</span>
            <span>{formatCoordinate(vertex.northing)}</span>
            <span>{formatCoordinate(vertex.easting)}</span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className={`${styles.coordsRow} ${styles.coordsMore}`}>
            {REPORT.coords.more(hiddenCount)}
          </div>
        )}
        {Array.from({ length: blankRows }, (_, i) => (
          <div key={`blank-${i}`} className={styles.coordsRow}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}

function KeyValueRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className={styles.kvRow}>
      <div className={styles.kvLabel}>{label}</div>
      <div className={styles.kvValue}>{value}</div>
    </div>
  );
}

function SignatureBlock({ title, name, date }: { title: string; name?: string; date: string }) {
  return (
    <div className={styles.officeBlock}>
      <div className={`${styles.sectionTitle} ${styles.officeTitle}`}>{title}</div>
      <div className={`${styles.kvRow} ${styles.kvRowSmall}`}>
        <div className={styles.kvLabel}>{REPORT.office.name}</div>
        <div className={styles.kvValue}>{name}</div>
      </div>
      <div className={`${styles.kvRow} ${styles.kvRowSmall}`}>
        <div className={styles.kvLabel}>{REPORT.office.signature}</div>
        <div className={styles.kvValue} />
      </div>
      <div className={`${styles.kvRow} ${styles.kvRowSmall}`}>
        <div className={styles.kvLabel}>{REPORT.office.date}</div>
        <div className={styles.kvValue}>{date}</div>
      </div>
    </div>
  );
}

/** The sketch: red outline, green vertex numbers "(n)", black side lengths along each side. */
function Sketch({ geometry }: { geometry: ReportGeometry }) {
  const { drawing } = geometry;

  return (
    <svg
      className={styles.drawingSvg}
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
    >
      {/* The part OUTSIDE the regulation line — RED, because that is the part of the plot
          the regulation does not cover and which a reviewer must notice. Drawn first so the
          inside outline sits on top of it where the two meet. */}
      {drawing.outsidePaths.map((d) => (
        <path
          key={`outside-${d}`}
          d={d}
          fill="rgba(235, 16, 16, 0.1)"
          stroke={OUTSIDE_RGB}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ))}

      {/* The part INSIDE the regulation line — dashed, and in the non-alert colour so the
          two halves stay distinguishable by BOTH colour and line style (a black-and-white
          print keeps the dash). */}
      {drawing.paths.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={insideStroke()}
          strokeWidth={2.5}
          strokeDasharray="8 5"
          strokeLinejoin="round"
        />
      ))}

      {/* SVG attributes, not CSS: the sketch is serialised to an image for the PDF, and
          CSS variables / module classes do not survive that. */}
      {drawing.edgeLabels.map((label) => (
        <text
          key={`${label.x}-${label.y}`}
          x={label.x}
          y={label.y}
          transform={`rotate(${label.angle.toFixed(2)} ${label.x} ${label.y})`}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize={13}
          fill="#111111"
        >
          {label.text}
        </text>
      ))}

      {drawing.cornerPoints.map((point) => (
        <circle
          key={`corner-${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={3.5}
          fill="#16A34A"
          stroke="#FFFFFF"
          strokeWidth={1}
        />
      ))}

      {drawing.vertexLabels.map((label) => (
        <text
          key={label.n}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize={15}
          fontWeight={700}
          fill="#16A34A"
        >
          {`(${label.n})`}
        </text>
      ))}
    </svg>
  );
}

/**
 * One aerial-photo box ("مصور جوي يثبت وجود المبنى قبل تاريخ …" or "مصور جوي حديث"): the
 * caption, then the photo with the CAD polygon drawn over it. ONE <svg> holds both the image and the outline, so they scale
 * together and the polygon can never drift off the building. Without a photo it is the
 * plain blank box it always was.
 */
function AerialPhoto({
  title,
  underlay,
}: {
  title: string;
  underlay?: AerialUnderlay | null;
}) {
  if (!underlay) return <div className={styles.photoBox}>{title}</div>;

  return (
    <div className={`${styles.photoBox} ${styles.photoBoxMedia}`}>
      <div className={styles.photoCaption}>
        <div>{title}</div>
        <div className={styles.photoSource}>{underlay.sourceLabel}</div>
      </div>
      <div className={styles.photoSvgWrap}>
        <svg
          className={styles.photoSvg}
          viewBox={`0 0 ${underlay.width} ${underlay.height}`}
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <image href={underlay.dataUrl} x={0} y={0} width={underlay.width} height={underlay.height} />
          {/* SVG attributes, not CSS (see Sketch). A dark edge under the yellow outline so
              the line stays readable over both dark roofs and pale ground. */}
          {underlay.paths.map((d) => (
            <path
              key={`halo-${d}`}
              d={d}
              fill="none"
              stroke={AERIAL_OUTLINE_EDGE}
              strokeWidth={7}
              strokeLinejoin="round"
            />
          ))}
          {underlay.paths.map((d) => (
            <path
              key={d}
              d={d}
              fill="rgba(255, 214, 0, 0.12)"
              stroke={AERIAL_OUTLINE}
              strokeWidth={3.5}
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

/** The A4-landscape sheet itself (no portal) — what gets snapshotted into the PDF. */
export function ReportSheet({
  fileName,
  context,
  regulationConflict,
  geometry,
  generatedAt,
  aerial,
  form = EMPTY_REPORT_FORM,
  siteQr,
}: IntersectReportProps) {

  const haramKnown = !context.failed.includes(CONTEXT.haram);
  const urbanKnown = !context.failed.includes(CONTEXT.urban);

  const format = (value: number | undefined) =>
    value !== undefined && value > 0 ? value.toFixed(2) : "";

  const formatArea = (value: number | null | undefined) =>
    value != null && value > 0 ? `${value.toFixed(2)} ${REPORT.limits.areaUnit}` : "";

  /** التاريخ under both signatures: the day the PDF is issued (`generatedAt` is stamped
   *  when the export form is submitted), so it always matches تاريخ الإصدار in the footer. */
  const issuedOn = formatSignatureDate(generatedAt);

  /** بموجب التنظيم — only the part of the boundary that meets the regulation line. */
  const regulationLengthOf = (direction: Direction) =>
    format(geometry?.directionLengths[direction]);

  return (
    <div className={styles.sheet}>
      <div className={styles.frame}>
        {/* ── left column: header, owner, property, coordinates, office ── */}
        <div className={styles.colInfo}>
          <header className={styles.orgHeader}>
            <Image
              src="/Holy Makkah Municipality Logo.png"
              alt={REPORT.authority}
              width={96}
              height={24}
              priority
              className={styles.orgLogo}
            />
            <div className={styles.orgText}>
              <div>{REPORT.kingdom}</div>
              <div>{REPORT.ministry}</div>
              <div>{REPORT.authority}</div>
            </div>
          </header>

          <div className={styles.banner}>{REPORT.banner}</div>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>{REPORT.owner.title}</div>
            <KeyValueRow label={REPORT.owner.name} value={filled(form.owner.name)} />
            <KeyValueRow label={REPORT.owner.nationalId} value={filled(form.owner.nationalId)} />
            <KeyValueRow label={REPORT.owner.mobile} value={filled(form.owner.mobile)} />
            <KeyValueRow label={REPORT.owner.email} value={filled(form.owner.email)} />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>{REPORT.property.title}</div>
            <KeyValueRow
              label={REPORT.property.municipality}
              value={matchesLabel(context.municipalities)}
            />
            <KeyValueRow
              label={REPORT.property.district}
              value={matchesLabel(context.neighborhoods)}
            />
            <KeyValueRow label={REPORT.property.use} value={filled(form.property.use)} />
            <KeyValueRow
              label={REPORT.property.siteContents}
              value={filled(form.property.siteContents)}
            />
            <div className={styles.boundaryRow}>
              <div className={styles.boundaryLabel}>{REPORT.property.urban}</div>
              <div className={styles.boundaryValue}>
                <InsideOutside inside={context.intersectsUrbanBoundary} known={urbanKnown} />
              </div>
              <div className={`${styles.boundaryLabel} ${styles.boundaryLabelSplit}`}>
                {REPORT.property.haram}
              </div>
              <div className={styles.boundaryValue}>
                <InsideOutside inside={context.intersectsHaram} known={haramKnown} />
              </div>
            </div>
            <div className={`${styles.boundaryRow} ${styles.boundaryRowSingle}`}>
              <div className={styles.boundaryLabel}>{REPORT.property.regulationConflict}</div>
              <div className={styles.boundaryValue}>
                <YesNo yes={regulationConflict} />
              </div>
            </div>
          </section>

          <div className={styles.coordsStack}>
            <CoordinatesTable
              title={REPORT.coords.siteTitle}
              vertices={geometry?.plotVertices ?? []}
            />
            <CoordinatesTable
              title={REPORT.coords.alignedTitle}
              vertices={geometry?.vertices ?? []}
            />
          </div>

          {/* 2 × 2 (logo | seal over engineer | manager) rather than one tall stack, so the
              two coordinate tables above get the height they need. */}
          <div className={styles.office}>
            <div className={styles.officeBlock}>
              <div className={`${styles.sectionTitle} ${styles.officeTitle}`}>
                {REPORT.office.logo}
              </div>
              <div className={styles.blankLogo} />
            </div>
            <div className={styles.officeBlock}>
              <div className={`${styles.sectionTitle} ${styles.officeTitle}`}>
                {REPORT.office.seal}
              </div>
              <div className={styles.blankSeal} />
            </div>
            <SignatureBlock
              title={REPORT.office.engineer}
              name={filled(form.office.engineerName)}
              date={issuedOn}
            />
            <SignatureBlock
              title={REPORT.office.manager}
              name={filled(form.office.managerName)}
              date={issuedOn}
            />
          </div>
        </div>

        {/* ── centre column: sketch, limits table, pledge ── */}
        <div className={styles.colMain}>
          <div className={styles.drawing}>{geometry && <Sketch geometry={geometry} />}</div>

          <table className={styles.limits}>
            <thead>
              <tr>
                <th colSpan={4} className={styles.tableTitle}>
                  {REPORT.limits.title}
                </th>
              </tr>
              <tr>
                <th scope="col">{REPORT.limits.direction}</th>
                <th scope="col">{REPORT.limits.border}</th>
                <th scope="col">{REPORT.limits.length}</th>
                <th scope="col">{REPORT.limits.byRegulation}</th>
              </tr>
            </thead>
            <tbody>
              {DIRECTIONS.map(({ key, label }) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{filled(form.borders[key])}</td>
                  <td>{format(geometry?.totalDirectionLengths[key])}</td>
                  <td>{regulationLengthOf(key)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" colSpan={2}>
                  {REPORT.limits.totalArea}
                </th>
                {/* Same split as the lengths above: the whole plot under الطول, the part
                    inside the regulation line under بموجب التنظيم. */}
                <td>{formatArea(geometry?.plotArea)}</td>
                <td>{formatArea(geometry?.area)}</td>
              </tr>
            </tbody>
          </table>

          <section className={styles.pledge}>
            <div className={styles.sectionTitle}>{REPORT.pledge.title}</div>
            {REPORT.pledge.items.map((item) => (
              <div key={item} className={styles.pledgeItem}>
                {item}
              </div>
            ))}
          </section>
        </div>

        {/* ── right column: photos (blank boxes to be filled by the office) ── */}
        <div className={styles.colPhotos}>
          <AerialPhoto title={REPORT.aerialBefore} underlay={aerial?.before} />
          <AerialPhoto title={REPORT.aerialRecent} underlay={aerial?.recent} />
          <div className={styles.photoPair}>
            <BuildingPhoto src={form.photos[0]} />
            <BuildingPhoto src={form.photos[1]} />
          </div>
          <div className={styles.photoPair}>
            <div className={`${styles.photoBox} ${siteQr ? styles.qrBox : ""}`}>
              {siteQr ? (
                // A plain <img> with inline data: the sheet is rasterised for the PDF, and a
                // data URL is the one form that survives that without an external fetch.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={siteQr} alt={REPORT.barcode} className={styles.qrImage} />
              ) : (
                REPORT.barcode
              )}
            </div>
            <BuildingPhoto src={form.photos[2]} />
          </div>
        </div>
      </div>

      <div className={styles.sheetFooter}>
        <span>{`${REPORT.fileLabel}: ${fileName}`}</span>
        <span>{`${REPORT.dateLabel}: ${formatReportDate(generatedAt)}`}</span>
        <span>{REPORT.footer}</span>
      </div>
    </div>
  );
}

export default function IntersectReport(props: IntersectReportProps) {
  // The portal target only exists in the browser. The map tree is already
  // `ssr: false`, but this keeps the component safe to render anywhere.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    // `cad-print-root` is a GLOBAL class on purpose: the export finds the sheet with it,
    // and the off-screen parking rule is unhashed (see CadOperations.module.scss).
    <div className="cad-print-root" aria-hidden="true" lang="ar" dir="rtl">
      <ReportSheet {...props} />
    </div>,
    document.body,
  );
}

/**
 * Snapshots the sheet and downloads it as a one-page A4-landscape PDF — no print dialog —
 * and returns that same PDF as a `File`, so it can also be stored on the request.
 * The sheet is rasterised (not re-typeset), so the browser's own Arabic shaping, RTL and
 * webfont are preserved exactly.
 */
export async function exportIntersectReportPdf(fileName: string): Promise<File> {
  const root = document.querySelector<HTMLElement>(".cad-print-root");
  if (!root) throw new Error("Report sheet is not mounted.");

  // Make sure the Arabic webfont is ready before the snapshot.
  await document.fonts.ready;

  // Loaded on demand so the two libraries stay out of the main map bundle.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(root, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    // The live sheet is parked off-screen and transparent; un-park the CLONE only.
    onclone: (clonedDoc) => {
      const el = clonedDoc.querySelector<HTMLElement>(".cad-print-root");
      if (!el) return;
      el.style.position = "absolute";
      el.style.top = "0";
      el.style.left = "0";
      el.style.opacity = "1";
      el.style.zIndex = "auto";
    },
  });

  // The sheet is exactly A4 landscape (1123 × 794 px @ 96 dpi), so it fills one page.
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.addImage(
    canvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    0,
    0,
    pdf.internal.pageSize.getWidth(),
    pdf.internal.pageSize.getHeight(),
  );

  const stem = fileName.replace(/\.[^./\\]+$/, "");
  const name = `${REPORT.documentTitle} - ${stem}.pdf`;
  pdf.save(name);

  // The SAME bytes that were just downloaded, handed back so the caller can store them as
  // the request's attachment — the stored copy can never differ from the user's copy.
  return new File([pdf.output("blob")], name, { type: "application/pdf" });
}