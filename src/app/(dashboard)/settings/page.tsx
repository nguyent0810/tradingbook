import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TradingSettingsForm } from "@/components/settings/trading-settings-form";

export const metadata: Metadata = {
  title: "Cài đặt — TradeLog",
  description: "Cấu hình tài khoản và rủi ro.",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const settings = await prisma.userTradingSettings.findUnique({
    where: { userId: session.userId },
    select: {
      accountEquityVnd: true,
      riskPerTradePct: true,
      maxPositionPct: true,
      liquidityCapPct: true,
    },
  });

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

      <div className="dash-card" style={{ maxWidth: "32rem" }}>
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
    </div>
  );
}
