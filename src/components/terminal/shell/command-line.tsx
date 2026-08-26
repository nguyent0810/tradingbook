"use client";

import { useRef, useState } from "react";
import type { CommandEcho } from "./use-command-router";

/**
 * Dòng lệnh 29px. Nhận từ khoá màn (DASH · SETUP · ARENA · BOOK · SET · HELP)
 * và mã cổ phiếu 3–4 ký tự; lệnh sai hiện phản hồi ở cạnh phải (QA §7).
 */
export function CommandLine({
  echo,
  onRun,
}: {
  echo: CommandEcho;
  onRun: (raw: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="tm-cmdline">
      <span className="tm-cmdline__prompt" aria-hidden="true">
        &gt;
      </span>
      <input
        ref={inputRef}
        className="tm-cmdline__input"
        value={value}
        aria-label="Dòng lệnh"
        placeholder="Nhập lệnh: DASH · SETUP · ARENA · BOOK · SET · FPT · HELP"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            return;
          }
          if (e.key !== "Enter") return;
          const raw = value.trim();
          if (!raw) return;
          onRun(raw);
          setValue("");
        }}
      />
      <span className="tm-cmdline__echo" data-kind={echo.kind} role="status" aria-live="polite">
        {echo.message}
      </span>
    </div>
  );
}
