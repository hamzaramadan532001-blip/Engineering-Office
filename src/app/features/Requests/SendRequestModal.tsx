"use client";

/**
 * "إرسال الطلب" — attach a PDF and move the request to its next workflow step.
 *
 * Presentation only: the file is validated here (shared `pdfFileSchema`, so it cannot drift
 * from the one the "إضافة طلب" form enforces), and everything else is handed to
 * `advanceRequestWorkflow`. The step decision belongs to the service's workflow graph, not
 * to this component.
 */

import { Button, Modal, Stack, Text } from "@makkah-municipality-gis/ui";
import { useState } from "react";
import { HiOutlineCheckCircle, HiOutlineDocumentArrowUp } from "react-icons/hi2";
import { advanceRequestWorkflow, NoNextStepError } from "./advanceWorkflow";
import { getArcgisErrorMessage } from "./arcgisError";
import styles from "./RequestFormModal.module.scss";
import { pdfFileSchema } from "./schema";
import type { RequestRow } from "./selectors";

const COPY = {
  title: "إرسال الطلب",
  currentStep: "الخطوة الحالية:",
  noCurrentStep: "لم تبدأ بعد",
  fileLabel: "الملف المرفق (PDF)",
  noFile: "لم يتم اختيار ملف",
  choose: "اختيار ملف PDF",
  send: "إرسال",
  sending: "جاري الإرسال...",
  success: "تم الإرسال بنجاح",
  close: "إغلاق",
} as const;

export type SendRequestModalProps = {
  /** The request being sent. `null` closes the modal. */
  request: RequestRow | null;
  onClose: () => void;
  /** Called after a successful send so the list re-reads the new step. */
  onSent?: () => void;
};

export default function SendRequestModal({ request, onClose, onSent }: SendRequestModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setFile(null);
    setFileError(null);
    setSending(false);
    setSubmitError(null);
    setSent(false);
  };

  // No page reload after a send: `onSent` already re-reads the list from the service, so
  // the new step and status show without throwing away the rest of the app's state.
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setSubmitError(null);

    if (!picked) {
      setFile(null);
      setFileError(null);
      return;
    }

    const parsed = pdfFileSchema.safeParse(picked);
    if (!parsed.success) {
      setFile(null);
      setFileError(parsed.error.issues[0]?.message ?? "ملف غير صالح.");
      return;
    }

    setFile(picked);
    setFileError(null);
  };

  const handleSend = async () => {
    if (!request || !file) return;

    setSending(true);
    setSubmitError(null);

    try {
      await advanceRequestWorkflow(request.id, file);
      setSent(true);
      onSent?.();
    } catch (error) {
      console.error("[requests] failed to send the request:", error);

      // A missing/terminal step is a configuration answer, not a transport fault — show it
      // verbatim instead of running it through the ArcGIS error decoder.
      setSubmitError(
        error instanceof NoNextStepError
          ? error.message
          : getArcgisErrorMessage(error, "تعذّر إرسال الطلب. حاول مرة أخرى."),
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Modal opened={request !== null} onClose={handleClose} title={COPY.title} centered>
        <Stack align="center" gap="sm" py="md">
          <HiOutlineCheckCircle size={40} className={styles.successIcon} />
          <Text fw={600}>{COPY.success}</Text>
          <Button type="button" fullWidth onClick={handleClose}>
            {COPY.close}
          </Button>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal opened={request !== null} onClose={handleClose} title={COPY.title} centered>
      <Stack gap="sm">
        <div className={styles.field}>
          <span className={styles.label}>
            {`${COPY.currentStep} ${request?.workflowStep ?? COPY.noCurrentStep}`}
          </span>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{COPY.fileLabel}</span>

          <input
            id="send-request-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFile}
            className={styles.hiddenInput}
          />

          <div className={styles.fileRow}>
            <Text size="sm" c="dimmed" className={styles.fileName}>
              {file ? file.name : COPY.noFile}
            </Text>
            <Button
              type="button"
              size="compact-sm"
              variant="default"
              disabled={sending}
              onClick={() => document.getElementById("send-request-file")?.click()}
            >
              <HiOutlineDocumentArrowUp size={16} />
              <span>{COPY.choose}</span>
            </Button>
          </div>

          {fileError && (
            <Text size="xs" className={styles.errorText}>
              {fileError}
            </Text>
          )}
        </div>

        {submitError && (
          <Text size="xs" className={styles.errorText}>
            {submitError}
          </Text>
        )}

        <Button
          type="button"
          fullWidth
          loading={sending}
          disabled={sending || !file}
          onClick={() => void handleSend()}
        >
          {sending ? COPY.sending : COPY.send}
        </Button>
      </Stack>
    </Modal>
  );
}
