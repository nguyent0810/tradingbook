import type { AgentAction, AgentDecisionOutput, CioRecommendation } from "@/lib/paper-lab/types/agent-decision.schema";
import { PAPER_AGENT_SEEDS } from "@/lib/paper-lab/constants";
import { consensusLabel, consensusScoreDisplay } from "./arena-format";

export type DecisionExplanation = {
  summary: string;
  supporting: string[];
  opposing: string[];
  styleLens: string;
  auditReasoning?: string;
};

export type CioPresentation = {
  decisionSummary: string;
  supportingReasons: string[];
  consensusLabel: "Yếu" | "Trung bình" | "Mạnh";
  consensusScoreDisplay: string;
  regimeContext: string;
  actionVotes: { buy: number; hold: number; sell: number; reduce: number; exit: number };
  dissent: Array<{ agentName: string; action: AgentAction; humanReason: string }>;
};

const SIGNAL_LABELS: Record<string, string> = {
  gate2_quality_A: "Chất lượng thiết lập hạng A (mẫu hình breakout-pullback mạnh)",
  gate2_quality_B: "Chất lượng thiết lập hạng B (mẫu hình chấp nhận được)",
  weak_regime: "Chế độ thị trường chung vẫn còn yếu (Gate 1 CẢNH BÁO)",
  llm_unavailable: "LLM không khả dụng — đã áp dụng quy tắc dự phòng",
};

const STYLE_LENSES: Record<string, string> = {
  Defensive: "Yêu cầu xác nhận thị trường mạnh trước khi giải ngân vốn.",
  Offensive: "Chấp nhận chế độ thị trường yếu hơn khi chất lượng thiết lập đạt yêu cầu.",
  Trend: "Cần xu hướng trung hạn và dài hạn đồng thuận trước khi vào lệnh.",
  Momentum: "Cần khối lượng gia tăng và sức mạnh tương đối dẫn dắt.",
  Value: "Tìm mức giá hấp dẫn tương ứng với hạng chất lượng thiết lập.",
  Swing: "Tập trung vào rủi ro/lợi nhuận của thiết lập breakout-pullback.",
  MeanRev: "Ưu tiên điều kiện đảo chiều về trung bình hơn là xu hướng tiếp diễn.",
  Risk: "Ưu tiên giới hạn tỷ trọng danh mục và bảo vệ trước rủi ro giảm giá.",
  Contrarian: "Thách thức đồng thuận và cảnh báo rủi ro giảm giá bất cân xứng.",
};

function agentDisplayName(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.displayName ?? slug.replace(/_/g, " ");
}

function agentStyle(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.style ?? "General";
}

export function humanizeSignal(code: string): string {
  return SIGNAL_LABELS[code] ?? code.replace(/_/g, " ");
}

export function getStyleLens(agentId: string): string {
  return STYLE_LENSES[agentStyle(agentId)] ?? "Evaluates setup against agent-specific rules.";
}

function buildAgentActionSummary(
  agentId: string,
  action: AgentAction,
  symbol: string,
  regime: string,
  setupQuality: string | null
): string {
  const style = agentStyle(agentId);
  const q = setupQuality ?? "none";

  if (action === "BUY" || action === "ADD") {
    switch (style) {
      case "Offensive":
        return `Thiết lập trên ${symbol} hợp lệ; agent này chấp nhận điều kiện chế độ thị trường yếu hơn khi chất lượng là ${q}.`;
      case "Swing":
        return `Thiết lập pullback trên ${symbol} đạt tiêu chuẩn tối thiểu về rủi ro/lợi nhuận — agent đã mở vị thế mua.`;
      case "Trend":
        return `Xu hướng đồng thuận ủng hộ việc vào lệnh mua ${symbol} trong chế độ thị trường hiện tại (${regime}).`;
      case "Momentum":
        return `Sức mạnh tương đối và tiêu chí động lượng ủng hộ việc mua ${symbol}.`;
      case "Defensive":
        return `Thiết lập mạnh và chế độ thị trường thuận lợi — agent phòng thủ chấp thuận vào lệnh có kiểm soát trên ${symbol}.`;
      case "Value":
        return `Giá và hạng thiết lập của ${symbol} đáp ứng tiêu chí vào lệnh theo giá trị.`;
      default:
        return `Agent nhận thấy đủ xác nhận để ${action === "ADD" ? "gia tăng vị thế" : "mở vị thế"} ${symbol}.`;
    }
  }

  if (action === "REDUCE" || action === "EXIT" || action === "SELL") {
    return `Agent khuyến nghị giảm tỷ trọng ${symbol} do quy tắc rủi ro hoặc thoát lệnh.`;
  }

  switch (style) {
    case "Momentum":
      return `Khối lượng gia tăng chưa đủ để vào lệnh theo động lượng trên ${symbol}.`;
    case "Value":
      return `Giá chưa đủ hấp dẫn so với tiêu chí giá trị nội tại của ${symbol}.`;
    case "Risk":
      return `Chế độ thị trường đang ở mức ${regime} và giới hạn rủi ro danh mục ủng hộ việc chờ đợi với ${symbol}.`;
    case "Contrarian":
      return `Thiết lập có thể hiệu quả, nhưng rủi ro giảm giá bất cân xứng trên ${symbol} vẫn đáng lo ngại.`;
    case "Defensive":
      return `Xác nhận xu hướng vẫn còn yếu — agent ưu tiên chờ đợi với ${symbol}.`;
    case "Offensive":
      return `Dù có lập trường tấn công, các tín hiệu hiện tại trên ${symbol} chưa đủ để vào lệnh.`;
    case "Trend":
      return `Xu hướng trung hạn chưa được xác nhận — đang chờ đợi với ${symbol}.`;
    case "Swing":
      return `Vùng pullback hoặc ngưỡng R:R chưa đạt cho ${symbol} hôm nay.`;
    case "MeanRev":
      return `Điều kiện đảo chiều về trung bình chưa xuất hiện — không hành động với ${symbol}.`;
    default:
      return `Chưa đủ xác nhận để giao dịch ${symbol} trong điều kiện hiện tại.`;
  }
}

export function buildDecisionExplanation(input: {
  agentId: string;
  action: AgentAction;
  symbol: string;
  reasoningSummary?: string | null;
  payload?: Partial<AgentDecisionOutput> | null;
}): DecisionExplanation {
  const payload = input.payload;
  const regime = payload?.market_regime_assumption ?? "UNKNOWN";
  const setupQuality =
    payload?.supporting_signals?.includes("gate2_quality_A")
      ? "A"
      : payload?.supporting_signals?.includes("gate2_quality_B")
        ? "B"
        : null;

  const supporting = (payload?.supporting_signals ?? []).map(humanizeSignal);
  const opposing = (payload?.opposing_signals ?? []).map(humanizeSignal);

  if (supporting.length === 0 && setupQuality) {
    supporting.push(humanizeSignal(`gate2_quality_${setupQuality}`));
  }
  if (opposing.length === 0 && regime === "WARNING") {
    opposing.push(humanizeSignal("weak_regime"));
  }

  const summary = buildAgentActionSummary(
    input.agentId,
    input.action,
    input.symbol,
    regime,
    setupQuality
  );

  return {
    summary,
    supporting: supporting.slice(0, 3),
    opposing: opposing.slice(0, 3),
    styleLens: getStyleLens(input.agentId),
    auditReasoning: input.reasoningSummary ?? payload?.reasoning ?? undefined,
  };
}

/** Build human-readable reasoning string for agent persistence. */
export function buildAgentReasoningSummary(input: {
  agentId: string;
  action: AgentAction;
  symbol: string;
  payload: Pick<AgentDecisionOutput, "supporting_signals" | "opposing_signals" | "market_regime_assumption">;
}): string {
  return buildDecisionExplanation({
    agentId: input.agentId,
    action: input.action,
    symbol: input.symbol,
    payload: input.payload,
  }).summary;
}

export function buildCioPresentation(
  rec: CioRecommendation & { regime_context?: string },
  panelDecisions?: Array<{ action: AgentAction; agent_id?: string }>
): CioPresentation {
  const votes = { buy: 0, hold: 0, sell: 0, reduce: 0, exit: 0 };
  if (panelDecisions) {
    for (const d of panelDecisions) {
      const key = d.action.toLowerCase() as keyof typeof votes;
      if (key in votes) votes[key]++;
    }
  } else {
    for (const s of rec.supporting_agents) {
      const key = s.action.toLowerCase() as keyof typeof votes;
      if (key in votes) votes[key]++;
    }
    for (const d of rec.dissenting_agents) {
      const key = d.action.toLowerCase() as keyof typeof votes;
      if (key in votes) votes[key]++;
    }
  }

  const label = consensusLabel(rec.consensus_score);
  const scoreDisplay = consensusScoreDisplay(rec.consensus_score);

  const supportingReasons: string[] = [];
  if (rec.final_action === "HOLD") {
    supportingReasons.push("Hầu hết agent không thấy đủ xác nhận cho một giao dịch có độ tin cậy cao.");
    supportingReasons.push("Chế độ thị trường chung làm giảm độ tin cậy tập thể.");
  } else if (rec.final_action === "BUY" || rec.final_action === "ADD") {
    supportingReasons.push("Đồng thuận có trọng số của các agent ủng hộ việc tham gia vị thế.");
    if (rec.supporting_agents.length > 0) {
      supportingReasons.push(
        `${rec.supporting_agents.length} agent ủng hộ vào lệnh theo hướng này với trọng số dương.`
      );
    }
  } else {
    supportingReasons.push("Đồng thuận ủng hộ việc giảm hoặc thoát vị thế.");
  }

  const regimeContext =
    (rec as { regime_context?: string }).regime_context ??
    rec.metadata?.regime ??
    "Chế độ thị trường không xác định";

  let decisionSummary = rec.reasoning;
  if (rec.reasoning.includes("weighted consensus")) {
    decisionSummary =
      rec.final_action === "HOLD"
        ? "CIO khuyến nghị chờ đợi — đồng thuận giữa các agent còn phân tán và độ tin cậy hạn chế."
        : rec.final_action === "BUY"
          ? "CIO nhận thấy đủ sự ủng hộ có trọng số để nghiêng về vào lệnh, kèm một số lưu ý."
          : "CIO khuyến nghị hành động phòng thủ dựa trên điểm số có trọng số của các agent.";
  }

  const dissent = rec.dissenting_agents.map((d) => ({
    agentName: agentDisplayName(d.agent_id),
    action: d.action,
    humanReason: buildDissentReason(d.agent_id, d.action, d.reason),
  }));

  return {
    decisionSummary,
    supportingReasons,
    consensusLabel: label,
    consensusScoreDisplay: scoreDisplay,
    regimeContext,
    actionVotes: votes,
    dissent,
  };
}

function buildDissentReason(agentId: string, action: AgentAction, rawReason: string): string {
  if (rawReason.includes("rule evaluation")) {
    const style = agentStyle(agentId);
    if (action === "BUY" || action === "ADD") {
      if (style === "Offensive") {
        return "Ưu tiên MUA vì chấp nhận chế độ thị trường yếu hơn khi chất lượng thiết lập ở mức chấp nhận được.";
      }
      if (style === "Swing") {
        return "Ưu tiên MUA vì thiết lập pullback đạt tiêu chuẩn tối thiểu về rủi ro/lợi nhuận.";
      }
      return "Nhận thấy thiết lập hợp lệ và ủng hộ vào lệnh bất chấp thận trọng của CIO.";
    }
    if (style === "Contrarian") {
      return "Cảnh báo rủi ro giảm giá bất cân xứng ngay cả khi thiết lập có vẻ hợp lệ.";
    }
    return "Ưu tiên chờ đợi đến khi thị trường xác nhận rõ ràng hơn.";
  }
  return rawReason;
}

export const POSITION_GLOSSARY: Record<string, string> = {
  Entry: "Giá vào lệnh trung bình trên mỗi cổ phiếu (nghìn VNĐ).",
  Stop: "Mức cắt lỗ — thoát lệnh nếu giá đóng cửa dưới mức này.",
  TP: "Giá mục tiêu chốt lời cho vị thế.",
  "Qty (Lot)": "Khối lượng cổ phiếu tính theo lô 100 cổ phiếu (quy định thị trường VN).",
  "Alloc %": "Quy mô vị thế tính theo phần trăm NAV danh mục của agent.",
  Risk: "Vốn tối đa gặp rủi ro nếu chạm mức cắt lỗ.",
  UPNL: "Lãi/lỗ chưa thực hiện tính bằng VNĐ theo giá đánh giá gần nhất.",
  "UPNL %": "Tỷ suất sinh lời chưa thực hiện trên vốn gốc của vị thế.",
  R: "R = lãi/lỗ hiện tại chia cho mức rủi ro ban đầu từ giá vào lệnh đến cắt lỗ.",
  Days: "Số ngày theo lịch kể từ khi mở vị thế.",
  Status: "OPEN = khớp toàn bộ; PARTIAL = khớp một phần.",
};

export const CONSENSUS_TOOLTIP =
  "Đồng thuận có trọng số kết hợp hành động, độ tin cậy và trọng số uy tín của từng agent thành một điểm số duy nhất từ -100 đến +100. Điểm gần 0 cho thấy mức độ tin cậy phân tán.";

export function buildBattleInsight(
  rows: Array<{ action: AgentAction }>,
  symbol: string
): string {
  const buy = rows.filter((r) => r.action === "BUY" || r.action === "ADD").length;
  const hold = rows.filter((r) => r.action === "HOLD").length;
  const sell = rows.filter(
    (r) => r.action === "SELL" || r.action === "EXIT" || r.action === "REDUCE"
  ).length;

  if (buy > 0 && hold > buy) {
    return `Hầu hết agent đứng ngoài ${symbol} dù có thiết lập hợp lệ — bộ lọc chế độ thị trường và phong cách khiến hội đồng chia rẽ (${buy} MUA, ${hold} GIỮ).`;
  }
  if (buy === 0 && hold > 0) {
    return `Không agent nào cam kết với ${symbol}; hội đồng ưu tiên chờ xác nhận mạnh hơn.`;
  }
  if (buy > hold) {
    return `Đa số agent ủng hộ vào lệnh ${symbol} (${buy} MUA so với ${hold} GIỮ).`;
  }
  return `Hội đồng phân tán về ${symbol}: ${buy} MUA, ${hold} GIỮ, ${sell} giảm/thoát.`;
}

const DIMENSION_LABELS: Record<string, string> = {
  WeakBull: "Xu hướng tăng yếu",
  StrongBull: "Xu hướng tăng mạnh",
  Bear: "Xu hướng giảm",
  Sideways: "Xu hướng đi ngang",
  Contracting: "Biến động thu hẹp",
  Expanding: "Biến động mở rộng",
  Rotation: "Xoay vòng ngành",
  Broad: "Tham gia rộng",
  Narrow: "Dẫn dắt hẹp",
  HighLiquidity: "Thanh khoản cao",
  LowLiquidity: "Thanh khoản thấp",
};

export function formatRegimeDimension(value: string): string {
  return DIMENSION_LABELS[value] ?? value.replace(/([A-Z])/g, " $1").trim();
}

export function buildRegimeExplanation(input: {
  level: "PASS" | "WARNING" | "FAIL";
  label: string;
  confidence?: number;
  dimensions?: Record<string, string>;
}): string {
  const conf = input.confidence != null ? `${Math.round(input.confidence)}% độ tin cậy mô hình` : "đang chờ độ tin cậy";
  const trend = input.dimensions?.trendRegime
    ? formatRegimeDimension(input.dimensions.trendRegime)
    : "xu hướng hỗn hợp";
  const vol = input.dimensions?.volatilityRegime
    ? formatRegimeDimension(input.dimensions.volatilityRegime)
    : "biến động trung tính";
  const breadth = input.dimensions?.breadthRegime
    ? formatRegimeDimension(input.dimensions.breadthRegime)
    : "độ rộng hỗn hợp";

  const gate =
    input.level === "PASS"
      ? "Gate 1 quét thị trường ủng hộ việc chọn lọc chấp nhận rủi ro."
      : input.level === "WARNING"
        ? "Gate 1 đang ở mức CẢNH BÁO — các agent áp dụng bộ lọc chặt chẽ hơn trước khi giải ngân vốn."
        : "Gate 1 ở mức KHÔNG ĐẠT — hầu hết agent trì hoãn vào lệnh mới cho đến khi điều kiện cải thiện.";

  return `${input.label} (${conf}). ${trend}, ${vol} và ${breadth} định hình hội đồng hôm nay. ${gate}`;
}
