"use client";

import { Loader } from "@makkah-municipality-gis/ui";
import Image from "next/image";
import styles from "./Map.module.scss";
import { withBasePath } from "@/lib/api";

/** Full-screen loading state shown while a view initializes — covers the slow 2D→3D switch. */
export default function MapLoadingOverlay({ label = "جارٍ تحميل الخريطة…" }: { label?: string }) {
  return (
    <div className={styles.mapLoadingOverlay}>
      <Image
        src={withBasePath("/Holy Makkah Municipality Logo.png")}
        alt=""
        width={240}
        height={60}
        priority
        className={styles.mapLoadingLogo}
      />
      <Loader size="md" />
      <p className={styles.mapLoadingText}>{label}</p>
    </div>
  );
}
