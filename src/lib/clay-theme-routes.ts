/**
 * Routes with a ClayMorphism redesign (design_handoff_claymorphism/README.md,
 * plus /settings as a follow-up extension of the same visual language).
 * Exact matches only — the Arena mockup covers just the /paper-lab overview,
 * not its sub-routes (battles, experiments, hof, agents/[slug], human, ops,
 * timeline), which have no Clay design reference and must keep the existing
 * dark theme. Shared by the theme-toggle effect and every shell component
 * that needs to switch its own copy (sidebar, mobile nav, logout button).
 */
const CLAY_THEME_ROUTES = new Set(["/dashboard", "/setups", "/paper-lab", "/settings"]);

export function isClayThemeRoute(pathname: string): boolean {
  return CLAY_THEME_ROUTES.has(pathname);
}
