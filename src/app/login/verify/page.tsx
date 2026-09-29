import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "../AuthShell";
import VerifyClient from "./VerifyClient";

export const metadata: Metadata = {
  title: "التحقق عبر نفاذ — نظام معاملات المكاتب الهندسية",
};

// Next 16: searchParams is async.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ tx?: string; n?: string; exp?: string }>;
}) {
  const { tx, n, exp } = await searchParams;
  if (!tx || !n) {
    redirect("/login");
  }

  const expiresInSec = Number(exp) > 0 ? Number(exp) : 60;

  return (
    <AuthShell>
      <VerifyClient transactionId={tx} initialNumber={n} expiresInSec={expiresInSec} />
    </AuthShell>
  );
}

