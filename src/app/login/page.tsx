import type { Metadata } from "next";
import AuthShell from "./AuthShell";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "تسجيل الدخول — نظام معاملات المكاتب الهندسية",
  description: "تسجيل الدخول إلى نظام معاملات المكاتب الهندسية عبر منصة نفاذ الوطنية",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
