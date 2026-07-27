import Link from "next/link";
import { BrandMark } from "@/components/marketing/brand-mark";

export function LandingHeader() {
  return (
    <header className="cd-landing__header">
      <div className="cd-landing__container cd-landing__header-inner">
        <Link href="/" className="cd-landing__brand" aria-label="Trang chủ TradeLog">
          <BrandMark />
          TradeLog
        </Link>
        <nav className="cd-landing__nav" aria-label="Tài khoản">
          <Link href="/login" className="cd-landing-btn cd-landing-btn--ghost">
            Đăng nhập
          </Link>
          <Link href="/register" className="cd-landing-btn cd-landing-btn--primary">
            Tạo tài khoản
          </Link>
        </nav>
      </div>
    </header>
  );
}
