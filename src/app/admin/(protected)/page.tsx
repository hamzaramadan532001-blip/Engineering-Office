import type { Metadata } from "next";
import AdminSignupRequests from "../AdminSignupRequests";

export const metadata: Metadata = {
  title: "طلبات تسجيل المكاتب الهندسية — لوحة الإدارة",
};

export default function AdminPage() {
  return <AdminSignupRequests />;
}
