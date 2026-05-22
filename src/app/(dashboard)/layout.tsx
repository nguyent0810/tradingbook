import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { TradingLayout } from "@/components/shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <TradingLayout userEmail={session.email} headerTrailing={<LogoutButton />}>
      {children}
    </TradingLayout>
  );
}
