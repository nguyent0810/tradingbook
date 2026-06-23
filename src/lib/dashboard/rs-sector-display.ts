/** Display-only sector tags for RS workbench — heuristic map, not production sector data. */
export type RsDisplaySector =
  | "bank"
  | "securities"
  | "real_estate"
  | "retail"
  | "oil_gas"
  | "industrial"
  | "other";

const SECTOR_BY_SYMBOL: Record<string, RsDisplaySector> = {
  ACB: "bank",
  VCB: "bank",
  CTG: "bank",
  BID: "bank",
  MBB: "bank",
  TCB: "bank",
  STB: "bank",
  HDB: "bank",
  VPB: "bank",
  LPB: "bank",
  EIB: "bank",
  SSB: "bank",
  SHB: "bank",
  TPB: "bank",
  OCB: "bank",
  VIB: "bank",
  NVB: "bank",
  SSI: "securities",
  VND: "securities",
  HCM: "securities",
  VCI: "securities",
  BVS: "securities",
  SHS: "securities",
  MBS: "securities",
  FTS: "securities",
  VHM: "real_estate",
  VIC: "real_estate",
  NVL: "real_estate",
  KDH: "real_estate",
  DXG: "real_estate",
  PDR: "real_estate",
  DIG: "real_estate",
  NLG: "real_estate",
  HDG: "real_estate",
  MWG: "retail",
  FRT: "retail",
  PNJ: "retail",
  DGW: "retail",
  GAS: "oil_gas",
  PVD: "oil_gas",
  PVS: "oil_gas",
  BSR: "oil_gas",
  PLX: "oil_gas",
  HPG: "industrial",
  HSG: "industrial",
  NKG: "industrial",
  GEE: "industrial",
  REE: "industrial",
  BCM: "industrial",
};

const SECTOR_LABELS: Record<RsDisplaySector, string> = {
  bank: "Bank",
  securities: "Securities",
  real_estate: "Real estate",
  retail: "Retail",
  oil_gas: "Oil & gas",
  industrial: "Industrial",
  other: "Other",
};

export function sectorForSymbol(symbol: string): RsDisplaySector {
  return SECTOR_BY_SYMBOL[symbol.toUpperCase()] ?? "other";
}

export function sectorLabelForSymbol(symbol: string): string {
  return SECTOR_LABELS[sectorForSymbol(symbol)];
}

export function hasBankSymbols(symbols: readonly string[]): boolean {
  return symbols.some((s) => sectorForSymbol(s) === "bank");
}
