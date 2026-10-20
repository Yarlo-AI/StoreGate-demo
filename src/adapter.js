import { categoriesFor, checkAction, isRecord, issue } from "./contracts.js";

const operations = Object.freeze({
  open_url: "OPEN_EXTERNAL_URL",
  purchase: "PURCHASE",
  send_to_ai: "SEND_TO_THIRD_PARTY_AI",
  request_permission: "REQUEST_PERMISSION",
});

/**
 * Adapt a host's explicit structured-action DTO. Never parse/evaluate source
 * strings, infer language, silently strip fields, or accept an action batch.
 */
export function adaptStructuredAction(raw) {
  try {
    if (
      !isRecord(raw) ||
      !Object.hasOwn(raw, "type") ||
      typeof raw.type !== "string" ||
      !Object.hasOwn(operations, raw.type)
    ) {
      return {
        ok: false,
        action: null,
        categories: [],
        issues: [
          issue(
            "action.type",
            "unsupported",
            "Expected a supported structured operation, not a source string or batch.",
          ),
        ],
      };
    }
    const checked = checkAction({ ...raw, type: operations[raw.type] });
    return {
      ok: checked.issues.length === 0,
      ...checked,
      categories: categoriesFor(checked.action),
    };
  } catch {
    return {
      ok: false,
      action: null,
      categories: [],
      issues: [
        issue(
          "action",
          "invalid_type",
          "Expected a plain structured-action data object.",
        ),
      ],
    };
  }
}
