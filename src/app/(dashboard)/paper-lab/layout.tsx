import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getPaperLabExecutionMode } from "@/lib/paper-lab/llm-config";
import { PaperLabCommandShell } from "@/components/paper-lab/PaperLabCommandShell";
import "@/components/paper-lab/paper-lab-command-center.css";

export default async function PaperLabLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const mode = getPaperLabExecutionMode();

  return (
    <PaperLabCommandShell userEmail={session.email} executionLabel={mode.label}>
      {children}
    </PaperLabCommandShell>
  );
}
