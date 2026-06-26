import { redirect } from "next/navigation";

/** Legacy `/trades` route — journal lives at `/trades/journal`. */
export default function TradesRedirectPage() {
  redirect("/trades/journal");
}
