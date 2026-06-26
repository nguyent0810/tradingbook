import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PAPER_AGENT_SEEDS } from "@/lib/paper-lab/constants";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const agents = await prisma.paperAgent.findMany({ orderBy: { displayName: "asc" } });
    if (agents.length === 0) {
      return NextResponse.json({
        agents: PAPER_AGENT_SEEDS.map((s) => ({ slug: s.slug, displayName: s.displayName, style: s.style })),
        source: "seed",
      });
    }
    return NextResponse.json({
      agents: agents.map((a) => ({
        id: a.id,
        slug: a.slug,
        displayName: a.displayName,
        style: a.style,
        active: a.active,
        config: a.configJson,
      })),
      source: "db",
    });
  } catch {
    return NextResponse.json({
      agents: PAPER_AGENT_SEEDS.map((s) => ({ slug: s.slug, displayName: s.displayName, style: s.style })),
      source: "mock",
    });
  }
}

export const dynamic = "force-dynamic";
