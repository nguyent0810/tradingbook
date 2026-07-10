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
    <div className="cd-auth">
      <div className="cd-auth__layout">
        <div className="cd-auth__card cd-auth__enter">{children}</div>

        {/* Where signing in leads — the product journey, stated calmly */}
        <nav className="cd-auth__journey" aria-label="What you get after signing in">
          <span className="cd-auth__step">Dashboard</span>
          <span className="cd-auth__step-sep" aria-hidden="true">
            →
          </span>
          <span className="cd-auth__step">Setups</span>
          <span className="cd-auth__step-sep" aria-hidden="true">
            →
          </span>
          <span className="cd-auth__step">Arena</span>
        </nav>
      </div>
    </div>
  );
}
