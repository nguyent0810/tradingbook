import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Deep-link entry point → opens the Arena workspace focused on the Conflict zone.
export default function BattlesPage() {
  redirect("/paper-lab?focus=conflict");
}
