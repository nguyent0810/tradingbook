import { TopNav } from "./top-nav";
import { MobileNav } from "./mobile-nav";

export type TradingLayoutProps = {
  children: React.ReactNode;
  userEmail?: string;
  headerTrailing?: React.ReactNode;
};

export function TradingLayout({
  children,
  userEmail,
  headerTrailing,
}: TradingLayoutProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopNav userEmail={userEmail} trailing={headerTrailing} />
      <MobileNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
