"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SYMBOL_COMMAND_PATTERN, symbolHref } from "@/lib/terminal/nav";

/** Ô TÌM MÃ trên thanh trên — Enter mở màn chi tiết của mã. */
export function SymbolLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4.5-4.5" />
      </svg>
      <input
        className="tm-lookup"
        value={value}
        aria-label="Tìm mã cổ phiếu"
        placeholder="TÌM MÃ"
        maxLength={4}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const symbol = value.trim().toUpperCase();
          if (!SYMBOL_COMMAND_PATTERN.test(symbol)) return;
          setValue("");
          router.push(symbolHref(symbol));
        }}
      />
    </>
  );
}
