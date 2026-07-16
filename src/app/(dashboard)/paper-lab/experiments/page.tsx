import { redirect } from "next/navigation";

// Deep-link entry point → opens the Arena workspace focused on the Learning zone.
export default function ExperimentsPage() {
  redirect("/paper-lab?focus=learning");
}
