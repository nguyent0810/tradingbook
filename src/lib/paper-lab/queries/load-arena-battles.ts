import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Latest 20 arena battles with full `battleDecisions` — shared by the paper-lab page's
 * "learning" summary and the Arena DTO's "recent battles" widget so the query runs once
 * per request instead of twice (React cache dedupes calls within the same render).
 */
export const loadArenaBattles = cache(async () => {
  try {
    return await prisma.arenaBattle.findMany({
      orderBy: { sessionDate: "desc" },
      take: 20,
      include: { battleDecisions: true },
    });
  } catch {
    return [];
  }
});
