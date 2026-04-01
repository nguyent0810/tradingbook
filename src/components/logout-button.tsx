"use client";

import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="btn btn-ghost btn-sm">
        Sign Out
      </button>
    </form>
  );
}
