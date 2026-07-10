import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import "@/components/command-deck/command-deck.css";
import "@/components/paper-lab/paper-lab-command-center.css";

/**
 * Arena is a first-class product page — same shell as Dashboard/Setups.
 * It renders inside the global (dashboard) app-shell (global header + nav +
 * breadcrumb) and uses the Command Deck container (.cd-root/.cd-shell) for an
 * identical width, background, spacing and token set. No separate app sidebar
 * or utility bar.
 */
export default async function PaperLabLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="cd-root paper-lab-arena-root" data-testid="paper-lab-command-shell">
      <div className="cd-shell">{children}</div>
    </div>
  );
}
