
export type CadPanelStatus = "idle" | "reading" | "read" | "drawing" | "error";

/** One row of the شرقيات/شمالیات table — a single vertex read from the CAD file. */
export interface CoordinateRow {
  id: number;
  x: number;
  y: number;
}

export type LineStyleValue = "solid" | "dash" | "dot" | "dash-dot";

/** "solid"       → تعبئة كاملة باللون
 *  "transparent" → نفس اللون بس شفافية خفيفة (30%)
 *  "none"        → مفيش تعبئة خالص */
export type FillPatternValue = "solid" | "transparent" | "none";
