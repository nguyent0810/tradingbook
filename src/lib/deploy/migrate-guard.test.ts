import { describe, expect, it } from "vitest";
import { decideMigrationAction, resolveNonPooledUrl } from "../../../scripts/prod-migrate-deploy.mjs";

describe("prod migrate guard — decideMigrationAction", () => {
  it("skips in Preview (never mutates Production DB)", () => {
    expect(decideMigrationAction({ vercelEnv: "preview", hasDirectUrl: true }).action).toBe("skip");
  });
  it("skips in Development", () => {
    expect(decideMigrationAction({ vercelEnv: "development", hasDirectUrl: true }).action).toBe("skip");
  });
  it("skips when VERCEL_ENV is unset (local build)", () => {
    expect(decideMigrationAction({ vercelEnv: undefined, hasDirectUrl: true }).action).toBe("skip");
  });
  it("FAILS (blocks release) in Production without a non-pooled URL", () => {
    expect(decideMigrationAction({ vercelEnv: "production", hasDirectUrl: false }).action).toBe("fail");
  });
  it("RUNS in Production with a non-pooled URL", () => {
    expect(decideMigrationAction({ vercelEnv: "production", hasDirectUrl: true }).action).toBe("run");
  });
});

const NODE_ENV = "test" as const;

describe("prod migrate guard — resolveNonPooledUrl", () => {
  it("returns empty when no non-pooled URL is set", () => {
    expect(resolveNonPooledUrl({ NODE_ENV })).toBe("");
  });
  it("prefers DIRECT_URL, then DATABASE_URL_UNPOOLED, then POSTGRES_URL_NON_POOLING", () => {
    expect(resolveNonPooledUrl({ NODE_ENV, DIRECT_URL: "postgres://d/x", DATABASE_URL_UNPOOLED: "postgres://u/x" })).toContain("//d/");
    expect(resolveNonPooledUrl({ NODE_ENV, DATABASE_URL_UNPOOLED: "postgres://u/x" })).toContain("//u/");
    expect(resolveNonPooledUrl({ NODE_ENV, POSTGRES_URL_NON_POOLING: "postgres://n/x" })).toContain("//n/");
  });
  it("appends sslmode=require and connect_timeout when missing (Neon cold-start safety)", () => {
    const u = resolveNonPooledUrl({ NODE_ENV, DATABASE_URL_UNPOOLED: "postgres://h/db" });
    expect(u).toMatch(/sslmode=require/);
    expect(u).toMatch(/connect_timeout=30/);
  });
  it("does not duplicate params already present", () => {
    const u = resolveNonPooledUrl({ NODE_ENV, DATABASE_URL_UNPOOLED: "postgres://h/db?sslmode=require&connect_timeout=10" });
    expect(u.match(/sslmode=/g)?.length).toBe(1);
    expect(u.match(/connect_timeout=/g)?.length).toBe(1);
    expect(u).toContain("connect_timeout=10");
  });
});
