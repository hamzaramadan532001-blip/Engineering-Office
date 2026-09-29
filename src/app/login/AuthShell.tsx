import { LanguageToggle } from "@makkah-municipality-gis/ui";import type { ReactNode } from "react";
import HeroContent from "./HeroContent";
import styles from "./login.module.scss";

// Shared auth layout (form panel + Makkah hero), used by login and verify.
export default function AuthShell({ children }: { children: ReactNode }) {
  const now = new Date();
  // Gregorian year in Arabic-Indic digits (e.g. ٢٠٢٦).
  const gregorianYear = new Intl.NumberFormat("ar-SA-u-nu-arab", {
    useGrouping: false,
  }).format(now.getFullYear());
  // Current Hijri (Umm al-Qura) year (e.g. 1447).
  const hijriYear =
    new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", { year: "numeric" })
      .formatToParts(now)
      .find((p) => p.type === "year")?.value ?? "";

  return (
    <main className={styles.page}>
      <section className={styles.formPanel}>
        <div className={styles.formTop}>
          <LanguageToggle value="ar" />
        </div>

        {children}

        <footer className={styles.footer}>
          <span>{hijriYear}هـ</span>
          <span className={styles.dot}>·</span>
          <span>أمانة العاصمة المقدسة</span>
          <span className={styles.dot}>·</span>
          <span>MMSDI Security Module v1.2</span>
        </footer>
      </section>

      <aside className={styles.heroPanel}>
        <HeroContent />
        <span className={`${styles.circle} ${styles.circle1}`} aria-hidden />
        <span className={`${styles.circle} ${styles.circle2}`} aria-hidden />
        <span className={`${styles.circle} ${styles.circle3}`} aria-hidden />
        <p className={styles.copyright}>© {gregorianYear} روافد — جميع الحقوق محفوظة</p>
      </aside>
    </main>
  );
}