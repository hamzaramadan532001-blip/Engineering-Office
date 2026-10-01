"use client";

import { Button, Menu, Modal } from "@makkah-municipality-gis/ui";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HiOutlineArrowLeftStartOnRectangle, HiOutlineEnvelope, HiXMark } from "react-icons/hi2";
import { logout } from "@/lib/auth";
import { useIsMobile } from "../useIsMobile";
import { CONTACT_EMAIL, USER_AVATAR } from "./constants";
import styles from "./ProfileMenu.module.scss";
import { withBasePath } from "@/lib/api";

export default function ProfileMenu() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  function handleContact() {
    window.location.href = `mailto:${CONTACT_EMAIL}`;
  }

  const avatar = (
    <Image
      src={USER_AVATAR}
      alt="الصورة الشخصية"
      width={48}
      height={48}
      className={styles.avatarImg}
      priority
    />
  );

  if (isMobile) {
    return (
      <div className={styles.root}>
        <Button
          type="button"
          className={styles.avatarButton}
          aria-label="قائمة الحساب"
          onClick={() => setMobileOpen(true)}
        >
          {avatar}
        </Button>

        <Modal
          opened={mobileOpen}
          onClose={() => setMobileOpen(false)}
          withCloseButton={false}
          zIndex={1200}
          classNames={{
            inner: styles.sheetInner,
            content: styles.sheetContent,
            overlay: styles.sheetOverlay,
            body: styles.sheetBody,
          }}
          aria-label="قائمة الحساب"
        >
          <div className={styles.sheetHeader}>
            <span className={styles.sheetLogo}>
              <Image
                src={withBasePath("/Holy Makkah Municipality Logo.png")}
                alt="الأمانة العامة لمنطقة مكة المكرمة"
                width={150}
                height={37}
                className={`${styles.sheetLogoImg} ${styles.sheetLogoLight}`}
              />
              <Image
                src={withBasePath("/Holy_Makkah_Municipality_Logo_Dark.png")}
                alt="الأمانة العامة لمنطقة مكة المكرمة"
                width={150}
                height={37}
                className={`${styles.sheetLogoImg} ${styles.sheetLogoDark}`}
              />
            </span>
            <button
              type="button"
              className={styles.sheetClose}
              aria-label="إغلاق"
              onClick={() => setMobileOpen(false)}
            >
              <HiXMark size={22} />
            </button>
          </div>

          <div className={styles.sheetDivider} />

          <button type="button" className={styles.sheetItem} onClick={handleContact}>
            <span className={styles.itemRow}>
              <HiOutlineEnvelope className={styles.itemIcon} aria-hidden />
              <span className={styles.itemLabel}>تواصل معنا</span>
            </span>
          </button>

          <div className={styles.sheetDivider} />

          <button
            type="button"
            className={`${styles.sheetItem} ${styles.danger}`}
            disabled={loading}
            onClick={handleLogout}
          >
            <span className={styles.itemRow}>
              <HiOutlineArrowLeftStartOnRectangle className={styles.itemIcon} aria-hidden />
              <span className={styles.itemLabel}>تسجيل الخروج</span>
            </span>
          </button>
        </Modal>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Menu
        position="bottom-end"
        offset={8}
        radius="md"
        shadow="md"
        zIndex={1200}
        withinPortal
        classNames={{ dropdown: styles.dropdown, item: styles.item, divider: styles.divider }}
      >
        <Menu.Target>
          <Button type="button" className={styles.avatarButton} aria-label="قائمة الحساب">
            {avatar}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item className={styles.danger} disabled={loading} onClick={handleLogout}>
            <span className={styles.itemRow}>
              <HiOutlineArrowLeftStartOnRectangle className={styles.itemIcon} aria-hidden />
              <span className={styles.itemLabel}>تسجيل الخروج</span>
            </span>
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item onClick={handleContact}>
            <span className={styles.itemRow}>
              <HiOutlineEnvelope className={styles.itemIcon} aria-hidden />
              <span className={styles.itemLabel}>ايميل التواصل</span>
            </span>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
