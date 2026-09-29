import type { IconType } from "react-icons";
import {
  HiOutlineExclamationTriangle,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlineShieldExclamation,
} from "react-icons/hi2";

/** HTTP outcomes the viewer renders a full-page screen for. */
export type StatusCode = "401" | "403" | "404" | "500";

/** Drives the icon badge colour — see the tone blocks in StatusScreen.module.scss. */
export type StatusTone = "danger" | "neutral" | "warning";

export interface StatusCopy {
  /** The status number in Arabic-Indic digits, to match the RTL UI. */
  label: string;
  title: string;
  message: string;
  tone: StatusTone;
  icon: IconType;
}

/** Every status ships its Arabic copy here, so a missing one is a type error. */
export const STATUS_COPY = {
  "401": {
    label: "٤٠١",
    title: "يلزم تسجيل الدخول",
    message: "انتهت الجلسة أو لم تسجّل الدخول بعد. سجّل الدخول عبر نفاذ للمتابعة.",
    tone: "warning",
    icon: HiOutlineLockClosed,
  },
  "403": {
    label: "٤٠٣",
    title: "لا تملك صلاحية الوصول",
    message: "صلاحيتك الحالية لا تشمل هذه الصفحة. عد إلى الخريطة أو راجع مدير النظام.",
    tone: "danger",
    icon: HiOutlineShieldExclamation,
  },
  "404": {
    label: "٤٠٤",
    title: "الصفحة غير موجودة",
    message: "تعذّر العثور على الصفحة المطلوبة. ربما نُقلت أو لم يعد الرابط صالحاً.",
    tone: "neutral",
    icon: HiOutlineMapPin,
  },
  "500": {
    label: "٥٠٠",
    title: "حدث خطأ غير متوقع",
    message:
      "تعذّر عرض هذه الصفحة بسبب خطأ في النظام. حاول مرة أخرى، وإن تكرر الخطأ راجع مدير النظام.",
    tone: "danger",
    icon: HiOutlineExclamationTriangle,
  },
} as const satisfies Record<StatusCode, StatusCopy>;

export const APP_NAME = "نظام معاملات المكاتب الهندسية";

/** Action labels shared by more than one status screen. */
export const ACTION_LABELS = {
  backToMap: "العودة إلى الخريطة",
  retry: "إعادة المحاولة",
  signIn: "تسجيل الدخول",
} as const;

/** Label for the `error.digest` a user quotes to support. */
export const ERROR_REFERENCE_LABEL = "الرقم المرجعي للخطأ";
