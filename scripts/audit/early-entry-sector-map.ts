/** Heuristic VN sector tags for cohort diversity (audit only — not production sector data). */
export type EarlyEntrySector =
  | "bank"
  | "securities"
  | "real_estate"
  | "retail"
  | "oil_gas"
  | "industrial"
  | "other";

const SECTOR_BY_SYMBOL: Record<string, EarlyEntrySector> = {
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

export function sectorForSymbol(symbol: string): EarlyEntrySector {
  return SECTOR_BY_SYMBOL[symbol.toUpperCase()] ?? "other";
}

/** Diverse cohort anchors — banks, securities, retail, industrials, real estate, oil/gas. */
export const COHORT_ANCHORS: readonly string[] = [
  "ACB",
  "VCB",
  "CTG",
  "BID",
  "MBB",
  "TCB",
  "SSI",
  "VND",
  "HCM",
  "VCI",
  "VHM",
  "VIC",
  "NVL",
  "KDH",
  "DXG",
  "MWG",
  "FRT",
  "PNJ",
  "GAS",
  "PVD",
  "BSR",
  "HPG",
  "HSG",
  "NKG",
  "REE",
] as const;
