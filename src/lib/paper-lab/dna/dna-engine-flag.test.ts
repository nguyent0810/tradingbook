import { afterEach, describe, expect, it } from "vitest";
import { DNA_ENGINE_ENV, isDnaEngineEnabled } from "@/lib/paper-lab/dna/dna-engine-flag";

const original = process.env[DNA_ENGINE_ENV];

afterEach(() => {
  if (original === undefined) delete process.env[DNA_ENGINE_ENV];
  else process.env[DNA_ENGINE_ENV] = original;
});

describe("PAPER_LAB_DNA_ENGINE flag", () => {
  it("defaults to false when unset", () => {
    delete process.env[DNA_ENGINE_ENV];
    expect(isDnaEngineEnabled()).toBe(false);
  });

  it("is false for any non-'true' value", () => {
    process.env[DNA_ENGINE_ENV] = "1";
    expect(isDnaEngineEnabled()).toBe(false);
    process.env[DNA_ENGINE_ENV] = "false";
    expect(isDnaEngineEnabled()).toBe(false);
  });

  it("is true only for exactly 'true'", () => {
    process.env[DNA_ENGINE_ENV] = "true";
    expect(isDnaEngineEnabled()).toBe(true);
  });
});
