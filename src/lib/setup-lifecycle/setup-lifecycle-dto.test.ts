import { describe, expect, it } from "vitest";
import { SetupLifecycleStatus } from "@/generated/prisma/client";
import {
  displayCandidateLifecycleSortLabel,
  displaySetupLifecycleStatus,
} from "@/lib/trading-display-labels";
import {
  normalizeSetupLifecycleFromCloseInZone,
  normalizeSetupLifecycleFromDb,
  normalizeSetupLifecycleFromSurfacedSortLabel,
  normalizeSetupLifecycleWithWatchContext,
} from "@/lib/setup-lifecycle/setup-lifecycle-dto";

describe("normalizeSetupLifecycleFromDb", () => {
  it("maps READY with existing display label", () => {
    const dto = normalizeSetupLifecycleFromDb(SetupLifecycleStatus.READY);
    expect(dto.status).toBe("READY");
    expect(dto.label).toBe(displaySetupLifecycleStatus("READY"));
    expect(dto.source).toBe("db");
    expect(dto.sortRank).toBe(0);
  });

  it("maps WATCHING with existing display label", () => {
    const dto = normalizeSetupLifecycleFromDb(SetupLifecycleStatus.WATCHING);
    expect(dto.label).toBe(displaySetupLifecycleStatus("WATCHING"));
    expect(dto.sortRank).toBe(1);
  });
});

describe("normalizeSetupLifecycleFromSurfacedSortLabel", () => {
  it("maps READY computed label", () => {
    const dto = normalizeSetupLifecycleFromSurfacedSortLabel("READY");
    expect(dto.label).toBe(displayCandidateLifecycleSortLabel("READY"));
    expect(dto.source).toBe("computed");
    expect(dto.sortRank).toBe(0);
  });

  it("maps WATCHING computed label", () => {
    const dto = normalizeSetupLifecycleFromSurfacedSortLabel("WATCHING");
    expect(dto.label).toBe(displayCandidateLifecycleSortLabel("WATCHING"));
    expect(dto.sortRank).toBe(1);
  });
});

describe("normalizeSetupLifecycleFromCloseInZone", () => {
  it("returns READY when close is inside zone", () => {
    const dto = normalizeSetupLifecycleFromCloseInZone({
      close: 100,
      pullbackZoneLow: 98,
      pullbackZoneHigh: 102,
    });
    expect(dto.status).toBe("READY");
    expect(dto.label).toBe("At entry zone");
  });

  it("returns WATCHING when close is outside zone", () => {
    const dto = normalizeSetupLifecycleFromCloseInZone({
      close: 90,
      pullbackZoneLow: 98,
      pullbackZoneHigh: 102,
    });
    expect(dto.status).toBe("WATCHING");
    expect(dto.label).toBe("Waiting for pullback");
  });
});

describe("normalizeSetupLifecycleWithWatchContext", () => {
  it("adds warning when computed READY conflicts with DB WATCHING", () => {
    const dto = normalizeSetupLifecycleWithWatchContext({
      computed: "READY",
      dbStatus: SetupLifecycleStatus.WATCHING,
    });
    expect(dto.warning).toMatch(/READY/);
    expect(dto.label).toBe("At entry zone");
  });

  it("passes through when computed matches DB READY", () => {
    const dto = normalizeSetupLifecycleWithWatchContext({
      computed: "READY",
      dbStatus: SetupLifecycleStatus.READY,
    });
    expect(dto.warning).toBeUndefined();
  });
});
