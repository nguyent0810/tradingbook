import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { queryHallOfFame } from "@/lib/lab/hall-of-fame/detect-achievements";
import { loadPaperLabPage } from "@/lib/paper-lab/load-paper-lab-page";
import { loadArenaBattlesResult } from "@/lib/paper-lab/queries/load-arena-battles";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import { fmtSessionDate } from "@/lib/format/vn";
import {
  buildF3ViewModel,
  type AgentClass,
} from "@/lib/paper-lab/terminal/f3-view-model";
import { F3Screen } from "@/components/paper-lab/terminal/f3-screen";
import "@/styles/terminal-f3.css";

export const metadata: Metadata = {
  title: "F3 Đấu trường — TradeLog VN Terminal",
  description:
    "Đấu trường mô phỏng — các tác tử cạnh tranh trên cùng dữ liệu thị trường. Không dùng vốn thật.",
};

type Fallible<T> = { data: T; error: string | null };

async function fallible<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<Fallible<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    console.error(`[paper-lab] ${label} failed:`, e);
    return { data: fallback, error: `${label} → ${String(e)}` };
  }
}

/**
 * Lớp tác tử theo **slug** — `LeaderboardRowDto.agentId` mang `PaperAgent.slug`,
 * không phải `PaperAgent.id`.
 */
async function loadAgentClasses(): Promise<Map<string, AgentClass>> {
  const agents = await prisma.paperAgent.findMany({
    select: { slug: true, agentClass: true },
  });
  return new Map(
    agents.map((a) => [a.slug, (a.agentClass === "HUMAN" ? "HUMAN" : "AI") as AgentClass])
  );
}

/** Quyết định gần nhất của tác tử lớp NGƯỜI. */
async function loadHumanCalls() {
  const rows = await prisma.agentDecision.findMany({
    where: { agent: { agentClass: "HUMAN" } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, symbol: true, action: true, reasoningSummary: true },
  });
  return rows.map((d) => {
    const reasoning = d.reasoningSummary ?? "";
    return {
      id: d.id,
      symbol: d.symbol,
      action: d.action,
      reasoning,
      // Người "ghi đè" khi lập luận nói rõ là bỏ qua / đi ngược đề xuất tác tử.
      kind: /override|ghi đè|bỏ qua|pass|stand/i.test(reasoning)
        ? ("override" as const)
        : ("accepted" as const),
    };
  });
}

export default async function PaperLabPage() {
  await connection();

  const [page, battles, hof, agentClassBySlug, humanCalls, decisionCount, marketSession] =
    await Promise.all([
      loadPaperLabPage(),
      loadArenaBattlesResult(),
    fallible("queryHallOfFame()", () => queryHallOfFame(prisma, { limit: 15 }), []),
    fallible(
      "prisma.paperAgent.findMany(slug, agentClass)",
      loadAgentClasses,
      new Map<string, AgentClass>()
    ),
    fallible("prisma.agentDecision.findMany(HUMAN)", loadHumanCalls, []),
    fallible("prisma.agentDecision.count()", () => prisma.agentDecision.count(), null),
    fallible(
      "getExpectedLatestSessionFromIndexBars()",
      () => getExpectedLatestSessionFromIndexBars(prisma),
      null
    ),
  ]);

  // Chỉ dữ liệu THẬT mới được vào view model. Rỗng hay lỗi đều cho mảng trống
  // để panel hiện đúng trạng thái của nó, không mượn số của bộ dữ liệu mẫu.
  const dto = page.kind === "ok" ? page.dto : null;
  const dtoError = page.kind === "error" ? page.error : null;
  const dtoEmptyReason = page.kind === "empty" ? page.reason : null;

  const model = buildF3ViewModel({
    leaderboard: dto?.leaderboard ?? [],
    portfolios: dto?.portfolios ?? [],
    agentClassBySlug: agentClassBySlug.data,
    battles: battles.rows,
    // Đọc lỗi ⇒ số trận là KHÔNG BIẾT, không phải 0.
    battlesLoadFailed: battles.error != null,
    recentBattles: dto?.recentBattles ?? [],
    hof: hof.data.map((e) => ({
      id: e.id,
      achievementType: e.achievementType,
      agent: e.agent?.displayName ?? "—",
      session: e.sessionDate?.toISOString().slice(0, 10) ?? "—",
      symbol: e.symbol ?? "—",
      value: e.value,
    })),
    humanCalls: humanCalls.data,
    totalAgents: dto?.overview.totalAgents ?? null,
    decisionCount: decisionCount.data,
    emptyReasons: {
      agents:
        dtoError ??
        dtoEmptyReason ??
        "Chưa có danh mục mô phỏng nào được khởi tạo cho tác tử.",
      battles:
        battles.error ??
        "Cần tối thiểu 2 tác tử cùng ra quyết định trên một mã trong cùng phiên để tạo trận đấu.",
      hof: hof.error ?? "Chưa có trận nào chốt kết quả để ghi vào bảng vàng.",
      humanLog:
        humanCalls.error ?? "Chưa có tác tử lớp NGƯỜI nào ghi quyết định trong đấu trường.",
    },
  });

  // Dữ liệu cũ: mọi chỉ số bảng xếp hạng đo trên phiên `performanceSessionDate`.
  // Nếu thị trường đã có phiên mới hơn thì bảng đang nói về quá khứ — bàn giao §6
  // buộc nêu rõ đang xem phiên nào và hệ quả, chứ không hiện như số hiện hành.
  // Độ tươi ở thanh trên chỉ nói về lần quét/VNINDEX, không chứng minh cho số đo
  // mô phỏng này.
  const perfSession = dto?.overview.performanceSessionDate ?? null;
  const marketSessionLabel = marketSession.data
    ? marketSession.data.toISOString().slice(0, 10)
    : null;
  const stale =
    perfSession && marketSessionLabel && perfSession < marketSessionLabel
      ? {
          sessionLabel: fmtSessionDate(new Date(perfSession)),
          consequence: `Thị trường đã có phiên ${fmtSessionDate(
            new Date(marketSessionLabel)
          )} nhưng các tác tử chưa chốt số đo cho phiên đó. Toàn bộ NAV, thắng/thua, sụt giảm và thứ hạng bên dưới tính trên phiên cũ hơn.`,
        }
      : null;

  const loadError =
    [
      dtoError,
      battles.error,
      hof.error,
      agentClassBySlug.error,
      humanCalls.error,
      decisionCount.error,
      marketSession.error,
    ]
      .filter(Boolean)
      .join(String.fromCharCode(10)) || null;

  return <F3Screen model={model} loadError={loadError} stale={stale} />;
}
