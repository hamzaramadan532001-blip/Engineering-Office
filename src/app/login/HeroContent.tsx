// login/HeroContent.tsx
import { Logo } from "@makkah-municipality-gis/ui";
import {
  HiOutlineUsers,
  HiOutlineSquare3Stack3D,
  HiOutlineDocumentText,
} from "react-icons/hi2";
import styles from "./login.module.scss";



// Static hero content: logo pinned top-right, title/subtitle/features
// centered as one block in the remaining vertical space.
export default function HeroContent() {
  return (
    <div className={styles.heroContent}>
      <div className={styles.heroLogo}>
        {/* <Logo src="/figma-assets/logos/logo-horizontal-light-3.png" width={220} /> */}
        <Logo src="/Holy_Makkah_Municipality_Logo_Dark.png" width={220} />
      </div>

      <div className={styles.heroBody}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>تسجيل مكتب هندسي جديد</h1>
          
        </div>

      
      </div>
    </div>
  );
}