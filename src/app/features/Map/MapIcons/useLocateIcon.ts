import { notifications } from "@makkah-municipality-gis/ui";
import { useCallback } from "react";
import { getMapElement } from "../utils";

/**
 * Street-level target scale for the locate zoom. A scale (not a zoom level) because the
 * view runs on the cached UTM 32637 tiling scheme, whose zoom indices don't match
 * Web Mercator levels.
 */
const LOCATE_SCALE = 10000;
const NOTIFICATION_AUTO_CLOSE_MS = 4000;
/** One shared id so repeated clicks update the same notification instead of stacking. */
const LOCATE_NOTIFICATION_ID = "map-locate";

/** GeolocationPositionError.code → Arabic user copy. */
const GEOLOCATION_ERROR_COPY: Record<number, string> = {
  1: "تم رفض صلاحية الوصول إلى الموقع",
  2: "تعذر تحديد الموقع — تأكد من تفعيل خدمة GPS",
  3: "انتهت مهلة الحصول على الموقع",
};

function notifyLoading(message: string) {
  notifications.show({
    id: LOCATE_NOTIFICATION_ID,
    message,
    loading: true,
    autoClose: false,
    withCloseButton: false,
  });
}

function notifyResult(message: string, color: "green" | "red") {
  // `update` so the loading notification morphs in place; falls back to `show`
  // when there is nothing to update (e.g. the early pre-flight errors).
  const updated = notifications.update({
    id: LOCATE_NOTIFICATION_ID,
    message,
    color,
    loading: false,
    autoClose: NOTIFICATION_AUTO_CLOSE_MS,
  });
  if (updated === undefined) {
    notifications.show({
      id: LOCATE_NOTIFICATION_ID,
      message,
      color,
      autoClose: NOTIFICATION_AUTO_CLOSE_MS,
    });
  }
}

/**
 * Pans the map to the browser's geolocation, reporting progress and errors
 * (all Arabic) through the design system's Mantine notifications.
 */
export function useLocateIcon() {
  const locate = useCallback(() => {
    const mapElement = getMapElement();
    if (!mapElement) {
      notifyResult("الخريطة ليست جاهزة بعد", "red");
      return;
    }
    if (!navigator.geolocation) {
      notifyResult("المتصفح لا يدعم خدمة تحديد الموقع", "red");
      return;
    }

    notifyLoading("جارٍ تحديد موقعك الحالي...");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapElement
          .goTo(
            { center: [coords.longitude, coords.latitude], scale: LOCATE_SCALE },
            { animate: true, duration: 1200 },
          )
          .then(() => notifyResult("تم الانتقال إلى موقعك الحالي", "green"))
          .catch((err) => {
            console.warn("Locate goTo error:", err);
            notifyResult("تعذر الانتقال إلى موقعك", "red");
          });
      },
      (err) => {
        notifyResult(GEOLOCATION_ERROR_COPY[err.code] ?? "تعذر تحديد موقعك الحالي", "red");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, []);

  return { locate };
}
