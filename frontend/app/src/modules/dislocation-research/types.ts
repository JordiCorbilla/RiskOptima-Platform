export interface ResearchRow {
  symbol: string;
  name: string;
  classification: string;
  instrument_type?: string | null;
  price?: number | null;
  currency?: string | null;
  opportunity_score?: number | null;
  confidence_score?: number | null;
  error?: string | null;
}
export interface ResearchAnalysis extends ResearchRow {
  as_of: string;
  generated_at: string;
  riskoptima_version: string;
  valuation_mode: string;
  intrinsic_value: number | null;
  margin_of_safety: number | null;
  upside_to_model_value: number | null;
  implied_annualized_return: number | null;
  valuation_horizon_years: number;
  diagnostics: string[];
  dislocation_score?: number | null;
  regime_score?: number | null;
  quality_score?: number | null;
  valuation_score?: number | null;
  research_notice?: string;
  metrics: Record<string, number | string | null>;
}
export interface ResearchResult {
  status: "success" | "partial" | "failed";
  riskoptima_version: string;
  source: string;
  assumptions: Record<string, string | number | boolean>;
  summary: ResearchRow[];
  analyses: ResearchAnalysis[];
  reports: Record<string, string>;
}
