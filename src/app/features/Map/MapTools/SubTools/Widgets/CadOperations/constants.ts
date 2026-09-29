/** Arabic UI copy for the CAD operations panel. */
export const COPY = {
  title: "عمليات على ملف الكاد",
  toggleAria: "فتح/إغلاق عمليات الكاد",

  noDrawing: "ارفع ملف كاد وارسمه على الخريطة أولًا لتفعيل العمليات.",
  activeFilePrefix: "الملف الحالي:",

  apply: "تطبيق",
  applying: "جاري التنفيذ...",
  remove: "إزالة الناتج",

  intersect: {
    title: "تقاطع مع خط التنظيم (Intersect)",
    summary: "تقسيم الرسمة إلى الجزء الواقع داخل خط التنظيم (يظهر باللون الأحمر) والجزء الواقع خارجه.",
    legendInside: "داخل خط التنظيم",
    legendOutside: "خارج خط التنظيم",
    done: "تم تنفيذ عملية التقاطع: الجزء الأحمر يمثل ما يتقاطع مع خط التنظيم، والباقي خارج حدوده.",
    doneNoOverlap: "لا يوجد تقاطع بين الرسمة وخط التنظيم — الرسمة بالكامل خارج حدود التنظيم.",
    doneFullyInside: "الرسمة بالكامل داخل حدود خط التنظيم.",
    failed: "تعذّر تنفيذ عملية التقاطع مع خط التنظيم.",
    noRegulationData: "تعذّر جلب بيانات خط التنظيم من الخدمة.",

    /** The spatial read-out run on the intersection polygon itself. */
    context: {
      title: "البيانات المكانية للجزء المتقاطع",
      loading: "جاري الاستعلام عن البيانات المكانية...",
      neighborhood: "الحي",
      municipality: "البلدية",
      landUse: "استعمال الأرض",
      haram: "حد الحرم",
      urban: "النطاق العمراني",
      regulationConflict: "التعارض مع خط التنظيم",
      inside: "يتقاطع",
      outside: "لا يتقاطع",
      yes: "نعم",
      no: "لا",
      none: "غير متوفر",
      failedPrefix: "تعذّر الاستعلام عن:",

      /**
       * The survey-report form (نموذج التقرير المساحي). The wording below is the fixed
       * text of the municipality's template — only the values are filled in by the code.
       */
      report: {
        exportPdf: "تصدير PDF",
        exportAria: "تصدير نتائج الاستعلام المكاني بصيغة PDF",
        documentTitle: "تقرير مساحي",

        kingdom: "المملكة العربية السعودية",
        ministry: "وزارة البلديات والإسكان",
        authority: "أمانة العاصمة المقدسة",
        banner: "تقرير مساحي بغرض تطبيق الأمر السامي الكريم رقم ( ٥٧١ / م ) على الموقع",

        aerialBefore: "مصور جوي يثبت وجود المبنى قبل تاريخ ٢٥ / ٣ / ١٤٤١ هـ",
        aerialRecent: "مصور جوي حديث",
        buildingPhoto: "صورة للمبنى",
        barcode: "باركود",

        owner: {
          title: "بيانات المالك",
          name: "الاسم",
          nationalId: "رقم الهوية الوطنية",
          mobile: "رقم الجوال",
          email: "البريد الإلكتروني",
        },

        property: {
          title: "بيانات العقار",
          municipality: "البلدية",
          district: "الحي",
          use: "الاستخدام",
          siteContents: "مشتملات الموقع",
          urban: "النطاق العمراني",
          haram: "حد الحرم",
          regulationConflict: "التعارض مع خط التنظيم",
          inside: "داخل",
          outside: "خارج",
          yes: "نعم",
          no: "لا",
        },

        coords: {
          title: "الاحداثيات",
          /** The whole CAD drawing, as it stands on the ground. */
          siteTitle: "الإحداثيات بموجب الطبيعة",
          /** The part inside the regulation line — the plot after alignment. */
          alignedTitle: "الإحداثيات بعد التنظيم",
          point: "النقطة",
          northing: "شماليات",
          easting: "شرقيات",
          more: (count: number) => `... و ${count} نقطة أخرى`,
        },

        limits: {
          title: "حدود واطوال العقار بموجب الطبيعة",
          direction: "الاتجاه",
          border: "الحد",
          length: "الطول ( م )",
          byRegulation: "بموجب التنظيم",
          north: "الشمال",
          south: "الجنوب",
          east: "الشرق",
          west: "الغرب",
          totalArea: "المساحة الاجمالية",
          areaUnit: "م²",
        },

        pledge: {
          title: "تعهد واقرار المكتب الهندسي",
          items: [
            "١- تعهد بصحة خطوط التنظيم وانه مطابق لخرائط التنظيم في البلدية",
            "٢- تعهد بتوضيح حدود واطوال ومساحة العقار وفقا للطبيعة والتنظيم",
            "٣- تعهد بأن المصور الجوي المرفق قبل عام ٢٥ / ٣ / ١٤٤١هـ وان جميع البيانات صحيحة",
            "٤- المكتب الهندسي مسؤول مسؤولية كاملة امام الأمانة والغير عن صحة الرفع المساحي الوارد في هذا التقرير",
          ],
        },

        office: {
          logo: "شعار المكتب الهندسي وبياناته",
          engineer: "المهندس معد التقرير",
          manager: "مدير المكتب الهندسي",
          name: "الاسم",
          signature: "التوقيع",
          date: "التاريخ",
          seal: "الختم الرسمي",
        },

        /** The "قبل التصدير" form that collects what the drawing cannot supply. */
        form: {
          title: "بيانات التقرير قبل التصدير",
          intro: "أكمل البيانات التالية لتظهر في التقرير المصدَّر.",
          ownerSection: "بيانات المالك",
          propertySection: "بيانات العقار",
          officeSection: "بيانات المكتب الهندسي",
          bordersSection: "حدود وأطوال العقار بموجب الطبيعة",
          bordersHint: "أدخل الحد لكل اتجاه. الأطوال محسوبة تلقائيًا من الرسمة.",
          borderColumn: "الحد",
          lengthColumn: "الطول (م)",
          measuredHint: "المحسوب",
          engineerName: "المهندس معد التقرير",
          managerName: "مدير المكتب الهندسي",
          photosSection: "صور المبنى",
          photosHint: "أرفق ثلاث صور للمبنى (إلزامي). تظهر في التقرير بجانب الباركود.",
          photoSlot: (index: number) => `صورة ${(index + 1).toLocaleString("ar-EG")}`,
          choosePhoto: "اختيار صورة",
          replacePhoto: "تغيير",
          removePhoto: "إزالة",
          readingPhoto: "جاري التحميل...",
          photoReadFailed: "تعذّر قراءة الملف — اختر صورة (JPG أو PNG).",
          cancel: "إلغاء",
          submit: "تصدير PDF",
          exporting: "جاري التصدير...",
        },

        /** Storing the exported PDF as an attachment on the open request. */
        attach: {
          saving: (id: number) => `جاري حفظ التقرير كمرفق على الطلب رقم ${id}...`,
          saved: (id: number) => `تم حفظ التقرير كمرفق على الطلب رقم ${id}.`,
          failed: (id: number) =>
            `تم تنزيل التقرير، لكن تعذّر حفظه كمرفق على الطلب رقم ${id}.`,
          retry: "إعادة المحاولة",
        },

        fileLabel: "ملف الكاد",
        dateLabel: "تاريخ الإصدار",
        footer: "تم إنشاء هذا التقرير آليًا من نظام مستكشف مكة الجغرافي.",
      },
    },
  },

  errors: {
    noMap: "لم يتم العثور على خريطة ArcGIS.",
    noView: "Map View غير متاح حاليًا.",
    noLayer: "Map غير متاح حاليًا.",
    generic: "حدث خطأ أثناء تنفيذ العملية.",
  },
} as const;

/** Every layer this panel adds is titled with this prefix, which is how the
 *  panel finds and removes its own output without touching the CAD layer or
 *  any of the municipality's operational layers. */
export const OPERATION_LAYER_PREFIX = "عملية كاد";

/**
 * "مضلع خطوط التنظيم" (regulation-line polygon) FeatureLayer — sublayer 6 of the
 * MMSDI_MD_BusinessMapgisViewerPRO MapServer on the municipality's secured maps host.
 * Queried live (not preloaded on the map) so the intersect operation always compares
 * against the current published boundary. Same host/token as BUSINESS_MAP_URL, so no
 * extra token registration is needed — see Map/index.tsx.
 */
export const REGULATION_LAYER_URL =
  "https://maps.holymakkah.gov.sa/arcgis/rest/services/SDI/MMSDI_MD_BusinessMapgisViewerPRO/MapServer/6";

/** Fixed semantic colour for the part of the drawing inside the regulation boundary —
 *  not user-configurable, since red here means
 *  "falls inside the regulated zone" rather than a cosmetic choice. */
export const INTERSECT_INSIDE_COLOR: [number, number, number, number] = [229, 57, 53, 1];
export const INTERSECT_INSIDE_FILL_OPACITY = 0.35;

/** Design-token name for the "outside" part, so it reads as the drawing's normal,
 *  unmodified style rather than a second alert colour next to the red. */
export const INTERSECT_OUTSIDE_COLOR_TOKEN = "--primary-sa-500";
export const INTERSECT_OUTSIDE_FILL_OPACITY = 0.18;

/**
 * Sublayer indices on BUSINESS_MAP_URL (SDI/MMSDI_MD_BusinessMap/MapServer, mapName
 * "BusinessLayers") used for the spatial read-out of the CAD ∩ regulation polygon.
 *
 * Verified live 2026-09-22 via `?f=json`: all five are polygon Feature Layers, WKID
 * 32637, maxRecordCount 10000, and the service REJECTS pagination (`resultRecordCount`
 * → "Pagination is not supported"), so these must never be paged. Same host as
 * REGULATION_LAYER_URL, so the token registered in Map/index.tsx already covers them.
 */
export const CONTEXT_LAYERS = {
  NEIGHBORHOODS: 1, // الأحياء
  MUNICIPALITIES: 2, // البلديات
  URBAN_BOUNDARY: 4, // النطاق العمراني
  LAND_USES: 20, // إستخدامات الأراضي
  HARAM_BOUNDARY: 91, // حد الحرم
} as const;

/**
 * Field names on those sublayers — read off the live service, not guessed.
 *
 * ⚠️ DIST_ANAME and SECT_ANAME are esriFieldTypeInteger despite their "…اسم…" aliases:
 * the readable Arabic name lives in a CODED-VALUE DOMAIN (WS1_Makkah_District_ANames /
 * WS1_Sectors_Arabic_Name), so the raw attribute comes back as a code like 20 and has to
 * be decoded through the layer's field domain — see `decodeFieldValue` in
 * spatialContext.ts. LANDUSE_PLAN_NAME is a plain String (e.g. "مناطق سكنية مرتفعة
 * الكثافة") with no domain.
 */
export const CONTEXT_FIELDS = {
  neighborhoodName: "DIST_ANAME",
  neighborhoodCode: "DIST_CODE",
  municipalityName: "SECT_ANAME",
  municipalityCode: "SECT_CODE",
  landUseName: "LANDUSE_PLAN_NAME",
} as const;
