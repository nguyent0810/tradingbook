/**
 * Phase 2 — DNA engine feature flag.
 *
 * Default OFF. When off, the legacy mock-rule agents run unchanged. When on
 * (PAPER_LAB_DNA_ENGINE=true), the deterministic Fund Manager evaluator runs.
 */
export const DNA_ENGINE_ENV = "PAPER_LAB_DNA_ENGINE";

export function isDnaEngineEnabled(): boolean {
  return process.env[DNA_ENGINE_ENV] === "true";
}
