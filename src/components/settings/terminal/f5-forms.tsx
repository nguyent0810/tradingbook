"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateTradingSettings,
  type TradingSettingsState,
} from "@/app/actions/trading-settings";
import {
  deleteAccount,
  updateDisplayName,
  updatePassword,
  type ProfileState,
} from "@/app/actions/profile";
import { Panel } from "@/components/terminal";
import { GAP, fmtNum, fmtPct, fmtVndCompact } from "@/lib/format/vn";
import { POSITION_SIZING_DEFAULTS, computePositionSizing } from "@/lib/position-sizing";
import { parseSettingsField, parseSettingsPositive } from "@/lib/settings/parse-settings-field";

/**
 * Mặc định hệ thống khi người dùng để trống một ô.
 *
 * DẪN XUẤT từ `POSITION_SIZING_DEFAULTS` chứ không chép lại: ba ô đầu nhập theo
 * **phần trăm** nên nhân 100, còn trần danh mục giữ nguyên dạng tỉ lệ. Chép tay
 * bốn con số này ra đây là tạo bản thứ tư để lệch — đúng cái bẫy đã gỡ ở §19.5.
 */
const FALLBACK = {
  riskPerTradePct: POSITION_SIZING_DEFAULTS.baseRiskPerTradePct * 100,
  maxPositionPct: POSITION_SIZING_DEFAULTS.maxPerTradeExposurePct * 100,
  liquidityCapPct: POSITION_SIZING_DEFAULTS.liquidityCapPct * 100,
  maxPortfolioExposurePct: POSITION_SIZING_DEFAULTS.maxPortfolioExposurePct,
};

/**
 * Bộ số GIẢ ĐỊNH cho khối xem trước định cỡ — không phải giá thật của mã nào.
 * Mục đích duy nhất là cho thấy tham số vừa nhập sinh ra khối lượng bao nhiêu.
 * Dùng nhãn "MÃ VÍ DỤ" thay vì tên một mã có thật, để không ai đọc nhầm thành
 * báo giá (bàn giao: không hiển thị con số bịa dưới dạng dữ liệu thật).
 */
const PREVIEW = { label: "MÃ VÍ DỤ", entryKVnd: 27.85, stopKVnd: 25.8 };

function Feedback({ state }: { state: TradingSettingsState | ProfileState }) {
  if (!state) return null;
  const errors = Object.entries(state.errors ?? {}).map(
    ([field, msgs]) => `${field}: ${msgs.join(" · ")}`
  );
  if (state.success) {
    return (
      <div className="tm-note" style={{ marginTop: 9 }} role="status">
        {state.message ?? "Đã lưu."}
      </div>
    );
  }
  const lines = [...errors, ...(state.message ? [state.message] : [])];
  if (lines.length === 0) return null;
  return (
    <pre className="tm-evidence" style={{ marginTop: 9 }}>
      {lines.join("\n")}
    </pre>
  );
}

/**
 * Tham số tài khoản giao dịch, dạng hàng key–value + khối xem trước định cỡ.
 *
 * Khối xem trước tính **ngay trên các giá trị đang gõ**, chưa lưu — mục đích là
 * để thấy hệ quả của tham số trước khi chốt, đúng như bản thiết kế yêu cầu.
 */
export function TradingParamsPanel({
  initial,
}: {
  initial: {
    accountEquityVnd: number | null;
    riskPerTradePct: number | null;
    maxPositionPct: number | null;
    liquidityCapPct: number | null;
  };
}) {
  const [state, formAction, pending] = useActionState<TradingSettingsState, FormData>(
    updateTradingSettings,
    undefined
  );

  const asPct = (frac: number | null) => (frac != null ? String(frac * 100) : "");
  const initialValues = {
    accountEquityVnd: initial.accountEquityVnd != null ? String(initial.accountEquityVnd) : "",
    riskPerTradePct: asPct(initial.riskPerTradePct),
    maxPositionPct: asPct(initial.maxPositionPct),
    liquidityCapPct: asPct(initial.liquidityCapPct),
  };
  const [values, setValues] = useState(initialValues);

  // Dùng đúng bộ phân tích của server: dấu chấm là dấu thập phân (0.75 = 0,75%),
  // dấu phẩy là phân cách nghìn. Xem `parse-settings-field.ts`.
  const equity = parseSettingsPositive(values.accountEquityVnd);
  const riskPct = parseSettingsField(values.riskPerTradePct) ?? FALLBACK.riskPerTradePct;
  const maxTradePct = parseSettingsField(values.maxPositionPct) ?? FALLBACK.maxPositionPct;
  const liquidityPct = parseSettingsField(values.liquidityCapPct) ?? FALLBACK.liquidityCapPct;

  const sizing =
    equity != null && equity > 0
      ? computePositionSizing({
          accountEquityVnd: equity,
          maxPortfolioExposurePct: FALLBACK.maxPortfolioExposurePct,
          currentPortfolioExposureVnd: 0,
          maxPerTradeExposurePct: maxTradePct / 100,
          baseRiskPerTradePct: riskPct / 100,
          quality: "A",
          entryKVnd: PREVIEW.entryKVnd,
          stopKVnd: PREVIEW.stopKVnd,
          liquidityCapPct: liquidityPct / 100,
          symbolAvgDailyValueVnd: null,
        })
      : null;

  const fields = [
    {
      name: "accountEquityVnd",
      label: "Vốn tài khoản",
      // Nêu rõ quy ước nhập vì nó KHÁC quy ước hiển thị vi-VN: ở ô nhập, dấu
      // chấm là dấu thập phân (theo hợp đồng của server action).
      note: "Cơ sở tính khối lượng và % NAV cho mọi thiết lập. Bắt buộc. Nhập số thuần, ví dụ 1200000000.",
      unit: "₫",
    },
    {
      name: "riskPerTradePct",
      label: "Rủi ro mỗi lệnh",
      note: `Phần trăm, dùng dấu chấm thập phân (ví dụ 0.75). Để trống dùng mặc định ${fmtPct(FALLBACK.riskPerTradePct, 1)}.`,
      unit: "%",
    },
    {
      name: "maxPositionPct",
      label: "Kích thước vị thế tối đa",
      note: `Trần % NAV cho một mã. Để trống dùng ${fmtPct(FALLBACK.maxPositionPct, 0)}.`,
      unit: "% NAV",
    },
    {
      name: "liquidityCapPct",
      label: "Trần thanh khoản",
      note: `% giá trị khớp lệnh bình quân ngày của mã. Để trống dùng ${fmtPct(FALLBACK.liquidityCapPct, 0)}.`,
      unit: "% GTGD",
    },
  ];

  return (
    <Panel
      title="THAM SỐ TÀI KHOẢN GIAO DỊCH"
      tone="accent"
      trailing={
        <span className="tm-mono" style={{ fontSize: 9, color: "var(--tm-text-dim)" }}>
          DÙNG CHO BẢNG ĐỊNH CỠ VỊ THẾ
        </span>
      }
      body="pad"
      style={{ flex: "none" }}
    >
      <form action={formAction}>
        {fields.map((field) => (
          <div key={field.name} className="f5-param">
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Nhãn thật gắn `htmlFor`, không phải `aria-label`: nhãn thật cho
                  phép click vào chữ để focus ô và đọc được bằng mọi công nghệ hỗ trợ. */}
              <label className="f5-param__label" htmlFor={`f5-${field.name}`}>
                {field.label}
              </label>
              <div className="f5-param__note" id={`f5-${field.name}-note`}>
                {field.note}
              </div>
            </div>
            <div className="f5-param__control">
              <input
                id={`f5-${field.name}`}
                className="f5-param__input"
                name={field.name}
                aria-describedby={`f5-${field.name}-note`}
                inputMode="decimal"
                value={values[field.name as keyof typeof values]}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              />
              <span className="f5-param__unit">{field.unit}</span>
            </div>
          </div>
        ))}

        <div className="f5-actions">
          <button type="submit" className="tm-btn tm-btn--primary" disabled={pending}>
            {pending ? "ĐANG LƯU…" : "LƯU THAM SỐ"}
          </button>
          <button type="button" className="tm-btn" onClick={() => setValues(initialValues)}>
            HOÀN TÁC
          </button>
        </div>

        <Feedback state={state} />
      </form>

      <div className="f5-preview">
        <div className="tm-eyebrow--dim" style={{ marginBottom: 6 }}>
          XEM TRƯỚC · {PREVIEW.label} GIÁ VÀO {fmtNum(PREVIEW.entryKVnd, 2)} · CẮT LỖ{" "}
          {fmtNum(PREVIEW.stopKVnd, 2)} · HẠNG A · CHƯA TÍNH VỊ THẾ ĐANG MỞ
        </div>
        {sizing == null ? (
          <div className="f5-param__note">
            Nhập vốn tài khoản để xem khối lượng và % NAV mà tham số hiện tại sinh ra.
          </div>
        ) : !sizing.ok ? (
          <pre className="tm-evidence">{`computePositionSizing → ${sizing.code}`}</pre>
        ) : (
          <div className="f5-preview__grid">
            {[
              {
                k: "RỦI RO / LỆNH",
                v: fmtVndCompact(sizing.value.riskBudgetVnd),
                c: "var(--tm-accent)",
              },
              {
                k: "KHỐI LƯỢNG",
                v: `${fmtNum(sizing.value.qFinalShares, 0)} cp`,
                c: "var(--tm-text-value)",
              },
              {
                k: "GIÁ TRỊ VỊ THẾ",
                v: fmtVndCompact(sizing.value.notionalVnd),
                c: "var(--tm-text-value)",
              },
              {
                k: "% NAV",
                v: fmtPct(sizing.value.positionPctOfAccount, 1),
                c:
                  sizing.value.positionPctOfAccount > maxTradePct
                    ? "var(--tm-ref)"
                    : "var(--tm-floor)",
              },
            ].map((cell) => (
              <div key={cell.k}>
                <div className="f5-preview__k">{cell.k}</div>
                <div className="f5-preview__v" style={{ color: cell.c }}>
                  {cell.v}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Hồ sơ & bảo mật — tên hiển thị, email (chỉ đọc), đổi mật khẩu. */
export function ProfileSecurityPanel({
  name,
  email,
}: {
  name: string | null;
  email: string;
}) {
  const [nameState, nameAction, namePending] = useActionState<ProfileState, FormData>(
    updateDisplayName,
    undefined
  );
  const [pwState, pwAction, pwPending] = useActionState<ProfileState, FormData>(
    updatePassword,
    undefined
  );

  return (
    <Panel title="HỒ SƠ & BẢO MẬT" tone="floor" body="pad" style={{ flex: "none" }}>
      <div className="f5-grid2">
        <form action={nameAction}>
          <label className="f5-label" htmlFor="f5-name">
            TÊN HIỂN THỊ
          </label>
          <input id="f5-name" className="f5-input" name="name" defaultValue={name ?? ""} />

          <label className="f5-label" htmlFor="f5-email">
            EMAIL ĐĂNG NHẬP
          </label>
          <input
            id="f5-email"
            className="f5-input f5-input--mono"
            value={email}
            disabled
            aria-describedby="f5-email-note"
          />
          <div id="f5-email-note" className="f5-param__note">
            Email đăng nhập không đổi được từ màn này.
          </div>

          <button
            type="submit"
            className="tm-btn tm-btn--primary"
            style={{ marginTop: 9 }}
            disabled={namePending}
          >
            {namePending ? "ĐANG LƯU…" : "LƯU TÊN"}
          </button>
          <Feedback state={nameState} />
        </form>

        <form action={pwAction}>
          <label className="f5-label" htmlFor="f5-cur-pw">
            MẬT KHẨU HIỆN TẠI
          </label>
          <input
            id="f5-cur-pw"
            className="f5-input f5-input--mono"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
          />

          <label className="f5-label" htmlFor="f5-new-pw">
            MẬT KHẨU MỚI
          </label>
          <input
            id="f5-new-pw"
            className="f5-input f5-input--mono"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            placeholder="tối thiểu 6 ký tự"
          />

          <label className="f5-label" htmlFor="f5-confirm-pw">
            XÁC NHẬN MẬT KHẨU MỚI
          </label>
          <input
            id="f5-confirm-pw"
            className="f5-input f5-input--mono"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
          />

          <button type="submit" className="tm-btn tm-btn--primary" disabled={pwPending}>
            {pwPending ? "ĐANG ĐỔI…" : "ĐỔI MẬT KHẨU"}
          </button>
          <Feedback state={pwState} />
        </form>
      </div>
    </Panel>
  );
}

/**
 * Vùng nguy hiểm + modal xoá tài khoản.
 * Bắt buộc nhập chuỗi xác nhận; nút phá vỡ dùng viền đỏ, không phải nút mặc định.
 */
export function DangerZonePanel() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    deleteAccount,
    undefined
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const confirmed = confirmText.trim().toUpperCase() === "XÓA";

  return (
    <>
      <Panel
        title="VÙNG NGUY HIỂM"
        tone="down"
        background="var(--tm-head-no-trade)"
        body="none"
        style={{ flex: "none" }}
      >
        <div className="f5-danger">
          <div style={{ flex: 1 }}>
            <div className="f5-danger__title">Xoá tài khoản và toàn bộ dữ liệu giao dịch</div>
            <div className="f5-danger__note">
              Không thể hoàn tác — sổ lệnh, danh mục theo dõi và cấu hình rủi ro sẽ bị xoá vĩnh viễn.
            </div>
          </div>
          <button type="button" className="tm-btn tm-btn--danger" onClick={() => setOpen(true)}>
            XOÁ TÀI KHOẢN
          </button>
        </div>
      </Panel>

      {open ? (
        <div
          className="tm-overlay tm-overlay--center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="tm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Xoá tài khoản"
            style={{ width: 520, maxWidth: "100%" }}
          >
            <div className="tm-modal__head" style={{ background: "var(--tm-head-no-trade)" }}>
              <span className="tm-panel__rule" style={{ background: "var(--tm-down)" }} />
              <span className="tm-panel__title" style={{ color: "var(--tm-down-soft)" }}>
                XOÁ TÀI KHOẢN
              </span>
              <span className="tm-panel__spacer" />
              <button
                ref={closeRef}
                type="button"
                className="tm-btn tm-btn--ghost tm-btn--sm"
                onClick={() => setOpen(false)}
              >
                ESC ✕
              </button>
            </div>

            <form action={formAction}>
              <div className="tm-modal__body">
                <div className="tm-state">
                  <span className="tm-state__title">Hành động này không thể hoàn tác</span>
                  <p className="tm-state__note">
                    Toàn bộ lệnh, cấu hình rủi ro và liên kết thiết lập của tài khoản sẽ bị xoá
                    vĩnh viễn khỏi cơ sở dữ liệu.
                  </p>
                </div>

                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="f5-delete-password">
                      MẬT KHẨU
                    </label>
                    <div className="tm-field__note" id="f5-delete-password-note">
                      Xác thực lại trước khi xoá.
                    </div>
                  </div>
                  <input
                    id="f5-delete-password"
                    className="tm-input"
                    type="password"
                    name="password"
                    aria-describedby="f5-delete-password-note"
                    autoComplete="current-password"
                  />
                </div>

                <div className="tm-field">
                  <div>
                    <label className="tm-field__label" htmlFor="f5-delete-confirm">
                      CHUỖI XÁC NHẬN
                    </label>
                    <div className="tm-field__note" id="f5-delete-confirm-note">
                      Nhập chính xác <strong>XÓA</strong> để mở khoá nút xoá.
                    </div>
                  </div>
                  <input
                    id="f5-delete-confirm"
                    className="tm-input"
                    name="confirmText"
                    aria-describedby="f5-delete-confirm-note"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </div>

                <Feedback state={state} />
              </div>

              <div className="tm-modal__foot">
                <span className="tm-panel__spacer" />
                <button type="button" className="tm-btn" onClick={() => setOpen(false)}>
                  HUỶ
                </button>
                <button
                  type="submit"
                  className="tm-btn tm-btn--danger"
                  disabled={!confirmed || pending}
                >
                  {pending ? "ĐANG XOÁ…" : "XOÁ VĨNH VIỄN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Ô hiển thị đơn giản cho khối phiên đăng nhập. */
export function SessionFact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      {label} · {value ?? GAP}
    </div>
  );
}
