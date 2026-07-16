import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import "@/components/command-deck/command-deck.css";
import "@/components/paper-lab/paper-lab-command-center.css";

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
 * Arena is a first-class product page — same shell as Dashboard/Setups.
 * It renders inside the global (dashboard) app-shell (global header + nav +
 * breadcrumb) and uses the Command Deck container (.cd-root/.cd-shell) for an
 * identical width, background, spacing and token set. No separate app sidebar
 * or utility bar.
 */
export default function PaperLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cd-root paper-lab-arena-root" data-testid="paper-lab-command-shell">
      <div className="cd-shell">
        <Suspense fallback={<LoadingSkeleton height="60vh" aria-label="Loading" />}>
          <PaperLabAuthGate>{children}</PaperLabAuthGate>
        </Suspense>
      </div>
    </div>
  );
}
