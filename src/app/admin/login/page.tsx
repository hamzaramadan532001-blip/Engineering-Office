import type { Metadata } from "next";
import AdminLoginForm from "./AdminLoginForm";

export const metadata: Metadata = {
  title: "تسجيل الدخول — لوحة الإدارة",
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
