"use server";

import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import {
  BOOK_OPERATING_SNAPSHOT_VERSION,
  type BookOperatingSnapshotV2,
} from "@/lib/trades/operating-trend-discipline";

export async function persistBookOperatingSnapshot(
  snapshot: BookOperatingSnapshotV2
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (snapshot.v !== BOOK_OPERATING_SNAPSHOT_VERSION) return;

  const cookieStore = await cookies();
  cookieStore.set(`tl_book_op_v1_${session.userId}`, JSON.stringify(snapshot), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
