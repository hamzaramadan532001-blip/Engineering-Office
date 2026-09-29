import clsx from "clsx";
import styles from "../styles.module.scss";

export default function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className={clsx(styles.subTools, styles.tools)}>{children}</div>;
}
