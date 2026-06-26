import { buildMockPaperLabPageDto } from "@/lib/paper-lab/mock/arena-fixtures";
import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";

/**
 * Loads arena page data — uses DB when available, falls back to mock fixtures.
 */
export async function loadPaperLabPageDto(): Promise<PaperLabPageDto> {
  try {
    const { loadPaperLabPageFromDb } = await import("@/lib/paper-lab/queries/load-paper-lab-page-from-db");
    const fromDb = await loadPaperLabPageFromDb();
    if (fromDb) return fromDb;
  } catch {
    // DB tables may not exist yet — mock fallback for shell/dev
  }
  return buildMockPaperLabPageDto();
}
