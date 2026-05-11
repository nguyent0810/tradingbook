import { describe, expect, it } from "vitest";
import { buildReviewContinuityLines } from "./review-continuity-lines";

describe("buildReviewContinuityLines", () => {
  const noon = new Date("2026-05-11T12:00:00");

  it("notes checkpoint today", () => {
    const lines = buildReviewContinuityLines({
      now: noon,
      checkedToday: true,
      lastCheckpointAt: new Date("2026-05-11T08:00:00"),
      latestChecklist: null,
      weekFlags: undefined,
    });
    expect(lines[0]).toContain("today");
  });

  it("notes no checkpoint record", () => {
    const lines = buildReviewContinuityLines({
      now: noon,
      checkedToday: false,
      lastCheckpointAt: null,
      latestChecklist: null,
      weekFlags: undefined,
    });
    expect(lines[0]).toMatch(/No health checkpoint/i);
  });

  it("notes days ago", () => {
    const lines = buildReviewContinuityLines({
      now: noon,
      checkedToday: false,
      lastCheckpointAt: new Date("2026-05-08T10:00:00"),
      latestChecklist: null,
      weekFlags: undefined,
    });
    expect(lines.some((l) => l.includes("3 days ago"))).toBe(true);
  });

  it("adds weekly gap line when flags show gaps", () => {
    const lines = buildReviewContinuityLines({
      now: noon,
      checkedToday: false,
      lastCheckpointAt: new Date("2026-05-10T10:00:00"),
      latestChecklist: null,
      weekFlags: {
        stopMarkedThisWeek: false,
        structureMarkedThisWeek: true,
        exitPlanMarkedThisWeek: true,
      },
    });
    expect(lines.some((l) => l.includes("stop"))).toBe(true);
  });

  it("still appends week gaps after checked today", () => {
    const lines = buildReviewContinuityLines({
      now: noon,
      checkedToday: true,
      lastCheckpointAt: new Date("2026-05-11T08:00:00"),
      latestChecklist: null,
      weekFlags: {
        stopMarkedThisWeek: false,
        structureMarkedThisWeek: false,
        exitPlanMarkedThisWeek: false,
      },
    });
    expect(lines[0]).toContain("today");
    expect(lines.some((l) => l.includes("week"))).toBe(true);
  });
});
