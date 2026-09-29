/**
 * Shared ArcGIS service config used by more than one feature (Dashboard + Map).
 *
 * Cross-feature config lives in `src/lib`, not inside a feature — so neither
 * feature has to reach into the other's folder. Feature-specific ArcGIS config
 * stays with its feature (e.g. `features/Map/arcgis.config.ts` for the basemap).
 */

import {
  getChangeDetectionUrl,
  getComplaintsUrl,
  getExecutiveDashboardUrl,
  getMunicipalAssetsUrl,
  getPortalUrl,
  getRegulationTransactionsUrl,
} from "./runtimeConfig";

// Each URL is runtime-resolved so one build targets QA vs production by env file
// alone (no rebuild). Environments differ by host, web-adaptor path (/arcgis vs
// /server), AND service name, so the WHOLE URL is configurable — not just the host.
// Unset → the production default in lib/runtimeConfig.ts.

/**
 * Development dashboard MapServer (prod: MunicipalAssetV1; QA: Dashboard/Dashboard).
 * The configured service must expose the same sublayer indices (see LAYERS) and
 * field names; field deltas are handled in Dashboard/api.ts (FULFILLMENT →
 * CONSTRUCTION_STATUS, VERIFICATION_STATUS → DOCUMENTATION_STATUS, Shape__Area →
 * AREAM). The service rejects pagination (`resultRecordCount`).
 */
export const MUNICIPAL_ASSETS_URL = getMunicipalAssetsUrl();

/**
 * Complaints & reports FeatureServer layer (طبقة "الشكاوي و البلاغات") — the data
 * source for the مؤشرات البلاغات dashboard (agency id `complaints`). Point layer,
 * fields incl. STATUS / MAINCLASSIFICATION / INTERACTIONTYPE / SLA_TRACK /
 * SATISFACTION / MUNICIPALITY_CODE / ZONE_ANAME / PXCREATEDATETIME. Token-gated.
 */
export const COMPLAINTS_URL = getComplaintsUrl();

/**
 * Change-detection MapServer (لوحة رصد التغيرات / ChangeDetictionVer2_MIL1) — the
 * data source for the change-monitoring dashboard (agency id `change-detection`).
 * Two polygon sublayers queried by index (see CHANGE_DETECTION_LAYERS); Web Mercator
 * (wkid 102100), 2000-record pages, ARABICNAME display field. Token-gated.
 */
export const CHANGE_DETECTION_URL = getChangeDetectionUrl();

/**
 * Sublayer indices within the ChangeDetictionVer2_MIL1 MapServer. Verified against
 * the live service: /5 carries no ownership data, /6 carries ownership data.
 */
export const CHANGE_DETECTION_LAYERS = {
  WITHOUT_OWNERSHIP: 5, // رصد التغيرات بدون بيانات ملكية
  WITH_OWNERSHIP: 6, // رصد التغيرات لها بيانات ملكية
} as const;

/**
 * Executive dashboard MapServer (اللوحة التنفيذية لوكالة التعمير /
 * BusinessMapgisViewerSdiV5 on the secured maps host) — the data source for the
 * `executive` dashboard. Three polygon sublayers queried by index (see
 * EXECUTIVE_LAYERS). Token-gated (BusinessMap token — same host as BUSINESS_MAP_URL).
 */
export const EXECUTIVE_DASHBOARD_URL = getExecutiveDashboardUrl();

/**
 * Sublayer indices within the BusinessMapgisViewerSdiV5 MapServer ("BusinessLayers").
 * Verified live 2026-07-19 via `?f=json`: all three are polygon layers, WKID 32637,
 * maxRecordCount 1000.
 */
export const EXECUTIVE_LAYERS = {
  ZONING_PARCELS: 0, // قطع الأراضي التنظيمية
  SUBDIVISION_PLANS: 1, // مخططات الأراضي التقسيمية
  SUSPENDED_AREAS: 2, // حدود المناطق الموقوفة
} as const;

/**
 * Sublayer indices on the same BusinessMapgisViewerSdiV5 MapServer, backing the
 * `investment` dashboard. Verified live 2026-08-13 via `?f=json`: both polygon,
 * WKID 32637, maxRecordCount 1000; assets carry 98 fields, sectors 14.
 */
export const INVESTMENT_LAYERS = {
  MUNICIPAL_ASSETS: 3, // أصول الأمانة
  SECTORS: 4, // القطاعات البلدية
} as const;

/**
 * Sublayer indices on the same BusinessMapgisViewerSdiV5 MapServer, backing the
 * `services` dashboard. Verified live 2026-09-04 via `?f=json`: both point layers,
 * WKID 32637, maxRecordCount 1000, no pagination; 1,205 schools / 199 facilities.
 */
export const SERVICES_LAYERS = {
  SCHOOLS: 5, // الخدمات التعليمية
  HEALTH: 6, // الخدمات الصحية
} as const;

/** Portal root used to register the ArcGIS token for authenticated requests. */
export const ARCGIS_PORTAL_URL = getPortalUrl();

/** Sublayer indices within the MunicipalAssetV1 MapServer. */
export const LAYERS = {
  CLEARED_LANDS: 0, // الأراضي المفرغة للبلد الأمين
  INVESTMENT_LANDS: 3, // اراضي استثمارية
  GARDENS: 4, // حدائق
  MUNICIPALITY: 5, // كامل أصول الأمانة
} as const;


/* ── Regulation transactions (الطلبات + الكاد المرتبط بها) ─────────────────────
 *
 * `Regulation571EditTrans` — the EDITABLE FeatureServer behind the requests workflow.
 * Shared by two features (Requests lists/creates the rows; Map stores and reloads the
 * CAD parcel for the open request), which is why it lives in lib and not in either one.
 */
export const REGULATION_TRANSACTIONS_URL = getRegulationTransactionsUrl();

/**
 * Layer/table indices on that FeatureServer. Verified live 2026-09-25 via `?f=json`.
 *
 * The service models the whole workflow around ONE foreign key: every spatial layer
 * carries a `TRANSACTION_ID` string pointing back at a row of `SDI.Transaction`, wired up
 * as real ArcGIS relationship classes (`Transaction_Regulation_Polygon`, origin = layer 2).
 * That key is what keeps request 1001's CAD from ever showing up under request 1002.
 */
export const REGULATION_LAYERS = {
  /** 0 — الحد التنظيمي خارج الموقع: the part of the parcel OUTSIDE the regulation boundary. */
  BOUNDARY_OUTSIDE: 0,
  /** 1 — الحد التنظيمي داخل الموقع: the part INSIDE, plus البلدية/الحي/الاستخدام/النطاق/الحرم. */
  BOUNDARY_INSIDE: 1,
  /** 2 — معاملات تنظيمية: THE CAD parcel polygon for a transaction (polygon, WKID 32637). */
  TRANSACTION_PARCEL: 2,
  /** 3 — SDI.Workflow_Steps: the step GRAPH (CURRENT_STEPS → NEXT_STEPS). A shared lookup,
   *  not per-request history — it carries no TRANSACTION_ID. */
  WORKFLOW_STEPS_TABLE: 3,
  /** 5 — SDI.Transaction: the request rows themselves (a table, with attachments). */
  TRANSACTIONS_TABLE: 5,
  /** 6 — SDI.EMPLOYEES: municipality staff, keyed for admin login by IDENTITY_NO and
   *  carrying the DEPT_ID a request is routed to. Read server-side only. */
  EMPLOYEES_TABLE: 6,
  /** 7 — SDI.DEPARTMENTS: DEPT_ID → DEPT_NAME, for labelling a department. */
  DEPARTMENTS_TABLE: 7,
  /** 8 — QualifiedEngineeringOfficesCon: the register of qualified engineering offices
   *  (116 rows), keyed for login by NATIONALNUMBER. Read server-side only — see
   *  src/server/engineeringOffices. */
  ENGINEERING_OFFICES_TABLE: 8,
} as const;

/** The foreign key every regulation layer uses to point back at a request row. */
export const TRANSACTION_ID_FIELD = "TRANSACTION_ID";

/** Full URL of one layer/table on the transactions FeatureServer. */
export function regulationLayerUrl(layerId: number): string {
  return `${REGULATION_TRANSACTIONS_URL}/${layerId}`;
}
