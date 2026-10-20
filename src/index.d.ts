export type Decision = "PASS" | "BLOCK" | "REVIEW";
export type Action =
  | { type: "OPEN_EXTERNAL_URL"; target: string; product: string }
  | {
      type: "PURCHASE";
      target: string;
      product: string;
      channel: "external" | "in_app";
    }
  | { type: "SEND_TO_THIRD_PARTY_AI"; provider: string; data: string }
  | { type: "REQUEST_PERMISSION"; target: string; intent: string };
export type StructuredAction =
  | { type: "open_url"; target: string; product: string }
  | {
      type: "purchase";
      target: string;
      product: string;
      channel: "external" | "in_app";
    }
  | { type: "send_to_ai"; provider: string; data: string }
  | { type: "request_permission"; target: string; intent: string };
export interface RuntimeContext {
  platform?: string;
  storefront?: string;
  external_purchase_entitlement?: boolean;
  in_app_purchase_approved?: boolean;
  consent_for_third_party_ai?: boolean;
  disclosure_present?: boolean;
  narrower_picker_available?: boolean;
  [key: string]: unknown;
}
export interface InputIssue {
  field: string;
  code: "invalid_type" | "required" | "unsupported" | "unknown_field";
  message: string;
}
export interface MatchedRule {
  id: string;
  pack: "core" | "payments" | "privacy" | "permissions";
  version: string;
}
export interface PolicyResult {
  decision: Decision;
  reason: string;
  suggestion: string;
  matchedRule: MatchedRule;
  engineVersion: string;
  policyVersion: string;
  normalizedAction: Action | null;
  actionTypes: string[];
  issues: InputIssue[];
}
export interface EvaluationInput {
  action: Action;
  context: RuntimeContext;
}
export type AdaptationResult =
  | { ok: true; action: Action; categories: string[]; issues: [] }
  | { ok: false; action: null; categories: []; issues: InputIssue[] };
/** Accepts unknown at the trust boundary; malformed data returns REVIEW. */
export function evaluate(input: EvaluationInput): PolicyResult;
export function evaluate(input: unknown): PolicyResult;
export function adaptStructuredAction(raw: unknown): AdaptationResult;
export const ENGINE_VERSION: "1.0.0";
export const POLICY_VERSION: "1.0.0";
export const POLICY_PACKS: readonly {
  readonly name: MatchedRule["pack"];
  readonly version: string;
  readonly rules: readonly {
    readonly id: string;
    readonly decision: Decision;
    readonly description: string;
  }[];
}[];
