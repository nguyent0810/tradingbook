import type {
  LeaderboardRowDto,
  PortfolioCardDto,
  RecentBattleSummaryDto,
} from "@/lib/paper-lab/types/arena-dto";
import { hofLabel, hofValue } from "./hof-format";

/**
 * View model cho màn F3 Đấu trường.
 *
 * Mọi cột đều phải có nguồn thật trong DTO/DB. Cột nào bản thiết kế có mà dữ
 * liệu không có (ví dụ chuỗi thắng/thua liên tiếp) thì **bỏ cột**, không bịa —
 * một bảng xếp hạng mô phỏng mà có số bịa thì vô dụng.
 */

export type AgentClass = "AI" | "HUMAN" | "BENCHMARK";

/** Chưa tra được lớp tác tử — không đoán, hiện gap. */
export type AgentClassOrUnknown = AgentClass | "UNKNOWN";

export type F3AgentRow = {
  rank: number;
  agentId: string;
  name: string;
  agentClass: AgentClassOrUnknown;
  classLabel: string;
  classColor: string;
  tradeCount: number | null;
  winRatePct: number | null;
  sharpeLike: number | null;
  pnlPct: number | null;
  maxDrawdownPct: number | null;
  navSparkline: number[];
};

export type F3BattleRow = {
  id: string;
  session: string;
  symbol: string;
  status: string;
  statusColor: string;
  agentCount: number;
  /** Tác tử thắng; `null` khi trận chưa có kết quả. */
  winner: string | null;
  benchmarkPct: number | null;
  insight: string;
};

export type F3BattleAgentRow = {
  agent: string;
  agentClass: AgentClass;
  classLabel: string;
  classColor: string;
  action: string;
  confidence: number | null;
  /** Kết quả 5 phiên; `null` khi trận chưa chốt. */
  forwardReturn5dPct: number | null;
  rMultiple: number | null;
  verdict: string;
  verdictColor: string;
  reasoning: string;
};

export type F3BattleDetail = {
  id: string;
  session: string;
  symbol: string;
  status: string;
  benchmarkPct: number | null;
  rows: F3BattleAgentRow[];
};

export type F3HofRow = {
  id: string;
  type: string;
  agent: string;
  symbol: string;
  session: string;
  value: string;
};

export type F3HumanRow = {
  id: string;
  tag: string;
  tagColor: string;
  message: string;
};

export type F3ViewModel = {
  disclaimer: {
    agentCount: number | null;
    decisionCount: number | null;
    battleCount: number | null;
  };
  agents: F3AgentRow[];
  agentsEmptyReason: string | null;
  battles: F3BattleRow[];
  battleDetails: Record<string, F3BattleDetail>;
  battlesEmptyReason: string | null;
  hof: F3HofRow[];
  hofEmptyReason: string | null;
  humanLog: F3HumanRow[];
  humanLogEmptyReason: string | null;
};

const CLASS_UI: Record<AgentClassOrUnknown, { label: string; color: string }> = {
  AI: { label: "LLM", color: "var(--tm-ceil)" },
  HUMAN: { label: "NGƯỜI", color: "var(--tm-floor)" },
  BENCHMARK: { label: "CHUẨN", color: "var(--tm-text-soft)" },
  // Tra trượt hoặc truy vấn hỏng ⇒ gap. Mặc định về "LLM" sẽ hiển thị sai một
  // tác tử NGƯỜI thành máy — sai nghiêm trọng trên màn so kè người vs tác tử.
  UNKNOWN: { label: "—", color: "var(--tm-text-faint)" },
};

const BATTLE_STATUS_UI: Record<string, { label: string; color: string }> = {
  OPEN: { label: "ĐANG CHẠY", color: "var(--tm-accent)" },
  RESOLVED: { label: "XONG", color: "var(--tm-up)" },
  ARCHIVED: { label: "LƯU TRỮ", color: "var(--tm-text-faint)" },
};

/** Kết quả coi là "thắng" của một quyết định trong trận. */
const WINNING_VERDICTS = new Set(["CORRECT_BUY", "CORRECT_AVOID", "CORRECT_RISK"]);

const VERDICT_UI: Record<string, { label: string; color: string }> = {
  PENDING: { label: "CHỜ", color: "var(--tm-text-faint)" },
  OPEN: { label: "ĐANG MỞ", color: "var(--tm-accent)" },
  NEUTRAL: { label: "HOÀ", color: "var(--tm-ref)" },
  CORRECT_BUY: { label: "MUA ĐÚNG", color: "var(--tm-up)" },
  CORRECT_AVOID: { label: "TRÁNH ĐÚNG", color: "var(--tm-up)" },
  CORRECT_RISK: { label: "CHẶN RỦI RO ĐÚNG", color: "var(--tm-up)" },
  WRONG_BUY: { label: "MUA SAI", color: "var(--tm-down)" },
  WRONG_AVOID: { label: "TRÁNH SAI", color: "var(--tm-down)" },
};

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

export type BattleRecord = {
  id: string;
  sessionDate: Date;
  symbol: string;
  status: string;
  benchmarkReturn5dPct: number | null;
  battleDecisions: {
    id: string;
    agentId: string;
    action: string;
    confidence: number;
    reasoning: string | null;
    agent: { id: string; displayName: string; agentClass: string } | null;
  }[];
  outcomes: {
    battleDecisionId: string;
    agentId: string;
    verdict: string;
    rMultiple: number | null;
    forwardReturn5dPct: number | null;
  }[];
};

export type F3ViewModelInput = {
  leaderboard: LeaderboardRowDto[];
  portfolios: PortfolioCardDto[];
  /**
   * Lớp tác tử theo **slug** — DTO bảng xếp hạng không mang trường này, và
   * `LeaderboardRowDto.agentId` thực chất là `PaperAgent.slug` chứ không phải
   * `PaperAgent.id` (xem `load-paper-lab-page-from-db.ts`). Tra bằng id sẽ trượt
   * toàn bộ và mọi tác tử NGƯỜI bị hiển thị nhầm thành LLM.
   */
  agentClassBySlug: Map<string, AgentClass>;
  battles: BattleRecord[];
  /**
   * `true` khi truy vấn trận đấu HỎNG. Khi đó `battles` rỗng vì không đọc được,
   * không phải vì không có trận nào — banner phải hiện "—" chứ không hiện 0.
   *
   * Cố ý là `boolean` chứ không phải chuỗi lỗi: đây là câu hỏi "số trận có đo
   * được không", không phải kênh bằng chứng. Nguyên văn lỗi đi đường riêng —
   * `battles.error` chảy vào `loadError` của màn VÀ vào `emptyReasons.battles`.
   */
  battlesLoadFailed?: boolean;
  recentBattles: RecentBattleSummaryDto[];
  /** Kỷ lục thô — `achievementType` quyết định đơn vị của `value`. */
  hof: {
    id: string;
    achievementType: string;
    agent: string;
    session: string;
    symbol: string;
    value: number;
  }[];
  humanCalls: { id: string; symbol: string; action: string; reasoning: string; kind: "override" | "accepted" }[];
  totalAgents: number | null;
  decisionCount: number | null;
  /** Lý do rỗng, kèm bằng chứng thật khi truy vấn hỏng. */
  emptyReasons: {
    agents: string;
    battles: string;
    hof: string;
    humanLog: string;
  };
};

function fmtSessionIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Tác tử thắng trận: quyết định có verdict đúng đầu tiên. */
function winnerOf(battle: BattleRecord): string | null {
  const decisionById = new Map(battle.battleDecisions.map((d) => [d.id, d]));
  for (const outcome of battle.outcomes) {
    if (!WINNING_VERDICTS.has(outcome.verdict)) continue;
    const decision = decisionById.get(outcome.battleDecisionId);
    if (decision?.agent) return decision.agent.displayName;
  }
  return null;
}

export function buildF3ViewModel(input: F3ViewModelInput): F3ViewModel {
  const sparkByAgent = new Map(input.portfolios.map((p) => [p.agentId, p.navSparkline ?? []]));

  const agents: F3AgentRow[] = input.leaderboard.map((row) => {
    const agentClass: AgentClassOrUnknown = input.agentClassBySlug.get(row.agentId) ?? "UNKNOWN";
    const ui = CLASS_UI[agentClass];
    return {
      rank: row.rank,
      agentId: row.agentId,
      name: row.agentName,
      agentClass,
      classLabel: ui.label,
      classColor: ui.color,
      tradeCount: finite(row.tradeCount),
      // `winRate` trong DTO là **tỉ lệ 0..1**, không phải phần trăm — nhân 100 ở
      // đây để cột hiện 62,5% chứ không phải 0,6%. `pnlPct` và `maxDrawdownPct`
      // thì đã là phần trăm sẵn, không nhân.
      winRatePct: finite(row.winRate) == null ? null : (row.winRate as number) * 100,
      sharpeLike: finite(row.sharpeLike),
      pnlPct: finite(row.pnlPct),
      maxDrawdownPct: finite(row.maxDrawdownPct),
      navSparkline: sparkByAgent.get(row.agentId) ?? [],
    };
  });

  const insightBySession = new Map(
    input.recentBattles.map((b) => [`${b.sessionDate}:${b.symbol}`, b.insight])
  );

  const battleDetails: Record<string, F3BattleDetail> = {};

  const battles: F3BattleRow[] = input.battles.map((battle) => {
    const session = fmtSessionIso(battle.sessionDate);
    const status = BATTLE_STATUS_UI[battle.status] ?? {
      label: battle.status,
      color: "var(--tm-text-faint)",
    };
    const outcomeByDecision = new Map(battle.outcomes.map((o) => [o.battleDecisionId, o]));
    battleDetails[battle.id] = {
      id: battle.id,
      session,
      symbol: battle.symbol,
      status: status.label,
      benchmarkPct: finite(battle.benchmarkReturn5dPct),
      rows: battle.battleDecisions.map((decision) => {
        const outcome = outcomeByDecision.get(decision.id);
        const agentClass: AgentClass =
          decision.agent?.agentClass === "HUMAN" ? "HUMAN" : "AI";
        const verdictUi = VERDICT_UI[outcome?.verdict ?? "PENDING"] ?? {
          label: outcome?.verdict ?? "CHỜ",
          color: "var(--tm-text-faint)",
        };
        return {
          agent: decision.agent?.displayName ?? decision.agentId,
          agentClass,
          classLabel: CLASS_UI[agentClass].label,
          classColor: CLASS_UI[agentClass].color,
          action: decision.action,
          confidence: finite(decision.confidence),
          forwardReturn5dPct: finite(outcome?.forwardReturn5dPct),
          rMultiple: finite(outcome?.rMultiple),
          verdict: verdictUi.label,
          verdictColor: verdictUi.color,
          reasoning: decision.reasoning ?? "",
        };
      }),
    };

    return {
      id: battle.id,
      session,
      symbol: battle.symbol,
      status: status.label,
      statusColor: status.color,
      agentCount: battle.battleDecisions.length,
      winner: winnerOf(battle),
      benchmarkPct: finite(battle.benchmarkReturn5dPct),
      insight: insightBySession.get(`${session}:${battle.symbol}`) ?? "",
    };
  });

  const hof: F3HofRow[] = input.hof.map((entry) => ({
    id: entry.id,
    type: hofLabel(entry.achievementType),
    agent: entry.agent,
    symbol: entry.symbol,
    session: entry.session,
    // Đơn vị theo loại thành tích — xem `hof-format.ts`.
    value: hofValue(entry.achievementType, entry.value),
  }));

  const humanLog: F3HumanRow[] = input.humanCalls.map((call) => ({
    id: call.id,
    tag: call.kind === "override" ? "GHI ĐÈ" : "ĐỒNG Ý",
    tagColor: call.kind === "override" ? "var(--tm-accent)" : "var(--tm-up)",
    message: `${call.symbol} · ${call.action}${call.reasoning ? ` — ${call.reasoning}` : ""}`,
  }));

  return {
    disclaimer: {
      agentCount: finite(input.totalAgents),
      decisionCount: finite(input.decisionCount),
      battleCount: input.battlesLoadFailed ? null : battles.length,
    },
    agents,
    agentsEmptyReason: agents.length === 0 ? input.emptyReasons.agents : null,
    battles,
    battleDetails,
    battlesEmptyReason: battles.length === 0 ? input.emptyReasons.battles : null,
    hof,
    hofEmptyReason: hof.length === 0 ? input.emptyReasons.hof : null,
    humanLog,
    humanLogEmptyReason: humanLog.length === 0 ? input.emptyReasons.humanLog : null,
  };
}
