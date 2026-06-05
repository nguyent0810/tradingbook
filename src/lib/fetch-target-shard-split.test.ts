import { describe, expect, it } from "vitest";
import {
  computeShardOverlapCount,
  frozenShardSplitStats,
  partitionFetchTargets,
  sliceShard,
} from "./fetch-target-shard-split";

describe("frozen stale shard split", () => {
  it("sliceShard round-robin matches partitionFetchTargets", () => {
    const symbols = ["A32", "ACL", "ADC", "AMP", "BAL"];
    const parts = partitionFetchTargets(symbols, 2);
    expect(parts[0]).toEqual(sliceShard(symbols, 0, 2));
    expect(parts[1]).toEqual(sliceShard(symbols, 1, 2));
  });

  it("partitions 35 stale targets with zero overlap (pilot #1 shape)", () => {
    const symbols = Array.from({ length: 35 }, (_, i) => `SYM${String(i).padStart(3, "0")}`);
    const shards = partitionFetchTargets(symbols, 2);
    const stats = frozenShardSplitStats(shards);
    expect(stats.initialFetchTargetCount).toBe(35);
    expect(stats.shardTargetCounts).toEqual([18, 17]);
    expect(stats.uniqueTargetCount).toBe(35);
    expect(stats.overlapCount).toBe(0);
    expect(computeShardOverlapCount(shards)).toBe(0);
  });

  it("partitions 204 stale targets with zero overlap (near-full pilot #2 shape)", () => {
    const symbols = Array.from({ length: 204 }, (_, i) => `S${i}`);
    const shards = partitionFetchTargets(symbols, 2);
    const stats = frozenShardSplitStats(shards);
    expect(stats.shardTargetCounts).toEqual([102, 102]);
    expect(stats.uniqueTargetCount).toBe(204);
    expect(stats.overlapCount).toBe(0);
    expect(shards[0].length + shards[1].length).toBe(204);
  });
});
