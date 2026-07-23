import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Tạo tài khoản — TradeLog",
  description: "Tạo không gian làm việc phân tích setup của bạn.",
};

export default function RegisterPage() {
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
        <h1 className="cd-auth__title">Tạo tài khoản của bạn</h1>
        <p className="cd-auth__lead">
          Thiết lập không gian làm việc để phát hiện các setup chất lượng cao và xác thực lợi thế trước khi hành động.
        </p>
      </header>

      <RegisterForm />

      <p className="cd-auth__footer">
        Đã có tài khoản?{" "}
        <Link href="/login" className="cd-auth__link">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
