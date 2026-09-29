/** Arabic UI copy for every state of the panel. */
export const COPY = {
  title: "رسم من كاد",
  close: "إغلاق",

  chooseFileHeading: "اختيار الملف المراد تحميله",
  chooseFile: "اختيار الملف",
  noFileChosen: "الرجاء اختيار ملف",
  changeFile: "تغيير الملف",

  coordinateSystemHeading: "نظام إحداثيات الملف",
  coordinateSystemLabel: "نظام الإحداثيات",
  readFile: "قراءة الملف",
  reading: "جاري القراءة...",

  colNumber: "رقم",
  colEasting: "شرقيات",
  colNorthing: "شمالیات",
  noRows: "لا توجد إحداثيات لعرضها بعد.",

  lineWidth: "سماكة الخط",
  lineStyle: "شكل الخط",
  fillPattern: "نمط التعبئة",
  lineColor: "لون الخط",
  fillColor: "لون التعبئة",

  clearFile: "مسح الملف",
  draw: "رسم",
  drawing: "جاري الإضافة...",

  clearConfirmTitle: "تأكيد المسح",
  clearConfirmMessage: "هل أنت متأكد من مسح الملف؟ سيتم حذف الرسمة من الخريطة أيضاً.",
  clearConfirmYes: "نعم، امسح",
  clearConfirmNo: "إلغاء",

  errors: {
    extension: "من فضلك اختر ملف DWG أو DXF فقط.",
    noMap: "لم يتم العثور على خريطة ArcGIS.",
    noView: "Map View غير متاح حاليًا.",
    noLayer: "Map غير متاح حاليًا.",
    noData: "الـ API لم يرجع بيانات CAD.",
    empty: "ملف CAD لا يحتوي على أي عناصر قابلة للعرض.",
    generic: "حدث خطأ أثناء معالجة ملف CAD.",
  },
} as const;

/** Only one system is actually supported server-side today — kept as a real Select
 *  (not a static label) so adding a second projection later is a one-line change. */
export const COORDINATE_SYSTEMS = [{ value: "wgs84-utm37n", label: "WGS 84 / UTM zone 37N" }] as const;

/** WKID for each entry in COORDINATE_SYSTEMS. The API returns raw easting/northing in
 *  this projected CRS — it must be reprojected to WGS84 (4326) before it's valid GeoJSON,
 *  since GeoJSON coordinates are always lon/lat degrees regardless of source CRS. */
export const COORDINATE_SYSTEM_WKIDS: Record<string, number> = {
  "wgs84-utm37n": 32637,
};

export const LINE_STYLE_OPTIONS = [
  { value: "solid", label: "متصل" },
  { value: "dash", label: "متقطع" },
  { value: "dot", label: "منقط" },
  { value: "dash-dot", label: "متقطع - نقطة" },
] as const;

export const FILL_PATTERN_OPTIONS = [
  { value: "solid", label: "صلب" },
  { value: "transparent", label: "شفاف" },
  { value: "none", label: "بدون" },
] as const;

export const DEFAULT_LINE_WIDTH = 2;

/** Design-token names for the drawn CAD symbol. Resolved to real colours at draw time
 *  (same pattern as KmlUpload/constants.ts) since ArcGIS symbols can't read CSS vars. */
export const CAD_LINE_COLOR_TOKEN = "--primary-sa-600";
export const CAD_FILL_COLOR_TOKEN = "--primary-sa-400";
