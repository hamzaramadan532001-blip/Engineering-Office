"use client";

import Graphic from "@arcgis/core/Graphic";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { Button, Modal, Stack, Text } from "@makkah-municipality-gis/ui";
import { useForm } from "@mantine/form";
import { useRef, useState } from "react";
import { HiOutlineCheckCircle, HiOutlineDocumentArrowUp } from "react-icons/hi2";
import { activeOfficeStore } from "@/lib/activeOffice/store";
import { regulationLayerUrl, REGULATION_LAYERS } from "@/lib/arcgis";
import { resolveStepForNewRequest } from "./workflow";
import { getArcgisErrorMessage } from "./arcgisError";
import styles from "./RequestFormModal.module.scss";
import { requestFormSchema, zodResolver } from "./schema";
import {
  REQUEST_FIELDS,
  REQUEST_OUT_FIELDS,
  REQUEST_STATUS,
  toRequestRow,
  type RequestRow,
} from "./selectors";

type RequestFormModalProps = {
  opened: boolean;
  onClose: () => void;
  onCreated?: (row: RequestRow) => void;
};

const REQUEST_LAYER_URL = regulationLayerUrl(REGULATION_LAYERS.TRANSACTIONS_TABLE);

const DESCRIPTION_FIELD = REQUEST_FIELDS.description;


export default function RequestFormModal({ opened, onClose, onCreated }: RequestFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      description: "",
      approvalsFile: null as File | null,
    },
    validate: zodResolver(requestFormSchema),
    validateInputOnBlur: true,
  });

  const resetAndClose = () => {
    form.reset();
    setSubmitted(false);
    setSubmitError(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const handleChooseFile = () => fileInputRef.current?.click();

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    form.setFieldValue("approvalsFile", file);
    form.validateField("approvalsFile");
  };

  const descriptionProps = form.getInputProps("description");

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);

    try {
      const featureLayer = new FeatureLayer({
        url: REQUEST_LAYER_URL,
        outFields: ["*"],
      });

      await featureLayer.load();

      if (!featureLayer.capabilities.operations?.supportsAdd) {
        throw new Error("الخدمة لا تسمح بإضافة طلبات جديدة.");
      }

      if (!featureLayer.capabilities.data?.supportsAttachment) {
        throw new Error("الخدمة لا تسمح بإرفاق الملفات.");
      }

      if (!values.approvalsFile) {
        throw new Error("يجب اختيار ملف الموافقات.");
      }

      // مسار العمل: the entry step is read from the SDI.Workflow_Steps lookup rather than
      // hardcoded, so the step vocabulary stays owned by the service. Resolves to null
      // while that table is empty — see workflow.ts.
      const workflowStep = await resolveStepForNewRequest();

      // The request belongs to the signed-in office. USER_ID carries that office's
      // الرقم الوطني, which is exactly what the list filters on — so a request created
      // without it would be invisible to its own owner.
      const office = activeOfficeStore.getSnapshot() ?? (await activeOfficeStore.hydrate());

      if (!office) {
        throw new Error("تعذّر تحديد المكتب الهندسي الحالي — الرجاء تسجيل الدخول مرة أخرى.");
      }

      // ONE timestamp for the whole submission, so DATE_ and REQUEST_NO can never
      // disagree about when the request was created — two separate Date.now() calls
      // could land either side of a millisecond boundary.
      const submittedAt = Date.now();

      const featureToAdd = new Graphic({
        attributes: {
          // Stored in the real backend table field: DESCRIPTION (الوصف).
          [DESCRIPTION_FIELD]: values.description,
          // A submitted request is NEW and dated now. Both fields were being left NULL,
          // which made the list fall back to "today" on every load and show every request
          // as "جديد" whatever its real state.
          [REQUEST_FIELDS.status]: REQUEST_STATUS.NEW,
          [REQUEST_FIELDS.date]: submittedAt,
          // رقم الطلب — the creation timestamp in epoch milliseconds. REQUEST_NO is a
          // STRING(150) on the service, so it is written as text: sending a number would
          // rely on the server coercing it.
          [REQUEST_FIELDS.requestNo]: String(submittedAt),
          // Only written when the lookup actually resolved a step — never a guessed label.
          ...(workflowStep ? { [REQUEST_FIELDS.workflowSteps]: workflowStep } : {}),
          [REQUEST_FIELDS.userId]: office.nationalNumber,
        },
      });

      console.log("[requests] sending request to backend:", {
        layerUrl: REQUEST_LAYER_URL,
        description: values.description,
        workflowStep,
        userId: office.nationalNumber,
        requestNo: String(submittedAt),
        fileName: values.approvalsFile.name,
        fileSize: values.approvalsFile.size,
      });

      // 1) Create the request row in SDI.Transaction (FeatureServer/5).
     const editResult = await featureLayer.applyEdits({
  addFeatures: [featureToAdd],
});

      console.log("[requests] applyEdits response:", editResult);

      const addedResult = editResult.addFeatureResults?.[0];

      if (!addedResult || addedResult.objectId == null || addedResult.error) {
        throw new Error(
          addedResult?.error?.message ?? "تعذّر إنشاء الطلب في FeatureServer.",
        );
      }

      const objectId = addedResult.objectId;

      console.log("[requests] feature added successfully:", {
        objectId,
        addFeatureResult: addedResult,
      });

      // applyEdits gives us the OBJECTID. Query the actual backend row so the
      // attachment is attached to the feature that was really created.
      const addedFeatureSet = await featureLayer.queryFeatures({
        objectIds: [objectId],
        outFields: REQUEST_OUT_FIELDS,
        returnGeometry: false,
      });

      const addedFeature = addedFeatureSet.features[0];

      if (!addedFeature) {
        throw new Error("تم إنشاء الطلب لكن تعذّر استرجاع الـFeature المضاف.");
      }

      console.log("[requests] feature fetched from backend:", {
        objectId,
        attributes: addedFeature.attributes,
      });

      // 2) Store the PDF as an attachment on the same backend row.
      const attachmentForm = new FormData();
      attachmentForm.set("attachment", values.approvalsFile);
      attachmentForm.set("f", "json");

      const attachmentResult = await featureLayer.addAttachment(
        addedFeature,
        attachmentForm,
      );

      console.log("[requests] addAttachment response:", attachmentResult);

      if (attachmentResult.error) {
        throw new Error(
          attachmentResult.error.message ??
            "تم إنشاء الطلب لكن تعذّر رفع ملف الموافقات.",
        );
      }

      console.log("[requests] request stored successfully in backend:", {
        objectId,
        description: addedFeature.attributes?.[DESCRIPTION_FIELD],
        attachment: {
          fileName: values.approvalsFile.name,
          fileSize: values.approvalsFile.size,
          addAttachmentResult: attachmentResult,
        },
      });

      // Build the optimistic row from the attributes the backend actually stored, via
      // the SAME mapper the list query uses. Hand-shaping it here is what dropped the
      // description: the row went into the table without one, so a just-added request
      // showed "—" until a reload re-queried it. Going through `toRequestRow` also keeps
      // the date and status honest — they now come from the row, not from guesses.
      onCreated?.(toRequestRow(addedFeature.attributes, objectId));

      setSubmitted(true);
    } catch (error) {
      console.error("[requests] submit failed:", error);
      setSubmitError(getArcgisErrorMessage(error, "تعذّر إرسال الطلب. حاول مرة أخرى."));
    } finally {
      setSubmitting(false);
    }
  });

  if (submitted) {
    return (
      <Modal opened={opened} onClose={resetAndClose} title="إضافة طلب" centered>
        <Stack align="center" gap="sm" py="md">
          <HiOutlineCheckCircle size={40} className={styles.successIcon} />
          <Text fw={600}>تم إرسال الطلب بنجاح</Text>
          <span className={styles.label}>الرجاء الانتقال للخريطة لإضافة ملف الكاد</span>
          <Button type="button" fullWidth onClick={resetAndClose}>
            إغلاق
          </Button>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={resetAndClose} title="إضافة طلب" centered>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <div className={styles.field}>
            <label htmlFor="request-description" className={styles.label}>
              وصف الطلب
            </label>
            <textarea
              id="request-description"
              className={styles.textarea}
              rows={4}
              key={form.key("description")}
              defaultValue={descriptionProps.defaultValue}
              onChange={descriptionProps.onChange}
              onBlur={descriptionProps.onBlur}
            />
            {form.errors.description && (
              <Text size="xs" className={styles.errorText}>
                {form.errors.description}
              </Text>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>ملف الموافقات</span>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileSelected}
              className={styles.hiddenInput}
            />

            <div className={styles.fileRow}>
              <Text size="sm" c="dimmed" className={styles.fileName}>
                {selectedFile ? selectedFile.name : "لم يتم اختيار ملف"}
              </Text>
              <Button
                type="button"
                size="compact-sm"
                variant="default"
                onClick={handleChooseFile}
                disabled={submitting}
              >
                <HiOutlineDocumentArrowUp size={16} />
                <span>اختيار ملف PDF</span>
              </Button>
            </div>

            {form.errors.approvalsFile && (
              <Text size="xs" className={styles.errorText}>
                {form.errors.approvalsFile}
              </Text>
            )}
          </div>

          {submitError && (
            <Text size="xs" className={styles.errorText}>
              {submitError}
            </Text>
          )}

          <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
            {submitting ? "جاري إرسال الطلب..." : "إرسال الطلب"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
