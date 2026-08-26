"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { login, register, type AuthState } from "@/app/actions/auth";

export type AuthMode = "login" | "register";

/**
 * Panel phiên làm việc — một panel, hai tab (bàn giao §4 F6).
 *
 * Hai tab là hai **route thật** (`/login`, `/register`) chứ không phải state cục
 * bộ: server action, redirect và deep link đang gắn với route, đổi sang tab ảo
 * sẽ phá cả ba. Tab không hoạt động là `<Link>` sang route kia.
 */
export function AuthPanel({
  mode,
  dbReachable,
}: {
  mode: AuthMode;
  dbReachable: boolean;
}) {
  const isRegister = mode === "register";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    isRegister ? register : login,
    undefined
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.errors?.email) emailRef.current?.focus();
    else if (state?.errors?.password) passwordRef.current?.focus();
  }, [state?.errors]);

  const fieldErrors = state?.errors ?? {};

  return (
    <div className="f6">
      <div className="f6__panel">
        <div className="f6__head">
          <span className="tm-panel__rule" style={{ background: "var(--tm-accent)" }} />
          <span className="tm-panel__title">
            {isRegister ? "TẠO TÀI KHOẢN MỚI" : "XÁC THỰC PHIÊN LÀM VIỆC"}
          </span>
          <span className="tm-panel__spacer" />
          <span className="tm-mono" style={{ fontSize: 9, color: "var(--tm-text-dim)" }}>
            TLS 1.3
          </span>
        </div>

        <nav className="f6__tabs" aria-label="Chế độ xác thực">
          <Link href="/login" className="f6__tab" aria-current={!isRegister ? "page" : undefined}>
            ĐĂNG NHẬP
          </Link>
          <Link
            href="/register"
            className="f6__tab"
            aria-current={isRegister ? "page" : undefined}
          >
            ĐĂNG KÝ
          </Link>
        </nav>

        <div className="f6__body">
          <div className="f6__brand">
            <span className="f6__mark" aria-hidden="true">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </span>
            <div>
              <div className="f6__wordmark">TRADELOG</div>
              <div className="f6__tagline">VIETNAM MARKET TERMINAL</div>
            </div>
          </div>

          <form
            action={formAction}
            noValidate
            data-testid={isRegister ? "register-form" : "login-form"}
          >
            {state?.message ? (
              <div
                className="f6__alert"
                role="alert"
                data-testid={isRegister ? "register-error" : "login-error"}
              >
                {state.message}
              </div>
            ) : null}

            {isRegister ? (
              <div className="f6__field">
                <label className="f6__label" htmlFor="auth-name">
                  HỌ TÊN
                </label>
                <input
                  id="auth-name"
                  className="f6__input"
                  name="name"
                  autoComplete="name"
                  placeholder="Không bắt buộc"
                />
                {fieldErrors.name ? (
                  <div className="f6__alert" style={{ marginTop: 6, marginBottom: 0 }}>
                    {fieldErrors.name.join(" · ")}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="f6__field">
              <label className="f6__label" htmlFor="auth-email">
                TÀI KHOẢN
              </label>
              <input
                ref={emailRef}
                id="auth-email"
                className="f6__input"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="ban@congty.vn"
                aria-invalid={fieldErrors.email ? true : undefined}
              />
              {fieldErrors.email ? (
                <div className="f6__alert" style={{ marginTop: 6, marginBottom: 0 }}>
                  {fieldErrors.email.join(" · ")}
                </div>
              ) : null}
            </div>

            <div className="f6__field" style={{ marginBottom: 14 }}>
              <label className="f6__label" htmlFor="auth-password">
                MẬT KHẨU
              </label>
              <input
                ref={passwordRef}
                id="auth-password"
                className="f6__input"
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                placeholder={isRegister ? "tối thiểu 6 ký tự" : undefined}
                aria-invalid={fieldErrors.password ? true : undefined}
              />
              {fieldErrors.password ? (
                <div className="f6__alert" style={{ marginTop: 6, marginBottom: 0 }}>
                  {fieldErrors.password.join(" · ")}
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              className="f6__submit"
              data-testid={isRegister ? "register-submit" : "login-submit"}
              disabled={pending}
            >
              {pending
                ? isRegister
                  ? "ĐANG TẠO…"
                  : "ĐANG ĐĂNG NHẬP…"
                : isRegister
                  ? "TẠO TÀI KHOẢN"
                  : "ĐĂNG NHẬP"}
            </button>
          </form>

          <div className="f6__meta">
            <span>
              {isRegister ? "Đã có tài khoản? Chọn tab Đăng nhập" : "Chưa có tài khoản? Chọn tab Đăng ký"}
            </span>
            <span>PHIÊN HẾT HẠN SAU 7 NGÀY</span>
          </div>

          <div className="f6__status">
            <div>
              <span
                className="f6__status-dot"
                style={{ color: dbReachable ? "var(--tm-up)" : "var(--tm-down)" }}
                aria-hidden="true"
              >
                ●
              </span>
              Cơ sở dữ liệu · {dbReachable ? "sẵn sàng" : "không kết nối được"}
            </div>
            {/* Chỉ một dòng trạng thái: mốc quét và số tác tử là dữ liệu vận hành,
                không hiển thị cho người chưa đăng nhập. */}
          </div>
        </div>
      </div>
    </div>
  );
}
