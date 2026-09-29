"use client";

import { useRouter } from "next/navigation";
import { HiOutlineArrowRightStartOnRectangle } from "react-icons/hi2";
import styles from "../AdminShell.module.scss";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className={styles.logoutLink}>
      <span>تسجيل الخروج</span>
      <HiOutlineArrowRightStartOnRectangle size={18} />
    </button>
  );
}