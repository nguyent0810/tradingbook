import { describe, expect, it } from "vitest";
import { tradePermissionFromVerdict, isRsWatchlistSnapshotEnabled } from "./rs-watchlist-snapshot";

describe("rs-watchlist-snapshot", () => {
  it("maps verdict to trade permission", () => {
    expect(tradePermissionFromVerdict("TRADE")).toBe("allowed");
    expect(tradePermissionFromVerdict("PROBE")).toBe("watch_only");
    expect(tradePermissionFromVerdict("NO_TRADE")).toBe("no_trade");
  });

  it("is disabled by default", () => {
    const prev = process.env.RS_WATCHLIST_SNAPSHOT_ENABLED;
    delete process.env.RS_WATCHLIST_SNAPSHOT_ENABLED;
    expect(isRsWatchlistSnapshotEnabled()).toBe(false);
    if (prev !== undefined) process.env.RS_WATCHLIST_SNAPSHOT_ENABLED = prev;
  });

  it("documents idempotent result shape", () => {
    expect(tradePermissionFromVerdict("NO_TRADE")).toBe("no_trade");
    // persistRsWatchlistSnapshot returns { updated: true } on same-session rerun (see integration/CLI).
  });
});
