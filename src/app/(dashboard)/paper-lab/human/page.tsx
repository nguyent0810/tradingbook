import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Deep-link entry point → opens the Arena workspace focused on the Decision zone.
export default function HumanPmPage() {
  redirect("/paper-lab?focus=decision");
}
