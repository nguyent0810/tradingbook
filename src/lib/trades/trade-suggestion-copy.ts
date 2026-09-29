/**
 * Vietnamese copy for the reasons and risks of a Gợi ý lệnh (issue #14).
 *
 * Both tables are REFERENCE ONLY copy (ADR 0003, audit F08): each sentence
 * describes a fact about the setup or the market; none tells the reader what to
 * do. `BANNED_IMPERATIVE_PATTERNS` is the list a test holds every template to.
 *
 * Templates use `{name}` placeholders, filled by the builder.
 */

/**
 * Reason codes: one per line the Gate 2 classifier (scanner/gate2/breakout-pullback)
 * writes into `reasons` for a setup that QUALIFIES. Rejection lines never reach
 * a stored setup, and tradability writes reasons only when a symbol fails.
 */
export const SETUP_REASON_CODES = [
  "trend_ok",
  "fresh_breakout",
  "pullback_digested",
  "in_pullback_zone",
  "volume_confirmed",
  "extension_ok",
  "pullback_depth_ok",
  "no_material_dip",
  "stop_anchor",
  "tier_a",
  "tier_b",
] as const;

export type SetupReasonCode = (typeof SETUP_REASON_CODES)[number];

/**
 * How each classifier line is recognised. Capture group i fills placeholder
 * `groups[i]`; numeric captures are re-printed in vi-VN format with the source's decimals.
 * The patterns mirror the classifier's English wording, so a rewording there
 * turns the line into "unmapped" and the coverage test fails.
 */
export const SETUP_REASON_PATTERNS: Record<SetupReasonCode, { pattern: RegExp; groups: readonly string[] }> = {
  trend_ok: { pattern: /^Trend OK for long-bias pullback:/, groups: [] },
  fresh_breakout: {
    pattern: /^Fresh breakout: cleared prior resistance ([\d.]+) at session offset \d+ \((\d+) bars ago\)\.$/,
    groups: ["level", "ago"],
  },
  pullback_digested: { pattern: /^Pullback\/digestion observed/, groups: [] },
  in_pullback_zone: {
    pattern: /^Price is interacting with the pullback zone floor–ceiling \(([\d.]+)–([\d.]+)\)\.$/,
    groups: ["low", "high"],
  },
  volume_confirmed: {
    pattern: /^Liquidity check passed—volume ([\d.]+)× the 20-day median\.$/,
    groups: ["ratio"],
  },
  extension_ok: {
    pattern: /^Extension vs breakout level: (-?[\d.]+)% \(≤ ([\d.]+)%\)\.$/,
    groups: ["pct", "cap"],
  },
  pullback_depth_ok: {
    pattern: /^Pullback depth under the breakout level: ([\d.]+)% \(within ([\d.]+)%\)\.$/,
    groups: ["depth", "cap"],
  },
  no_material_dip: { pattern: /^No dip materially below the breakout level/, groups: [] },
  stop_anchor: {
    pattern: /^Stop anchor: ([\d.]+) \(≈([\d.]+)% cushion under recent swing low ([\d.]+)\)\.$/,
    groups: ["stop", "cushion", "swingLow"],
  },
  tier_a: {
    pattern: /^Tier A — strong participation \(([\d.]+)× median, ≥([\d.]+)×\)/,
    groups: ["ratio", "min"],
  },
  tier_b: {
    pattern: /^Tier B — setup valid but softer participation .*\(still ≥ ([\d.]+)× median volume\)/,
    groups: ["min"],
  },
};

export const SETUP_REASON_COPY: Record<SetupReasonCode, string> = {
  trend_ok: "Xu hướng thuận: giá đóng cửa trên MA50 và MA20 nằm trên MA50.",
  fresh_breakout: "Breakout mới: giá vượt kháng cự {level} cách đây {ago} phiên.",
  pullback_digested:
    "Đã có nhịp nghỉ: giá lùi xuống dưới giá đóng cửa phiên breakout rồi giữ lại.",
  in_pullback_zone: "Giá đang nằm trong vùng pullback {low}–{high}.",
  volume_confirmed: "Khối lượng phiên quét gấp {ratio} lần trung vị 20 phiên.",
  extension_ok: "Giá cách mức breakout {pct}%, trong giới hạn {cap}%.",
  pullback_depth_ok: "Nhịp pullback sâu {depth}% dưới mức breakout, trong giới hạn {cap}%.",
  no_material_dip: "Nhịp pullback không xuống đáng kể dưới mức breakout.",
  stop_anchor: "Mức vô hiệu {stop}, thấp hơn đáy swing gần nhất {swingLow} khoảng {cushion}%.",
  tier_a:
    "Hạng A: khối lượng gấp {ratio} lần trung vị (ngưỡng {min} lần) và giá đóng cửa không dưới MA20.",
  tier_b:
    "Hạng B: setup hợp lệ, nhưng khối lượng hoặc vị trí giá so với MA20 yếu hơn hạng A (khối lượng vẫn từ {min} lần trung vị).",
};

export const UNMAPPED_REASON_COPY = "Lý do từ bộ quét, chưa có bản tiếng Việt: {raw}";

export type RiskSeverity = "info" | "warn" | "high";

export const RISK_CODES = [
  "regime_fail",
  "regime_warning",
  "regime_unknown",
  "stale_data",
  "stale_setup",
  "gap_through_stop",
  "limit_down_run",
  "stop_too_tight",
  "resistance_below_2r",
  "liquidity_thin",
  "liquidity_unknown",
  "exchange_assumed",
  "settlement_lockup",
  "tier_b",
] as const;

export type RiskCode = (typeof RISK_CODES)[number];

export const RISK_COPY: Record<RiskCode, string> = {
  regime_fail:
    "Cổng 1 đang ở mức FAIL: VN-Index đóng cửa dưới MA50 và ba giá đóng cửa gần nhất giảm dần, bối cảnh thị trường bất lợi cho setup mua.",
  regime_warning: "Cổng 1 đang ở mức WARNING: bối cảnh thị trường chưa thuận.",
  regime_unknown: "Chưa đọc được chế độ thị trường (Cổng 1), bối cảnh chưa rõ.",
  stale_data:
    "Nến mới nhất của mã là phiên {asOf}, cũ hơn phiên thị trường {expected}: vùng giá và biên độ có thể đã lệch.",
  stale_setup:
    "Thiết lập từ phiên {setupSession}, dữ liệu đã có thêm {sessions} phiên sau đó: cấu trúc chưa được quét lại.",
  gap_through_stop:
    "Gap xuyên stop: một phiên mở giảm sàn ({bandPct}%) từ {entryTop} về {floor}, dưới đáy vùng SL {stop}. Lỗ khi đó {loss}/cp, bằng {lossR}R.",
  limit_down_run:
    "Kịch bản sàn liên tiếp: {n} phiên giảm sàn liền từ {entryTop} đưa giá về {price}, dưới vùng SL. Lỗ khi không thoát được {loss}/cp, bằng {lossR}R.",
  stop_too_tight:
    "Mức vô hiệu theo cấu trúc {structural} sát hơn mức stop tối thiểu {minFeasible}: nhiễu một phiên có thể chạm tới nó. Vùng SL vì thế kéo xuống {low}.",
  resistance_below_2r: "Kháng cự {resistance} nằm dưới mốc 2R {target}: giá có thể gặp cản trước mốc.",
  liquidity_thin:
    "Giá trị giao dịch bình quân 20 phiên khoảng {adv}, dưới mốc {threshold}: 1% con số đó chỉ bằng khoảng {lots} lô 100 cp ở {entryTop}, thoát vị thế lớn có thể khó, nhất là phiên giảm sàn. {caveat}",
  liquidity_unknown: "Chưa có giá trị giao dịch bình quân 20 phiên của mã, thanh khoản chưa đánh giá được.",
  exchange_assumed:
    "Mã chưa có sàn trong dữ liệu: bước giá và biên độ đang giả định theo HOSE, sàn thật có thể khác.",
  settlement_lockup:
    "T+2,5: cổ phiếu khớp hôm nay khoảng 2,5 phiên sau mới về tài khoản. Hai phiên giảm sàn từ {entryTop} là {price}, đã dưới vùng SL: giá có thể xuyên stop trước khi bán được.",
  tier_b: "Hạng B: khối lượng xác nhận hoặc vị trí giá so với MA20 yếu hơn hạng A.",
};

/** Caveat carried by every liquidity figure built on `symbol-adv` (close × 1000 × volMa20). */
export const ADV_ADJUSTED_PRICE_CAVEAT =
  "Con số này nhân giá đã điều chỉnh với khối lượng thô, vì vậy bị lệch ở mã từng chia cổ tức hoặc tách cổ phiếu.";

/**
 * Imperative wording the copy must never contain (ADR 0003, audit F08). Case
 * sensitive where the word is only imperative as an all-caps label ("MUA"),
 * insensitive for phrases that are imperative in any case.
 */
// Built from strings: `\p{L}` (any letter, so Vietnamese diacritics count as
// word characters) needs the `u` flag, which the TS target rejects in literals.
const word = (alternatives: string, flags: string) =>
  new RegExp(String.raw`(^|[^\p{L}])(${alternatives})([^\p{L}]|$)`, flags);

export const BANNED_IMPERATIVE_PATTERNS: readonly RegExp[] = [
  word("MUA|BÁN", "u"),
  word("mua ngay|bán ngay|vào ngay|vào lệnh|đặt lệnh|chốt lời ngay|cắt lỗ ngay", "iu"),
  word("hãy|nên|cần phải|khuyến nghị|khuyên", "iu"),
  word("buy|sell|enter now", "iu"),
];
