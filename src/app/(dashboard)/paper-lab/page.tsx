import type { Metadata } from "next";
import { PaperLabPageShell } from "@/components/paper-lab/PaperLabPageShell";
import { PaperLabArenaDeck } from "@/components/paper-lab/PaperLabArenaDeck";
import { loadPaperLabPageDto } from "@/lib/paper-lab/load-paper-lab-page";

export const metadata: Metadata = {
  title: "AI Trading Arena | TradeLog",
  description: "AI paper trading lab — virtual agent competition, no real trades.",
};

export const dynamic = "force-dynamic";

export default async function PaperLabPage() {
  const data = await loadPaperLabPageDto();

  return (
    <PaperLabPageShell>
      <PaperLabArenaDeck data={data} />
    </PaperLabPageShell>
  );
}
