"use client";

/**
 * The form shown when "تصدير PDF" is pressed — the details the report needs that the drawing
 * cannot supply, grouped into the same sections they occupy on the sheet.
 *
 * Presentation only: it collects `ReportFormValues` and hands them back. The caller writes
 * them into the sheet and then exports, so what is rasterised is what was typed.
 */

import { Button, Modal, Stack, Text } from "@makkah-municipality-gis/ui";
import Image from "next/image";
import { useEffect, useState } from "react";
import { readPhotoFile } from "./buildingPhotos";
import styles from "./CadOperations.module.scss";
import { COPY } from "./constants";
import {
  BUILDING_PHOTO_COUNT,
  DIRECTION_KEYS,
  EMPTY_REPORT_FORM,
  validateReportForm,
  type BuildingPhotos,
  type ReportFormErrors,
  type ReportFormValues,
} from "./reportForm";
import type { Direction, ReportGeometry } from "./reportGeometry";

const REPORT = COPY.intersect.context.report;
const FORM = REPORT.form;

const DIRECTION_LABELS: Record<Direction, string> = {
  north: REPORT.limits.north,
  south: REPORT.limits.south,
  east: REPORT.limits.east,
  west: REPORT.limits.west,
};

export type ReportFormModalProps = {
  opened: boolean;
  /** Pre-fills the form when it is reopened, so nothing typed is lost between exports. */
  initialValues: ReportFormValues;
  /** Used only to show each direction's measured length as the placeholder. */
  geometry: ReportGeometry | null;
  exporting: boolean;
  onCancel: () => void;
  onSubmit: (values: ReportFormValues) => void;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  error?: string;
}) {
  return (
    <label className={styles.formField}>
      <span className={styles.formLabel}>{label}</span>
      <input
        className={`${styles.formInput} ${error ? styles.formInputError : ""}`}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span className={styles.formError}>{error}</span>}
    </label>
  );
}

/** One building-photo slot: a thumbnail once attached, a file picker, and a remove button. */
function PhotoSlot({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setReadError("");
    try {
      onChange(await readPhotoFile(file));
    } catch (photoError) {
      console.warn("[CAD ops] building photo could not be read:", photoError);
      setReadError(FORM.photoReadFailed);
    } finally {
      setReading(false);
    }
  };

  const shownError = readError || error;

  return (
    <div className={styles.formPhotoSlot}>
      <span className={styles.formLabel}>{label}</span>

      <div
        className={`${styles.formPhotoPreview} ${shownError ? styles.formPhotoPreviewError : ""}`}
      >
        {value ? (
          <Image src={value} alt={label} fill unoptimized className={styles.formPhotoImage} />
        ) : (
          <span className={styles.formPhotoEmpty}>{reading ? FORM.readingPhoto : "—"}</span>
        )}
      </div>

      <div className={styles.formPhotoActions}>
        <label className={styles.formPhotoPick}>
          {value ? FORM.replacePhoto : FORM.choosePhoto}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={reading}
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              // Cleared so choosing the same file again still fires a change.
              event.target.value = "";
            }}
          />
        </label>
        {value && (
          <button type="button" className={styles.formPhotoRemove} onClick={() => onChange("")}>
            {FORM.removePhoto}
          </button>
        )}
      </div>

      {shownError && <span className={styles.formError}>{shownError}</span>}
    </div>
  );
}

export default function ReportFormModal({
  opened,
  initialValues,
  geometry,
  exporting,
  onCancel,
  onSubmit,
}: ReportFormModalProps) {
  const [values, setValues] = useState<ReportFormValues>(initialValues);
  /** Populated on the first submit attempt. Until then the form shows no red — nobody
   *  should be told a field is wrong before they have had a chance to fill it. */
  const [errors, setErrors] = useState<ReportFormErrors>({});

  // Re-seed each time it opens: the caller owns the saved values, this is only the draft.
  useEffect(() => {
    if (opened) {
      setValues(initialValues);
      setErrors({});
    }
  }, [opened, initialValues]);

  const handleSubmit = () => {
    const found = validateReportForm(values);
    setErrors(found);

    // Nothing is exported while a required field is missing or malformed: a signed municipal
    // document with a mistyped id looks answered, which is worse than an obviously blank one.
    if (Object.keys(found).length > 0) return;

    onSubmit(values);
  };

  /** Clearing an error as soon as the field is corrected keeps the red from lingering. */
  const clearError = (key: string) =>
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const setOwner = (key: keyof ReportFormValues["owner"], next: string) => {
    clearError(`owner.${key}`);
    setValues((current) => ({ ...current, owner: { ...current.owner, [key]: next } }));
  };

  const setOffice = (key: keyof ReportFormValues["office"], next: string) => {
    clearError(`office.${key}`);
    setValues((current) => ({ ...current, office: { ...current.office, [key]: next } }));
  };

  const setProperty = (key: keyof ReportFormValues["property"], next: string) => {
    clearError(`property.${key}`);
    setValues((current) => ({ ...current, property: { ...current.property, [key]: next } }));
  };

  const setPhoto = (index: number, next: string) => {
    clearError(`photos.${index}`);
    setValues((current) => {
      const photos = [...current.photos] as BuildingPhotos;
      photos[index] = next;
      return { ...current, photos };
    });
  };

  const setBorder = (direction: Direction, next: string) => {
    clearError(`borders.${direction}`);
    setValues((current) => ({
      ...current,
      borders: { ...current.borders, [direction]: next },
    }));
  };

  /** The measured length, shown as read-only text beside each direction — it comes from the
   *  drawing, so it is reported here rather than asked for. */
  const measured = (direction: Direction) => {
    const value = geometry?.totalDirectionLengths[direction];
    return value && value > 0 ? value.toFixed(2) : "—";
  };

  return (
    <Modal opened={opened} onClose={onCancel} title={FORM.title} size="lg" centered>
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          {FORM.intro}
        </Text>

        <section className={styles.formSection}>
          <div className={styles.formSectionTitle}>{FORM.ownerSection}</div>
          <Field
            label={REPORT.owner.name}
            value={values.owner.name}
            onChange={(next) => setOwner("name", next)}
            error={errors["owner.name"]}
          />
          <Field
            label={REPORT.owner.nationalId}
            value={values.owner.nationalId}
            inputMode="numeric"
            onChange={(next) => setOwner("nationalId", next)}
            error={errors["owner.nationalId"]}
          />
          <Field
            label={REPORT.owner.mobile}
            value={values.owner.mobile}
            inputMode="tel"
            onChange={(next) => setOwner("mobile", next)}
            error={errors["owner.mobile"]}
          />
          <Field
            label={REPORT.owner.email}
            value={values.owner.email}
            type="email"
            inputMode="email"
            onChange={(next) => setOwner("email", next)}
            error={errors["owner.email"]}
          />
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionTitle}>{FORM.propertySection}</div>
          <Field
            label={REPORT.property.use}
            value={values.property.use}
            onChange={(next) => setProperty("use", next)}
            error={errors["property.use"]}
          />
          <Field
            label={REPORT.property.siteContents}
            value={values.property.siteContents}
            onChange={(next) => setProperty("siteContents", next)}
          />
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionTitle}>{FORM.officeSection}</div>
          <Field
            label={FORM.engineerName}
            value={values.office.engineerName}
            onChange={(next) => setOffice("engineerName", next)}
            error={errors["office.engineerName"]}
          />
          <Field
            label={FORM.managerName}
            value={values.office.managerName}
            onChange={(next) => setOffice("managerName", next)}
            error={errors["office.managerName"]}
          />
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionTitle}>{FORM.bordersSection}</div>
          <Text size="xs" c="dimmed">
            {FORM.bordersHint}
          </Text>

          {DIRECTION_KEYS.map((direction) => (
            <div key={direction} className={styles.formDirectionRow}>
              <span className={styles.formDirectionLabel}>{DIRECTION_LABELS[direction]}</span>
              <Field
                label={FORM.borderColumn}
                value={values.borders[direction]}
                onChange={(next) => setBorder(direction, next)}
                error={errors[`borders.${direction}`]}
              />
              <span className={styles.formMeasured}>
                {`${FORM.lengthColumn}: ${measured(direction)}`}
              </span>
            </div>
          ))}
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionTitle}>{FORM.photosSection}</div>
          <Text size="xs" c="dimmed">
            {FORM.photosHint}
          </Text>

          <div className={styles.formPhotos}>
            {Array.from({ length: BUILDING_PHOTO_COUNT }, (_, index) => (
              <PhotoSlot
                key={index}
                label={FORM.photoSlot(index)}
                value={values.photos[index]}
                onChange={(next) => setPhoto(index, next)}
                error={errors[`photos.${index}`]}
              />
            ))}
          </div>
        </section>

        <div className={styles.operationActions}>
          <Button variant="default" size="compact-sm" onClick={onCancel} disabled={exporting}>
            {FORM.cancel}
          </Button>
          <Button size="compact-sm" loading={exporting} onClick={handleSubmit}>
            {exporting ? FORM.exporting : FORM.submit}
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}

export { EMPTY_REPORT_FORM };
