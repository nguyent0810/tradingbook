import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TradingSettingsForm } from "@/components/settings/trading-settings-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export const metadata: Metadata = {
  title: "Cài đặt — TradeLog",
  description: "Cấu hình tài khoản và rủi ro.",
};

/**
 * Data-dependent (session + prisma) — isolated in its own Suspense boundary
 * so it doesn't block the shared (dashboard) layout's outer Suspense (which
 * also carries DashboardClayThemeEffect) from resolving on a cold/direct
 * navigation to /settings. Mirrors the streaming pattern already used by
 * Dashboard and Setups (see setups/page.tsx's per-widget Suspense split).
 */
async function SettingsContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [settings, user] = await Promise.all([
    prisma.userTradingSettings.findUnique({
      where: { userId: session.userId },
      select: {
        accountEquityVnd: true,
        riskPerTradePct: true,
        maxPositionPct: true,
        liquidityCapPct: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    }),
  ]);

  return (
    <>
      <div className="dash-card">
        <div className="dash-card__header">
          <h2 className="dash-card__title">Hồ sơ</h2>
          <p className="dash-card__lead">
            Email đăng nhập: <strong>{user?.email}</strong>
          </p>
        </div>
        <ProfileForm currentName={user?.name ?? null} />
      </div>

      <div className="dash-card">
        <div className="dash-card__header">
          <h2 className="dash-card__title">Bảo mật</h2>
          <p className="dash-card__lead">Đổi mật khẩu đăng nhập tài khoản.</p>
        </div>
        <ChangePasswordForm />
      </div>

      <div className="dash-card">
        <div className="dash-card__header">
          <h2 className="dash-card__title">Tài khoản giao dịch</h2>
          <p className="dash-card__lead">
            Điền sẵn bảng định cỡ vị thế khuyến nghị trên trang Thiết lập — vốn, % rủi ro cơ sở,
            % lệnh tối đa, và trần thanh khoản (% giá trị khớp lệnh bình quân ngày của mã). Bạn
            vẫn có thể chỉnh bất kỳ giá trị nào trên bảng đó cho kịch bản giả định. Rủi ro mỗi
            lệnh, kích thước vị thế tối đa và trần thanh khoản là tùy chọn — để trống để dùng mặc
            định hệ thống cho từng mục.
          </p>
        </div>
        <TradingSettingsForm
          currentAccountEquityVnd={settings?.accountEquityVnd ?? null}
          currentRiskPerTradePct={settings?.riskPerTradePct ?? null}
          currentMaxPositionPct={settings?.maxPositionPct ?? null}
          currentLiquidityCapPct={settings?.liquidityCapPct ?? null}
        />
        <p className="dash-exposure__caption text-xs" style={{ color: "var(--text-tertiary)", marginTop: "var(--space-4)" }}>
          Vốn sẽ dùng biến môi trường{" "}
          <code className="dash-code">TRADING_ACCOUNT_EQUITY_VND</code> nếu không đặt ở đây. Max
          book (%) không thể tự cấu hình — giá trị này do phán quyết hôm nay trên Bảng điều khiển
          quyết định.
        </p>
      </div>

      <div className="dash-card dash-card--danger">
        <div className="dash-card__header">
          <h2 className="dash-card__title" style={{ color: "var(--danger)" }}>
            Vùng nguy hiểm
          </h2>
          <p className="dash-card__lead">
            Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ dữ liệu giao dịch và cấu hình rủi ro liên
            quan. Hành động này không thể hoàn tác.
          </p>
        </div>
        <DeleteAccountForm />
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <div
      className="cd-root page-container command-deck dash-cockpit dash-cockpit--v2 pb-10"
      data-testid="settings-page"
    >
      <header className="dash-v2-page-header">
        <div className="dash-v2-page-header__copy">
          <p className="dash-v2-eyebrow">Tài khoản</p>
          <h1 className="dash-v2-page-header__title">Cài đặt</h1>
          <p className="dash-v2-page-header__lead">
            Cấu hình các giá trị cấp tài khoản được Bảng điều khiển dùng cho lan can rủi ro và
            bảng định cỡ vị thế của Thiết lập.
          </p>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          maxWidth: "32rem",
        }}
      >
        <Suspense fallback={<LoadingSkeletonGroup rows={4} rowHeight="9rem" />}>
          <SettingsContent />
        </Suspense>
      </div>
    </div>
  );
}
