"use client";

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { Button } from "@makkah-municipality-gis/ui";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  HiOutlineClipboardDocumentCheck,
  HiOutlineDocumentText,
  HiOutlineMagnifyingGlass,
  HiOutlineMap,
  HiOutlinePaperAirplane,
  HiOutlinePlus,
} from "react-icons/hi2";
import { activeOfficeStore } from "@/lib/activeOffice/store";
import { fetchWorkflowSteps, nextStepAfter, type WorkflowStep } from "./workflow";
import { regulationLayerUrl, REGULATION_LAYERS } from "@/lib/arcgis";
import { getArcgisErrorMessage } from "./arcgisError";
import RequestAttachmentsModal from "./RequestAttachmentsModal";
import RequestFormModal from "./RequestFormModal";
import SendRequestModal from "./SendRequestModal";
import styles from "./RequestsView.module.scss";
import {
  REQUEST_FIELDS,
  REQUEST_OUT_FIELDS,
  toRequestRow,
  type RequestRow,
} from "./selectors";

export type { RequestRow };

const REQUEST_LAYER_URL = regulationLayerUrl(REGULATION_LAYERS.TRANSACTIONS_TABLE);

const dateFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(ms: number): string {
  return dateFormatter.format(new Date(ms));
}

export type RequestsViewProps = {
  /** Opens the map on a request. The shell owns navigation, so it performs the switch and
   *  publishes the active request — this view only says which one the user picked. */
  onViewOnMap?: (request: RequestRow) => void;
};

/** USER_ID is a string field; the office number is digits from the register, but it is
 *  re-validated before being interpolated into the where-clause so nothing else can be. */
function whereOwnedBy(nationalNumber: string): string {
  if (!/^\d{1,50}$/.test(nationalNumber)) {
    throw new Error("رقم وطني غير صالح للمكتب الحالي.");
  }
  return `${REQUEST_FIELDS.userId} = '${nationalNumber}'`;
}

export default function RequestsView({ onViewOnMap }: RequestsViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [search, setSearch] = useState("");
  const office = useSyncExternalStore(
    activeOfficeStore.subscribe,
    activeOfficeStore.getSnapshot,
    activeOfficeStore.getServerSnapshot,
  );
  /** Distinguishes "the office has not been looked up yet" from "there is no office" —
   *  without it the very first render would read as signed-out and show an empty list. */
  const [officeChecked, setOfficeChecked] = useState(false);
  /** The step graph from SDI.Workflow_Steps, used to derive each request's NEXT step.
   *  Empty while that lookup has no rows — the column then reads "—". */
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** The request whose attachments popup is open, or null when none is. */
  const [attachmentsTarget, setAttachmentsTarget] = useState<number | null>(null);
  /** The request whose "إرسال" popup is open, or null when none is. */
  const [sendTarget, setSendTarget] = useState<RequestRow | null>(null);

  useEffect(() => {
    // Idempotent and cached in the store, so several mounts cost one request.
    void activeOfficeStore.hydrate().finally(() => setOfficeChecked(true));
  }, []);

  useEffect(() => {
    // Reference data, read once. A failure here only costs the "next step" column, so it
    // must never block the list itself.
    void fetchWorkflowSteps()
      .then(setWorkflowSteps)
      .catch((error) => {
        console.error("[requests] failed to read the workflow steps lookup:", error);
      });
  }, []);

  const loadRequests = useCallback(async () => {
    // Never query before the office is known: an unscoped query would briefly list EVERY
    // office's requests, which is a data leak, not just a wrong screen.
    if (!office) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const featureLayer = new FeatureLayer({
        url: REQUEST_LAYER_URL,
        outFields: ["*"],
      });

      await featureLayer.load();

      const result = await featureLayer.queryFeatures({
        // Scoped to the signed-in office — the requests screen shows only its own.
        where: whereOwnedBy(office.nationalNumber),
        outFields: REQUEST_OUT_FIELDS,
        returnGeometry: false,
        orderByFields: ["OBJECTID DESC"],
      });

      console.log("[requests] loaded from backend:", result.features);

      const rows: RequestRow[] = result.features.map((feature) =>
        toRequestRow(feature.attributes),
      );

      console.log("[requests] mapped rows:", rows);

      setRequests(rows);
    } catch (error) {
      console.error("[requests] failed to load from backend:", error);

      // Name the actual cause (expired token vs. service 500 vs. no permission) instead of
      // one catch-all sentence — they need completely different fixes. See arcgisError.ts.
      setLoadError(getArcgisErrorMessage(error, "تعذّر تحميل الطلبات من الخادم."));
    } finally {
      setLoading(false);
    }
  }, [office]);

  useEffect(() => {
    if (!officeChecked) return;
    void loadRequests();
  }, [loadRequests, officeChecked]);

  const handleCreated = (row: RequestRow) => {
    setRequests((prev) => [row, ...prev]);
  };

  const filtered = useMemo(() => {
    const query = search.trim();

    if (!query) {
      return requests;
    }

    return requests.filter((request) =>
      String(request.id).includes(query),
    );
  }, [requests, search]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>الطلبات</h1>

        <Button size="sm" onClick={() => setFormOpen(true)}>
          <HiOutlinePlus size={16} />
          <span>إضافة طلب</span>
        </Button>
      </header>

      {!officeChecked || loading ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <HiOutlineClipboardDocumentCheck />
          </span>

          <p className={styles.emptyTitle}>جاري تحميل الطلبات...</p>
        </div>
      ) : !office ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <HiOutlineClipboardDocumentCheck />
          </span>
          <p className={styles.emptyTitle}>تعذّر تحديد المكتب الهندسي الحالي.</p>
          <p className={styles.emptyHint}>الرجاء تسجيل الدخول مرة أخرى لعرض طلبات مكتبك.</p>
        </div>
      ) : loadError ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>تعذّر تحميل الطلبات من الخادم.</p>
          <p className={styles.emptyHint}>{loadError}</p>
          <Button size="compact-sm" variant="default" onClick={() => void loadRequests()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <HiOutlineClipboardDocumentCheck />
          </span>

          <p className={styles.emptyTitle}>
            لا توجد طلبات لعرضها حاليًا
          </p>

          <p className={styles.emptyHint}>
            سيتم عرض الطلبات هنا فور توفرها.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <HiOutlineMagnifyingGlass
                size={18}
                className={styles.searchIcon}
              />

              <input
                type="text"
                className={styles.searchInput}
                placeholder="ابحث برقم الطلب..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className={styles.empty}>لا توجد طلبات مطابقة.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>الوصف</th>
                    <th>التاريخ</th>
                    <th>الحالة</th>
                    <th>مسار العمل</th>
                    <th>الملف</th>
                    <th>الخريطة</th>
                    <th>الإرسال</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((request) => (
                    <tr key={request.id}>
                      <td className={styles.mono}>{request.id}</td>

                      <td>{request.description || "—"}</td>

                      <td>{formatDate(request.createdAt)}</td>

                      <td>
                        <span className={styles.badge}>
                          {request.status}
                        </span>
                      </td>

                      <td>
                        {request.workflowStep ? (
                          <div className={styles.workflowCell}>
                            <span className={styles.workflowCurrent}>{request.workflowStep}</span>
                            <span className={styles.workflowNext}>
                              {`التالية: ${
                                nextStepAfter(workflowSteps, request.workflowStep) ??
                                "لا يوجد (الخطوة الأخيرة)"
                              }`}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
<Button
                          type="button"
                          size="compact-sm"
                          variant="default"
                          onClick={() => setAttachmentsTarget(request.id)}
                        >
                          <HiOutlineDocumentText size={16} />
                          <span>عرض PDF</span>
                        </Button>
                      </td>

                      <td>
                        <Button
                          type="button"
                          size="compact-sm"
                          variant="light"
                          onClick={() => onViewOnMap?.(request)}
                        >
                          <HiOutlineMap size={16} />
                          <span>عرض على الخريطة</span>
                        </Button>
                      </td>

                      <td>
                        <Button
                          type="button"
                          size="compact-sm"
                          variant="light"
                          onClick={() => setSendTarget(request)}
                        >
                          <HiOutlinePaperAirplane size={16} />
                          <span>إرسال</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <RequestFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={handleCreated}
      />

      <SendRequestModal
        request={sendTarget}
        onClose={() => setSendTarget(null)}
        // Re-read the list so the موقف/مسار العمل column shows the step it just moved to.
        onSent={() => void loadRequests()}
      />

      <RequestAttachmentsModal
        requestId={attachmentsTarget}
        onClose={() => setAttachmentsTarget(null)}
      />
    </div>
  );
}

