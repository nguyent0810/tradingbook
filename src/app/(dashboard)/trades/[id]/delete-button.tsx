"use client";

import { deleteTrade } from "@/app/actions/trades";

export function DeleteTradeButton({ tradeId }: { tradeId: string }) {
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this trade?")) return;
    await deleteTrade(tradeId);
  };

  return (
    <button onClick={handleDelete} className="btn btn-danger btn-sm">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
      Delete
    </button>
  );
}
