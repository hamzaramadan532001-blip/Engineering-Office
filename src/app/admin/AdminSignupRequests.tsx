"use client";
import {
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from "@makkah-municipality-gis/ui";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineDocumentText,
  HiOutlineMagnifyingGlass,
  HiOutlineMap,
} from "react-icons/hi2";
import RequestAttachmentsModal from "../features/Requests/RequestAttachmentsModal";
import type { RequestRow } from "../features/Requests/selectors";
import styles from "./admin.module.scss";
import {
  canDecide,
  isPending,
  matchesFilter,
  type DecisionFilter,
} from "./departmentRequests";
import RequestMapModal from "./RequestMapModal";
import { useDepartmentRequests } from "./useDepartmentRequests";

/**
 * "طلبات تسجيل المكاتب الهندسية" — the review queue for the signed-in admin's department.
 *
 * The chrome (search, refresh, the four tabs, the confirm and note dialogs, pagination) is
 * the screen that was already here; only the DATA behind it changed. It used to list the
 * in-memory signup-request store; it now lists the department's real transaction requests
 * from SDI.Transaction — EVERY request, each with its file and map — and its accept / reject /
 * reply actions write to the request's own STATUS and COMMENT_ fields.
 */

const TABS: { key: DecisionFilter; label: string }[] = [
  { key: "pending", label: "بانتظار الموافقة" },
  { key: "approved", label: "مقبولة" },
  { key: "rejected", label: "مرفوضة" },
  { key: "all", label: "الكل" },
];

const PAGE_SIZE = 8;

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

/** Search covers what an admin actually knows a request by: its number, the office that
 *  raised it, the description, and the reviewer's own note. */
function matchesSearch(request: RequestRow, query: string): boolean {
  const haystack = [
    String(request.id),
    request.requestNo,
    request.description,
    request.userId,
    request.comment,
    request.workflowStep,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

/** Maps a request onto the badge classes the card already defines. */
function badgeClass(request: RequestRow): string {
  if (matchesFilter(request, "approved")) return styles.badge_approved;
  if (matchesFilter(request, "rejected")) return styles.badge_rejected;
  return styles.badge_pending;
}

export default function AdminSignupRequests() {
  const {
    employee,
    employeeChecked,
    requests,
    loading,
    error,
    decidingId,
    sendingNoteId,
    reload,
    decide,
    sendNote,
  } = useDepartmentRequests();

  const [filter, setFilter] = useState<DecisionFilter>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<{
    request: RequestRow;
    status: "approved" | "rejected";
  } | null>(null);
  const [noteTarget, setNoteTarget] = useState<RequestRow | null>(null);
  /** The request whose file list / map is open, or null. */
  const [fileTarget, setFileTarget] = useState<number | null>(null);
  const [mapTarget, setMapTarget] = useState<RequestRow | null>(null);
  const [noteText, setNoteText] = useState("");

  const filtered = useMemo(() => {
    const byStatus = requests.filter((request) =>
      matchesFilter(request, filter),
    );
    return search.trim()
      ? byStatus.filter((r) => matchesSearch(r, search))
      : byStatus;
  }, [requests, filter, search]);

  const pendingCount = useMemo(
    () => requests.filter(isPending).length,
    [requests],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const closeConfirm = () => setConfirmTarget(null);
  const confirmDecide = () => {
    if (!confirmTarget) return;
    const { request, status } = confirmTarget;
    void decide(request.id, status);
    // Move to the tab the request now belongs to. Without this the row simply disappears
    // from "بانتظار الموافقة" and the decision looks like it was not saved — which is exactly
    // how it read before.
    setFilter(status === "approved" ? "approved" : "rejected");
    setConfirmTarget(null);
  };

  const closeNote = () => {
    setNoteTarget(null);
    setNoteText("");
  };
  const submitNote = () => {
    const trimmed = noteText.trim();
    if (!noteTarget || !trimmed) return;
    void sendNote(noteTarget.id, trimmed);
    // A note-reply lands on STATUS 4, which belongs to none of the three decision tabs —
    // "الكل" is where it is visible.
    setFilter("all");
    closeNote();
  };

  const requestLabel = (request: RequestRow) =>
    request.description || request.requestNo || `الطلب رقم ${request.id}`;

  /** Who the queue belongs to — without a department there is nothing to scope to, so the
   *  table is not rendered at all rather than shown empty or unscoped. */
  const departmentLine = employee
    ? `${employee.fullName} — ${employee.deptName ?? (employee.deptId ? `الإدارة رقم ${employee.deptId}` : "بدون إدارة")}`
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>طلبات تسجيل المكاتب الهندسية</h1>
          <p className={styles.subtitle}>
            راجع طلبات التسجيل الواردة من المكاتب الهندسية واقبلها أو ارفضها.
          </p>
          {departmentLine && <p className={styles.muted}>{departmentLine}</p>}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <HiOutlineMagnifyingGlass size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="ابحث بالاسم أو اسم المكتب أو رقم الهوية..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void reload()}
            disabled={loading}
          >
            <HiOutlineArrowPath
              size={16}
              className={loading ? styles.spin : undefined}
            />
            <span>تحديث</span>
          </button>
        </div>

        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tab} ${filter === tab.key ? styles.tabActive : ""}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tab.key === "pending" && pendingCount > 0 && (
                <span className={styles.tabBadge}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <div className={styles.loadingRow}>
            <Loader size={20} color="green" />
            <span>جارٍ التحميل...</span>
          </div>
        ) : employeeChecked && !employee ? (
          <p className={styles.empty}>
            هذه الجلسة غير مرتبطة بحساب موظف — سجّل الدخول برقم الهوية لعرض
            طلبات إدارتك.
          </p>
        ) : employee && !employee.deptId ? (
          <p
            className={styles.empty}
          >{`لا توجد إدارة (DEPT_ID) مسجّلة للموظف: ${employee.fullName}`}</p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>لا توجد طلبات مطابقة.</p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>الوصف</th>
                    <th>المكتب الهندسي</th>
                    <th>الملاحظة</th>
                    <th>الحالة</th>
                    <th>تاريخ الطلب</th>
                    <th>الملف </th>
                    <th> الخريطة</th>
                    <th aria-label="الإجراءات" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((request) => (
                    <DepartmentRequestRow
                      key={request.id}
                      request={request}
                      deciding={decidingId === request.id}
                      sendingNote={sendingNoteId === request.id}
                      canDecide={canDecide(request, employee?.deptId ?? null)}
                      onOpenFile={() => setFileTarget(request.id)}
                      onOpenMap={() => setMapTarget(request)}
                      onDecide={(status) =>
                        setConfirmTarget({ request, status })
                      }
                      onOpenNote={() => {
                        setNoteTarget(request);
                        setNoteText("");
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  type="button"
                  className={styles.pageArrow}
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="الصفحة السابقة"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.pageNum} ${n === currentPage ? styles.pageNumActive : ""}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className={styles.pageArrow}
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="الصفحة التالية"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        opened={!!confirmTarget}
        onClose={closeConfirm}
        title={
          confirmTarget?.status === "approved" ? "تأكيد القبول" : "تأكيد الرفض"
        }
        centered
      >
        {confirmTarget && (
          <Stack gap={16}>
            <Text>
              هل أنت متأكد من{" "}
              {confirmTarget.status === "approved" ? "قبول" : "رفض"}{" "}
              {requestLabel(confirmTarget.request)}؟
            </Text>
            <Group gap={8} justify="flex-end">
              <Button variant="default" onClick={closeConfirm}>
                إلغاء
              </Button>
              <Button
                color={confirmTarget.status === "rejected" ? "red" : undefined}
                onClick={confirmDecide}
              >
                {confirmTarget.status === "approved"
                  ? "تأكيد القبول"
                  : "تأكيد الرفض"}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <RequestAttachmentsModal
        requestId={fileTarget}
        onClose={() => setFileTarget(null)}
      />

      <RequestMapModal
        requestId={mapTarget?.id ?? null}
        label={mapTarget ? requestLabel(mapTarget) : undefined}
        onClose={() => setMapTarget(null)}
      />

      <Modal
        opened={!!noteTarget}
        onClose={closeNote}
        title="رد بملاحظة"
        centered
      >
        {noteTarget && (
          <Stack gap={12}>
            <Text size="sm" c="dimmed">
              الرد على {requestLabel(noteTarget)}
            </Text>
            <textarea
              className={styles.noteTextarea}
              placeholder="اكتب ملاحظتك للمكتب الهندسي هنا..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              maxLength={255}
              autoFocus
            />
            <Group gap={8} justify="flex-end">
              <Button variant="default" onClick={closeNote}>
                إغلاق
              </Button>
              <Button onClick={submitNote} disabled={!noteText.trim()}>
                إرسال الرد
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

function DepartmentRequestRow({
  request,
  deciding,
  sendingNote,
  canDecide,
  onDecide,
  onOpenNote,
  onOpenFile,
  onOpenMap,
}: {
  request: RequestRow;
  deciding: boolean;
  sendingNote: boolean;
  /** Pending AND on this admin's own department step — see `canDecide`. */
  canDecide: boolean;
  onDecide: (status: "approved" | "rejected") => void;
  onOpenNote: () => void;
  onOpenFile: () => void;
  onOpenMap: () => void;
}) {
  return (
    <tr>
      <td className={styles.mono}>{request.requestNo ?? request.id}</td>
      <td>{request.description || "—"}</td>
      <td className={styles.mono}>{request.userId ?? "—"}</td>
      <td>{request.comment || "—"}</td>
      <td>
        <span className={`${styles.badge} ${badgeClass(request)}`}>
          {request.status}
        </span>
      </td>
      <td>{formatDate(request.createdAt)}</td>
      <td>
        <button type="button" className={styles.pillView} onClick={onOpenFile}>
          <HiOutlineDocumentText size={14} />
          الملف
        </button>
      </td>

      <td>
        <button type="button" className={styles.pillView} onClick={onOpenMap}>
          <HiOutlineMap size={14} />
          الخريطة
        </button>
      </td>
      <td>
        {/* Actions only while the request is awaiting THIS department's decision — a decided
            request is shown, not re-decided, and one with another department is theirs. */}
        {!canDecide && isPending(request) && request.workflowStep && (
          <span
            className={styles.otherDept}
          >{`لدى: ${request.workflowStep}`}</span>
        )}
        {canDecide && (
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.pillAccept}
              disabled={deciding}
              onClick={() => onDecide("approved")}
            >
              {deciding ? <Loader size={14} color="white" /> : "قبول"}
            </button>
            <button
              type="button"
              className={styles.pillReject}
              disabled={deciding}
              onClick={() => onDecide("rejected")}
            >
              رفض
            </button>
            <button
              type="button"
              className={styles.pillNote}
              disabled={sendingNote}
              onClick={onOpenNote}
            >
              <HiOutlineChatBubbleLeftEllipsis size={14} />
              رد بملاحظة
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
