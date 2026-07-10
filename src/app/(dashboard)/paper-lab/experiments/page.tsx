import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Deep-link entry point → opens the Arena workspace focused on the Learning zone.
export default function ExperimentsPage() {
  redirect("/paper-lab?focus=learning");
}
