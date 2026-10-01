"use client";
import { Loader } from "@makkah-municipality-gis/ui";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { NafathStatus } from "../nafath";
import { useNafathVerification } from "./useNafathVerification";
import styles from "./verify.module.scss";
import { withBasePath } from "@/lib/api";

interface VerifyClientProps {
  transactionId: string;
  initialNumber: string;
  expiresInSec: number;
}

export default function VerifyClient({
  transactionId,
  initialNumber,
  expiresInSec,
}: VerifyClientProps) {
  const router = useRouter();
  const onApproved = useCallback(() => router.replace("/"), [router]);

  const { number, status, countdown, canResend, resending, resend } = useNafathVerification({
    transactionId,
    initialNumber,
    expiresInSec,
    onApproved,
  });

  return (
    <div className={styles.verify}>
      <div className={styles.headingBlock}>
        <h1 className={styles.heading}>التحقق بتطبيق نفاذ</h1>
        <p className={styles.subtitle}>
          افتح تطبيق نفاذ على هاتفك واختر الرقم التالي للموافقة على طلب الدخول
        </p>
      </div>

      <div className={styles.numberBlock}>
        <p className={styles.numberLabel}>أدخل هذا الرقم في تطبيق نفاذ</p>
        <p className={styles.number}>{number}</p>
        <p className={styles.numberHint}>
          افتح تطبيق نفاذ ← اختر &quot;تأكيد الطلبات&quot; ← واختر الرقم أعلاه
        </p>
      </div>

      <div className={styles.statusBlock}>
        <hr className={styles.rule} />
        <div className={styles.statusRow}>
          <StatusMessage status={status} />
        </div>
        <hr className={styles.rule} />
      </div>

      {status !== "approved" && status !== "pendingApproval" && status !== "signupRejected" && (
        <div className={styles.actionsRow}>
          <button type="button" className={styles.resend} onClick={resend} disabled={!canResend}>
            {resending ? "جارٍ الإرسال..." : "إعادة الإرسال"}
          </button>
          <span className={styles.validity}>
            صلاحية الرقم: <span className={styles.timer}>{countdown}</span>
          </span>
        </div>
      )}

      {status === "signupRejected" && (
        <div className={styles.actionsRow}>
          <a href={withBasePath("/login")} className={styles.resend}>
            العودة لصفحة تسجيل الدخول
          </a>
        </div>
      )}
    </div>
  );
}

function StatusMessage({ status }: { status: NafathStatus }) {
  switch (status) {
    case "approved":
      return <span className={styles.statusOk}>تمت الموافقة. جارٍ تسجيل الدخول...</span>;
    case "rejected":
      return <span className={styles.statusErr}>تم رفض الطلب من تطبيق نفاذ.</span>;
    case "signupRejected":
      return (
        <span className={styles.statusErr}>
          تم رفض طلب تسجيل مكتبكم الهندسي من قبل الإدارة. يمكنكم التواصل مع الإدارة أو إعادة
          التقديم ببيانات محدّثة.
        </span>
      );
    case "pendingApproval":
      return (
        <span className={styles.statusText}>
          تم التحقق من هويتك. طلب تسجيل مكتبكم الهندسي الآن بانتظار موافقة الإدارة.
        </span>
      );
    case "expired":
      return <span className={styles.statusErr}>انتهت صلاحية الرقم. أعد الإرسال للمحاولة.</span>;
    default:
      return (
        <>
          <span className={styles.statusText}>في انتظار الموافقة من التطبيق...</span>
          <Loader size={20} color="green" />
        </>
      );
  }
}
