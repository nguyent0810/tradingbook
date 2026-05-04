/**
 * Single supported playbook for this product. Kept in sync with Prisma enum `Playbook`.
 */
export const DEFAULT_PLAYBOOK = "BREAKOUT_PULLBACK" as const;

export type PlaybookId = typeof DEFAULT_PLAYBOOK;

export function formatPlaybookLabel(playbook: string): string {
  if (playbook === "BREAKOUT_PULLBACK") return "Breakout → Pullback";
  return playbook;
}
