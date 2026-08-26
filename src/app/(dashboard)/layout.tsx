import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { terminalFontClass } from "@/app/terminal-fonts";
import { TerminalShell } from "@/components/terminal/shell/terminal-shell";
import { FocusMainOnRouteChange } from "@/components/focus-main-on-route-change";
import "@/styles/terminal.css";
import "@/styles/terminal-shell.css";

/** Khung rỗng đúng cấu trúc shell để layout không nhảy khi phiên đang được đọc. */
function ShellFallback() {
  return (
    <div className={`tm-root ${terminalFontClass}`} aria-busy="true">
      <div className="tm-topbar" />
      <div className="tm-tape" />
      <div className="tm-fnav" />
      <div className="tm-main" />
      <div className="tm-cmdline" />
      <div className="tm-statusbar" />
    </div>
  );
}

/** `getSession()` đọc cookie (Request-time API) — tách riêng để shell tĩnh vẫn stream được. */
async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <TerminalShell email={session.email} userId={session.userId} className={terminalFontClass}>
      {children}
    </TerminalShell>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // Cache Components: `usePathname()` là dữ liệu thời điểm chạy, nên
    // `FocusMainOnRouteChange` phải nằm trong ranh giới Suspense — nếu không cả
    // route bị chặn prerender (`blocking-route`).
    <Suspense fallback={<ShellFallback />}>
      <FocusMainOnRouteChange targetId="main-content" />
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
