import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Preview — TradeLog",
  description: "Isolated UI mockups — not wired to production data.",
  robots: { index: false, follow: false },
};

export default function DesignPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full" style={{ background: "var(--bg-primary)" }}>
      {children}
    </div>
  );
}
