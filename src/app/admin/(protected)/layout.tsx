import { Logo } from "@makkah-municipality-gis/ui";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { HiOutlineClipboardDocumentCheck, HiOutlineMap } from "react-icons/hi2";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { readAdminSession } from "@/server/adminSession";
import styles from "../AdminShell.module.scss";
import LogoutButton from "./LogoutButton";
import { withBasePath } from "@/lib/api";


export default async function AdminLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  // Accepts BOTH shapes: the sealed employee session from the ID-number login, and the
  // legacy fixed-hash token from the email/password login — so neither path breaks.
  const session = await readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoBlock}>
          <Logo src={withBasePath("/Holy_Makkah_Municipality_Logo_Dark.png")} width={160} />
        </div>

        <nav className={styles.nav}>
          <span className={`${styles.navItem} ${styles.navItemActive}`}>
            <span>طلبات التسجيل</span>
            <HiOutlineClipboardDocumentCheck size={18} />
          </span>
        </nav>

        <Link href="/" className={styles.backLink}>
          <span>الرجوع للخريطة الرئيسية</span>
          <HiOutlineMap size={18} />
        </Link>

        <LogoutButton />
      </aside>

      <div className={styles.main}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}