"use client";

/**
 * "عرض PDF" — every file the office has attached to one request, as a table.
 *
 * It used to open the FIRST pdf it found and ignore the rest, which hid the fact that a
 * request accumulates files: the approvals pdf at submission, then one per "إرسال" as the
 * request moves along the workflow. Request 43 already carries two. The table lists them all
 * and previews whichever is chosen.
 *
 * Files come from `/api/requests/{id}/attachments` — server-side, because the attachment
 * list and the files themselves need the server token, and because entitlement depends on
 * the session (an office may only read its own request).
 */

import { Button, Loader, Modal, Stack, Text } from "@makkah-municipality-gis/ui";
import { useCallback, useEffect, useState } from "react";
import { HiOutlineArrowTopRightOnSquare, HiOutlineDocumentText } from "react-icons/hi2";
import styles from "./RequestsView.module.scss";

const COPY = {
  title: "مرفقات الطلب",
  loading: "جاري تحميل المرفقات...",
  empty: "لا توجد مرفقات لهذا الطلب.",
  colName: "اسم الملف",
  colType: "النوع",
  colSize: "الحجم",
  colAction: "عرض",
  view: "عرض",
  openInTab: "فتح في تبويب جديد",
  close: "إغلاق",
  failed: "تعذّر تحميل قائمة المرفقات.",
} as const;

export type RequestAttachment = {
  id: number;
  name: string;
  contentType: string;
  size: number;
};

export type RequestAttachmentsModalProps = {
  /** The request whose files to list. `null` closes the modal. */
  requestId: number | null;
  onClose: () => void;
};

/** Bytes → a readable size. The service reports size in bytes and gives no date, so size and
 *  type are all the metadata there is to show. */
function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
}

/** A short label instead of the raw MIME type. */
function formatType(contentType: string): string {
  if (contentType.includes("pdf")) return "PDF";
  if (contentType.startsWith("image/")) return "صورة";
  return contentType || "—";
}

export default function RequestAttachmentsModal({
  requestId,
  onClose,
}: RequestAttachmentsModalProps) {
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const attachmentUrl = useCallback(
    (attachmentId: number) => `/api/requests/${requestId}/attachments/${attachmentId}`,
    [requestId],
  );

  useEffect(() => {
    if (requestId === null) {
      setAttachments([]);
      setError(null);
      setPreviewId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreviewId(null);

    void (async () => {
      try {
        const response = await fetch(`/api/requests/${requestId}/attachments`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { attachments?: RequestAttachment[]; error?: string }
          | null;

        if (cancelled) return;

        // Anything that is not the route's own JSON — a redirect to /login, an HTML error page —
        // is a FAILURE, never "no attachments". Reading it as an empty list is exactly how a
        // reviewer without an office session was told a request with files had none.
        if (!response.ok || response.redirected || !Array.isArray(payload?.attachments)) {
          setError(payload?.error ?? COPY.failed);
          setAttachments([]);
          return;
        }

        setAttachments(payload.attachments);
      } catch (fetchError) {
        console.error("[requests] failed to load the attachment list:", fetchError);
        if (!cancelled) setError(COPY.failed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  return (
    <Modal opened={requestId !== null} onClose={onClose} title={COPY.title} size="xl" centered>
      <Stack gap="sm">
        {loading ? (
          <div className={styles.attachmentsLoading}>
            <Loader size={20} color="green" />
            <span>{COPY.loading}</span>
          </div>
        ) : error ? (
          <Text size="sm" className={styles.attachmentsError}>
            {error}
          </Text>
        ) : attachments.length === 0 ? (
          <Text size="sm" c="dimmed">
            {COPY.empty}
          </Text>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{COPY.colName}</th>
                    <th>{COPY.colType}</th>
                    <th>{COPY.colSize}</th>
                    <th aria-label={COPY.colAction} />
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((attachment) => (
                    <tr key={attachment.id}>
                      <td className={styles.attachmentName}>
                        <HiOutlineDocumentText size={16} />
                        <span>{attachment.name}</span>
                      </td>
                      <td>{formatType(attachment.contentType)}</td>
                      <td>{formatSize(attachment.size)}</td>
                      <td>
                        <div className={styles.attachmentActions}>
                          <Button
                            type="button"
                            size="compact-sm"
                            variant={previewId === attachment.id ? "filled" : "light"}
                            onClick={() => setPreviewId(attachment.id)}
                          >
                            {COPY.view}
                          </Button>
                          <a
                            className={styles.attachmentLink}
                            href={attachmentUrl(attachment.id)}
                            target="_blank"
                            rel="noreferrer"
                            title={COPY.openInTab}
                            aria-label={COPY.openInTab}
                          >
                            <HiOutlineArrowTopRightOnSquare size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewId !== null && (
              // `key` forces a fresh frame per file — without it the browser may keep
              // showing the previous document when only the src changes.
              <iframe
                key={previewId}
                src={attachmentUrl(previewId)}
                className={styles.attachmentPreview}
                title={COPY.title}
              />
            )}
          </>
        )}

        <Button type="button" variant="default" onClick={onClose}>
          {COPY.close}
        </Button>
      </Stack>
    </Modal>
  );
}
