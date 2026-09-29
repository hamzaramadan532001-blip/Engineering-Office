import { z } from "zod";

const MAX_FILE_SIZE_MB = 10;

/**
 * "إضافة طلب" form: a free-text description plus a required approvals file
 * (PDF only). Validated client-side before the request is sent to the API.
 */
/**
 * A required PDF attachment. Extracted so the "إضافة طلب" form and the workflow-advance
 * popup enforce ONE definition of "an acceptable file" — the two would otherwise drift on
 * the size limit or the type check.
 */
export const pdfFileSchema = z
  .instanceof(File, { message: "يجب رفع ملف PDF" })
  .refine(
    (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    { message: "يجب أن يكون الملف بصيغة PDF فقط" },
  )
  .refine((file) => file.size <= MAX_FILE_SIZE_MB * 1024 * 1024, {
    message: `الحد الأقصى لحجم الملف ${MAX_FILE_SIZE_MB} ميجابايت`,
  });

export const requestFormSchema = z.object({
  description: z.string().trim().min(1, "وصف الطلب مطلوب"),
  approvalsFile: pdfFileSchema,
});

export type RequestFormValues = z.infer<typeof requestFormSchema>;

// Minimal zod → @mantine/form resolver (same approach as `app/login/schema.ts`,
// duplicated here so this feature doesn't reach into the login folder).
export function zodResolver<T extends z.ZodType>(schema: T) {
  return (values: unknown): Record<string, string> => {
    const result = schema.safeParse(values);
    if (result.success) {
      return {};
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (path && !(path in errors)) {
        errors[path] = issue.message;
      }
    }
    return errors;
  };
}
