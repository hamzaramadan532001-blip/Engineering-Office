"use client";
import { Button, Divider, Input } from "@makkah-municipality-gis/ui";
import { useForm } from "@mantine/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HiOutlineLockClosed, HiOutlineQuestionMarkCircle } from "react-icons/hi2";
import { activeOfficeStore, type ActiveOffice } from "@/lib/activeOffice/store";
import styles from "./login.module.scss";
import { loginSchema, zodResolver } from "./schema";
import { apiUrl } from "@/lib/api";

/**
 * Tries the engineering-office register first.
 *
 * Returns the office on a match, `null` when the number is not in the register (HTTP 404),
 * and THROWS when the register itself could not be reached. The caller must keep those last
 * two apart: "not registered" is a refusal, an unreachable register is a fault, and telling
 * someone they have no access because a service was down would be wrong.
 */
const COPY = {
  /** Shown when the number is simply not in the qualified-offices register. */
  noAccess: "ليس لديك صلاحية الدخول",
} as const;

async function signInAsOffice(nationalNumber: string): Promise<ActiveOffice | null> {
  const response = await fetch(apiUrl("/api/auth/office-login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalNumber }),
  });

  if (response.status === 404) return null;

  const payload = (await response.json().catch(() => ({}))) as {
    office?: ActiveOffice;
    error?: string;
  };

  if (!response.ok || !payload.office) {
    throw new Error(payload.error ?? "تعذّر التحقق من سجل المكاتب الهندسية.");
  }

  return payload.office;
}

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: { nationalId: "" },
    validate: zodResolver(loginSchema),
    validateInputOnBlur: true,
  });

  const handleSubmit = form.onSubmit(async ({ nationalId }) => {
    setSubmitError(null);
    setLoading(true);

    // The register of qualified engineering offices is the ONLY way in: a number it does
    // not hold is refused outright rather than passed to Nafath.
    try {
      const office = await signInAsOffice(nationalId);

      if (!office) {
        setSubmitError(COPY.noAccess);
        setLoading(false);
        return;
      }

      activeOfficeStore.setActive(office);
      setWelcomeName(office.name);
      // The session cookie is already set, so the main page is reachable from here.
      router.push("/");
    } catch (officeError) {
      // The register being UNREACHABLE is not the same as the number being absent from it —
      // saying "no access" during an outage would be a lie. Surface the real reason.
      setSubmitError(
        officeError instanceof Error
          ? officeError.message
          : "تعذّر التحقق من سجل المكاتب الهندسية.",
      );
      setLoading(false);
    }
  });

  return (
    <form className={styles.loginCard} onSubmit={handleSubmit} noValidate>
      <div className={styles.brandBlock}>
        <h1 className={styles.productTitle}>نظام معاملات المكاتب الهندسية</h1>
        <Divider my="md" />
      </div>

      <div className={styles.headingBlock}>
        <h2 className={styles.heading}>تسجيل الدخول</h2>
        <p className={styles.subtitle}>
          أدخل رقم الهوية الوطنية أو الرقم الوطني للمكتب الهندسي للمتابعة
        </p>
      </div>

      {welcomeName && <p className={styles.welcomeNote}>{`مرحباً ${welcomeName}`}</p>}

      <Input
        label="رقم الهوية الوطنية / الرقم الوطني"
        placeholder="1xxxxxxxxx"
        inputMode="numeric"
        maxLength={10}
        inputWrapperOrder={["label", "input", "description", "error"]}
        description={
          <span className={styles.helperText}>
            رقم مؤلف من 10 أرقام يبدأ بـ 1 أو 2 أو 7
            <HiOutlineQuestionMarkCircle size={16} />
          </span>
        }
        key={form.key("nationalId")}
        {...form.getInputProps("nationalId")}
      />

      {submitError && <p className={styles.submitError}>{submitError}</p>}

      <Button type="submit" fullWidth loading={loading} size="md">
        متابعة
      </Button>

      <div className={styles.secureNote}>
        <HiOutlineLockClosed size={12} />
        <span>اتصال آمن مشفر · مدعوم من منصة نفاذ الوطنية</span>
      </div>
    </form>
  );
}
