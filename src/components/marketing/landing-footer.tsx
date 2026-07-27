import Link from "next/link";
import { BrandMark } from "@/components/marketing/brand-mark";

const YEAR = 2026;

export function LandingFooter() {
  return (
    <footer className="cd-landing-footer">
      <div className="cd-landing__container">
        <div className="cd-landing-footer__inner">
          <div className="cd-landing-footer__brand">
            <Link href="/" className="cd-landing__brand" aria-label="Trang chủ TradeLog">
              <BrandMark />
              TradeLog
            </Link>
            <p className="cd-landing-footer__tagline">
              Trí tuệ thiết lập giao dịch dành cho nhà đầu tư quyết đoán — hỗ trợ quyết định dựa
              trên bằng chứng, từ nhận định trong ngày đến thiết lập đã xác thực.
            </p>
          </div>
          <div className="cd-landing-footer__links">
            <div className="cd-landing-footer__col">
              <span className="cd-landing-footer__col-title">Khám phá</span>
              <Link href="/#workflow" className="cd-landing-footer__link">
                Cách vận hành
              </Link>
              <Link href="/#pillars" className="cd-landing-footer__link">
                Nền tảng
              </Link>
              <Link href="/#evidence" className="cd-landing-footer__link">
                Vì sao đáng tin
              </Link>
            </div>
            <div className="cd-landing-footer__col">
              <span className="cd-landing-footer__col-title">Tài khoản</span>
              <Link href="/login" className="cd-landing-footer__link">
                Đăng nhập
              </Link>
              <Link href="/register" className="cd-landing-footer__link">
                Tạo tài khoản
              </Link>
            </div>
            <div className="cd-landing-footer__col">
              <span className="cd-landing-footer__col-title">Pháp lý</span>
              <Link href="/privacy" className="cd-landing-footer__link">
                Chính sách bảo mật
              </Link>
              <Link href="/terms" className="cd-landing-footer__link">
                Điều khoản sử dụng
              </Link>
            </div>
          </div>
        </div>
        <div className="cd-landing-footer__legal">
          <p className="cd-landing-footer__disclaimer">
            TradeLog cung cấp công cụ nghiên cứu và hỗ trợ quyết định. Đây không phải là lời
            khuyên đầu tư và không thực hiện đặt lệnh. Kết quả mô phỏng không đảm bảo kết quả
            trong tương lai.
          </p>
          <p>© {YEAR} TradeLog</p>
        </div>
      </div>
    </footer>
  );
}
