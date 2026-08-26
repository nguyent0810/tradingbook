import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Panel, PanelSkeleton } from "@/components/terminal";
import { loadSystemStatus } from "@/lib/terminal/system-status";
import { fmtSessionStamp } from "@/lib/format/vn";
import {
  DangerZonePanel,
  ProfileSecurityPanel,
  SessionFact,
  TradingParamsPanel,
} from "@/components/settings/terminal/f5-forms";
import "@/styles/terminal-f5.css";

export const metadata: Metadata = {
  title: "F5 Cài đặt — TradeLog VN Terminal",
  description: "Tham số tài khoản giao dịch, hồ sơ, bảo mật và tình trạng hệ thống.",
};

function SettingsSkeleton() {
  return (
    <div className="f5" aria-busy="true" data-testid="settings-loading">
      <div className="f5__main">
        <Panel title="THAM SỐ TÀI KHOẢN GIAO DỊCH" tone="accent" body="pad">
          <PanelSkeleton rows={4} columns={[200, 132]} label="Đang tải tham số tài khoản" />
        </Panel>
        <Panel title="HỒ SƠ & BẢO MẬT" tone="floor" body="pad">
          <PanelSkeleton rows={4} columns={[160, 160]} label="Đang tải hồ sơ" />
        </Panel>
      </div>
      <div className="f5__rail">
        <Panel title="TÌNH TRẠNG HỆ THỐNG" tone="up" body="none">
          <PanelSkeleton rows={7} columns={[140, 70]} dense label="Đang tải tình trạng hệ thống" />
        </Panel>
      </div>
    </div>
  );
}

async function SettingsContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [settings, user, systemStatus] = await Promise.all([
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
      select: { name: true, email: true, createdAt: true },
    }),
    loadSystemStatus(),
  ]);

  return (
    <div className="f5" data-testid="f5-settings">
      <div className="f5__main">
        <TradingParamsPanel
          initial={{
            accountEquityVnd: settings?.accountEquityVnd ?? null,
            riskPerTradePct: settings?.riskPerTradePct ?? null,
            maxPositionPct: settings?.maxPositionPct ?? null,
            liquidityCapPct: settings?.liquidityCapPct ?? null,
          }}
        />
        <ProfileSecurityPanel name={user?.name ?? null} email={user?.email ?? session.email} />
        <DangerZonePanel />
      </div>

      <div className="f5__rail">
        <Panel title="TÌNH TRẠNG HỆ THỐNG" tone="up" body="none" style={{ flex: "none" }}>
          <div>
            {systemStatus.map((row) => (
              <div key={row.key} className="f5-status__row">
                <span className="f5-status__dot" style={{ background: row.color }} />
                <span className="f5-status__k">{row.key}</span>
                <span className="f5-status__v" style={{ color: row.color }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="PHIÊN ĐĂNG NHẬP" tone="ceil" body="none" style={{ flex: "none" }}>
          <div className="f5-session">
            <SessionFact label="Tài khoản" value={session.email} />
            <SessionFact
              label="Hết hạn"
              value={session.expiresAt ? fmtSessionStamp(new Date(session.expiresAt)) : null}
            />
            <SessionFact
              label="Tạo tài khoản"
              value={user?.createdAt ? fmtSessionStamp(user.createdAt) : null}
            />
            {/* Thiết bị và IP không được lưu vào phiên nên không hiển thị —
                bịa ra hai dòng đó sẽ là thông tin bảo mật sai. */}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
