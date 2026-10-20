import { categoriesFor, checkAction, isRecord, issue } from "./contracts.js";
import { coreRules } from "./rules.js";
import { checkPayments } from "./packs/payments.js";
import { checkPrivacy } from "./packs/privacy.js";
import { checkPermissions } from "./packs/permissions.js";
import { ENGINE_VERSION, POLICY_VERSION } from "./versions.js";

function result(rule, action = null, issues = []) {
  return {
    decision: rule.decision,
    reason: rule.reason,
    suggestion: rule.suggestion,
    matchedRule: { ...rule.matchedRule },
    engineVersion: ENGINE_VERSION,
    policyVersion: POLICY_VERSION,
    normalizedAction: action,
    actionTypes: categoriesFor(action),
    issues,
  };
}

/**
 * Synchronous, deterministic, side-effect-free policy evaluation.
 * PASS is limited to the matched rule; the host owns validation and execution.
 */
export function evaluate(input) {
  try {
    if (
      !isRecord(input) ||
      Object.keys(input).some((key) => !["action", "context"].includes(key))
    ) {
      return result(coreRules.input, null, [
        issue("input", "invalid_type", "Expected exactly { action, context }."),
      ]);
    }
    const checked = checkAction(
      Object.hasOwn(input, "action") ? input.action : undefined,
    );
    if (checked.issues.length) {
      const rule = checked.issues.some(
        (item) => item.code === "unsupported" && item.field === "action.type",
      )
        ? coreRules.unsupported
        : coreRules.action;
      return result(rule, null, checked.issues);
    }
    const action = checked.action;
    if (!Object.hasOwn(input, "context") || !isRecord(input.context)) {
      return result(coreRules.context, action, [
        issue(
          "context",
          "required",
          "A plain runtime context object is required.",
        ),
      ]);
    }
    const check =
      action.type === "OPEN_EXTERNAL_URL" || action.type === "PURCHASE"
        ? checkPayments
        : action.type === "SEND_TO_THIRD_PARTY_AI"
          ? checkPrivacy
          : checkPermissions;
    const finding = check(action, input.context);
    return result(finding.rule, action, finding.issues ?? []);
  } catch {
    // Non-data JavaScript values (e.g. hostile proxies) are outside the contract.
    // They must never accidentally grant permission or escape to an executor.
    return result(coreRules.input, null, [
      issue(
        "input",
        "invalid_type",
        "The input could not be read as plain data.",
      ),
    ]);
  }
}
