import Link from "next/link";
import { DashboardLayout, COMMAND_DECK_MOCK } from "@/components/command-deck";

export default function CommandDeckPreviewPage() {
  return (
    <DashboardLayout
      data={COMMAND_DECK_MOCK}
      header={
        <header className="mb-6">
          <p className="cd-kicker mb-1">Design preview</p>
          <h1 className="text-2xl font-semibold m-0 mb-1 tracking-tight">Command Deck</h1>
          <p className="text-sm m-0 mb-4" style={{ color: "var(--cd-text-muted)" }}>
            Premium FinTech dark mode — mock VNINDEX NO TRADE session
          </p>
          <Link
            href="/design-preview/cyber-cockpit"
            className="text-xs underline"
            style={{ color: "var(--cd-cyan)" }}
          >
            Compare with wired Cyber Cockpit →
          </Link>
        </header>
      }
    />
  );
}
