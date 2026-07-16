import { redirect } from "next/navigation";

// Deep-link entry point → opens the Arena workspace focused on the Learning zone.
export default function HofPage() {
  redirect("/paper-lab?focus=learning");
}
