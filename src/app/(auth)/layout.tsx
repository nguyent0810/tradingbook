import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { terminalFontClass } from "@/app/terminal-fonts";
import "@/styles/terminal.css";
import "@/styles/terminal-f6.css";

/** Session check là Request-time API (cookies()) — tách riêng để bọc `<Suspense>`. */
async function AuthGate({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}

/**
 * Màn F6 tự lo bố cục toàn màn hình (`.f6`), nên layout chỉ còn cổng phiên và
 * biến font. Không có khung bao nào khác.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={terminalFontClass}>
      <Suspense fallback={<div className="f6" aria-busy="true" />}>
        <AuthGate>{children}</AuthGate>
      </Suspense>
    </div>
  );
}
