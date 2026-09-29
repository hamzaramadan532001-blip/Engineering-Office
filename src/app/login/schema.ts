import { z } from "zod";

/**
 * The number typed at login. Ten digits, allowing a 1/2 prefix (a personal national id) as
 * well as the 7 prefix every الرقم الوطني in the qualified-offices register carries.
 *
 * The shape is deliberately permissive: whether a number grants access is decided by the
 * register (layer 8), not by its prefix, so the form validates only that it LOOKS like an
 * id and lets the server answer. A well-formed number that is not in the register is
 * refused with "ليس لديك صلاحية الدخول".
 */
const loginIdentifierSchema = z
  .string()
  .trim()
  .regex(/^[127]\d{9}$/, "رقم مؤلف من 10 أرقام يبدأ بـ 1 أو 2 أو 7");

/** Login takes one identifier, checked against the qualified-offices register. */
export const loginSchema = z.object({
  nationalId: loginIdentifierSchema,
});

export type LoginValues = z.infer<typeof loginSchema>;

// Minimal zod → @mantine/form resolver (avoids an extra dependency).
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
