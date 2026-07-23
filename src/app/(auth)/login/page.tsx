import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập — TradeLog",
  description: "Đăng nhập vào không gian làm việc phân tích setup của bạn.",
};

export default function LoginPage() {
  return (
    <>
      <header className="cd-auth__brand">
        <span className="cd-auth__mark" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        </span>
        <p className="cd-auth__eyebrow">Trí tuệ Setup</p>
        <h1 className="cd-auth__title">Chào mừng trở lại</h1>
        <p className="cd-auth__lead">
          Đăng nhập để quét thị trường, xác thực các setup chất lượng cao và hành động dứt khoát.
        </p>
      </header>

      <LoginForm />

      <p className="cd-auth__footer">
        Mới sử dụng terminal?{" "}
        <Link href="/register" className="cd-auth__link">
          Tạo tài khoản
        </Link>
      </p>
    </>
  );
}
