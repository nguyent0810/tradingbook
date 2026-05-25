import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="auth-shell">
      <div className="animate-in w-full max-w-sm">{children}</div>
    </div>
  );
}
