import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/** Session check is a Request-time API (cookies()) — isolated in its own component so
 *  the surrounding auth chrome can still be part of the static prerendered shell. */
async function AuthGate({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="cd-auth">
      <div className="cd-auth__layout">
        <div className="cd-auth__card cd-auth__enter">
          <Suspense fallback={<LoadingSkeleton height="20rem" aria-label="Loading" />}>
            <AuthGate>{children}</AuthGate>
          </Suspense>
        </div>

        {/* Where signing in leads — the product journey, stated calmly */}
        <nav className="cd-auth__journey" aria-label="Những gì bạn nhận được sau khi đăng nhập">
          <span className="cd-auth__step">Bảng điều khiển</span>
          <span className="cd-auth__step-sep" aria-hidden="true">
            →
          </span>
          <span className="cd-auth__step">Thiết lập</span>
          <span className="cd-auth__step-sep" aria-hidden="true">
            →
          </span>
          <span className="cd-auth__step">Đấu trường</span>
        </nav>
      </div>
    </div>
  );
}
