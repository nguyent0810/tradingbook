import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/** Session check is a Request-time API (cookies()) — isolated so it can be wrapped in
 *  <Suspense>. The parent (dashboard) layout already gates this route; this is a
 *  defense-in-depth check for direct/deep-linked access. */
async function PaperLabAuthGate({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return <>{children}</>;
}

/**
 * Layout chỉ còn giữ cổng phiên đăng nhập.
 *
 * Khung nền không nằm ở đây nữa: màn F3 (`/paper-lab`) đã là terminal và tự lo
 * bố cục, còn các route con chưa chuyển thì tự bọc `LegacyArenaShell`.
 */
export default function PaperLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSkeleton height="60vh" aria-label="Loading" />}>
      <PaperLabAuthGate>{children}</PaperLabAuthGate>
    </Suspense>
  );
}
