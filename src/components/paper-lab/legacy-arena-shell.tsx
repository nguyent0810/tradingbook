import "@/components/command-deck/command-deck.css";
import "@/components/paper-lab/paper-lab-command-center.css";

/**
 * Khung nền cũ của Arena, chỉ còn các route con dùng.
 *
 * Màn F3 (`/paper-lab`) đã chuyển sang terminal ở Gate 4 nên không đi qua khung
 * này nữa; bốn trang con (ops, agents/[slug], battles/[id], timeline/[sessionDate])
 * chưa có bản thiết kế terminal nên vẫn giữ nguyên nền cũ. Gate 8 xem xét gỡ.
 */
export function LegacyArenaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cd-root paper-lab-arena-root" data-testid="paper-lab-command-shell">
      <div className="cd-shell">{children}</div>
    </div>
  );
}
