/**
 * Arabic copy for the permission notices — one table so a wording change is one edit.
 * Every error code carries its string, so a new code is a type error (rule 15).
 */
import type { PermissionsErrorCode } from "./types";

/** UNENFORCED_* wording is pending sign-off (PERM-21). */
export const PERMISSIONS_COPY = {
  ERROR_TITLE: "تعذّر تحميل الصلاحيات",
  ERROR_HINT: "قد تكون بعض الأدوات والطبقات مخفية حتى تنجح المحاولة.",
  ERROR_RETRY: "إعادة المحاولة",
  UNENFORCED_TITLE: "الصلاحيات غير مفعّلة",
  UNENFORCED_BODY:
    "تنبيه: صلاحيات المستخدمين غير مفعّلة حالياً — جميع الأدوات والطبقات ظاهرة للجميع.",
} as const;

export const PERMISSIONS_ERROR_DETAIL: Record<PermissionsErrorCode, string> = {
  network: "تعذّر الاتصال بالخادم.",
  unauthenticated: "انتهت الجلسة. الرجاء تسجيل الدخول من جديد.",
  upstream: "الخدمة لم تستجب. راجع مدير النظام.",
};
