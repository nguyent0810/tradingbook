"use client";

import Link from "next/link";
import { ErrorState } from "./states";
import { Panel } from "./panel";

/**
 * Trạng thái lỗi dùng chung cho mọi ranh giới lỗi của terminal.
 *
 * Lỗi luôn kèm bằng chứng: `digest` do Next sinh cho lỗi phía server, câu lỗi đã
 * được Next làm sạch, và đường dẫn ranh giới — đủ để tra log mà không lộ chi
 * tiết nội bộ (bàn giao §6).
 */
export function TerminalRouteError({
  error,
  reset,
  title,
  note,
  boundary,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  note: string;
  /** Đường dẫn file ranh giới, để tra đúng chỗ trong mã nguồn. */
  boundary: string;
}) {
  const evidence = [
    error.digest ? `digest: ${error.digest}` : null,
    error.message ? `message: ${error.message}` : null,
    `boundary: ${boundary}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0 }}>
      <Panel title="MÀN KHÔNG TẢI ĐƯỢC" tone="down" body="pad" style={{ flex: 1 }}>
        <ErrorState
          title={title}
          note={note}
          evidence={evidence}
          action={
            <div className="tm-btn-group">
              <button type="button" className="tm-btn tm-btn--primary" onClick={() => reset()}>
                TẢI LẠI
              </button>
              <Link href="/dashboard" className="tm-btn">
                VỀ F1 ĐIỀU KHIỂN
              </Link>
            </div>
          }
        />
      </Panel>
    </div>
  );
}
