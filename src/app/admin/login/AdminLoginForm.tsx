"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./adminLogin.module.scss";

/**
 * Admin login by ID / residency number, checked against SDI.EMPLOYEES — the same method the
 * engineering-office login uses.
 *
 * The number that exists gets "مرحباً {الاسم}" and is taken into the dashboard; one that does
 * not is refused with "ليس لديك صلاحية الدخول". The employee's DEPT_ID comes back with the
 * login and is what scopes the dashboard to that department's requests.
 */

const COPY = {
  title: "تسجيل دخول لوحة الإدارة",
  subtitle: "أدخل رقم الهوية أو الإقامة للمتابعة",
  idLabel: "رقم الهوية / الإقامة",
  idHelp: "رقم مكوّن من 10 أرقام",
  submit: "دخول",
  submitting: "جارٍ الدخول...",
  noAccess: "ليس لديك صلاحية الدخول",
  networkError: "تعذر الاتصال بالخادم، حاول مرة أخرى",
  welcome: (name: string) => `مرحباً ${name}`,
  department: (name: string) => `الإدارة: ${name}`,
} as const;

type Employee = {
  fullName: string;
  deptId: string | null;
  deptName: string | null;
};

export default function AdminLoginForm() {
  const router = useRouter();
  const [identityNo, setIdentityNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityNo }),
      });

      // 404 = the number is simply not in SDI.EMPLOYEES. Any other failure is a fault and
      // must show its own reason rather than being reported as "no access".
      if (res.status === 404) {
        setError(COPY.noAccess);
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { employee?: Employee; error?: string }
        | null;

      if (!res.ok || !data?.employee) {
        setError(data?.error ?? COPY.noAccess);
        return;
      }

      setEmployee(data.employee);
      router.replace("/admin");
      router.refresh();
    } catch {
      setError(COPY.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.subtitle}>{COPY.subtitle}</p>

        {employee && (
          <p className={styles.welcome}>
            {COPY.welcome(employee.fullName)}
            {employee.deptName ? ` — ${COPY.department(employee.deptName)}` : ""}
          </p>
        )}

        <label className={styles.field}>
          <span>{COPY.idLabel}</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={15}
            value={identityNo}
            onChange={(e) => setIdentityNo(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
            dir="ltr"
            placeholder="1xxxxxxxxx"
          />
          <small className={styles.help}>{COPY.idHelp}</small>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={loading || !identityNo}>
          {loading ? COPY.submitting : COPY.submit}
        </button>
      </form>
    </div>
  );
}
