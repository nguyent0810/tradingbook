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
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="animate-in w-full max-w-sm">{children}</div>
    </div>
  );
}
