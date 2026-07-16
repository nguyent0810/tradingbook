import { redirect } from "next/navigation";

// Deep-link entry point → opens the Arena workspace focused on the Conflict zone.
export default function BattlesPage() {
  redirect("/paper-lab?focus=conflict");
}
