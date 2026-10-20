import { contextIssues } from "../contracts.js";
import { catalog, defineRules } from "../rules.js";

const version = "1.0.0";
const rules = defineRules("payments", version, {
  context: {
    id: "SG-PAY-001",
    decision: "REVIEW",
    reason:
      "Required payment runtime context is missing or has an invalid type.",
    suggestion:
      "Supply the platform, storefront, and relevant approval or entitlement state from the host.",
  },
  external: {
    id: "SG-PAY-002",
    decision: "BLOCK",
    reason:
      "External digital purchase action detected in a context requiring additional store-policy handling.",
    suggestion: "Use the approved in-app purchase flow or route for review.",
  },
  approved: {
    id: "SG-PAY-003",
    decision: "PASS",
    reason:
      "The in-app digital purchase route is explicitly approved by the host in this supported context.",
    suggestion:
      "Use the host's approved in-app purchase executor for this exact action.",
  },
  unsupported: {
    id: "SG-PAY-004",
    decision: "REVIEW",
    reason:
      "This product, storefront, platform, or external purchase route is outside the modeled payment approvals.",
    suggestion:
      "Keep execution on hold and review the applicable payment route.",
  },
  unapproved: {
    id: "SG-PAY-005",
    decision: "BLOCK",
    reason: "The host has not approved this in-app purchase route.",
    suggestion:
      "Configure and approve the in-app purchase flow before execution.",
  },
});
export const paymentsPack = catalog("payments", version, rules);

export function checkPayments(action, context) {
  const external =
    action.type === "OPEN_EXTERNAL_URL" || action.channel === "external";
  const flag = external
    ? "external_purchase_entitlement"
    : "in_app_purchase_approved";
  const issues = contextIssues(context, {
    platform: "string",
    storefront: "string",
    [flag]: "boolean",
  });
  if (issues.length) return { rule: rules.context, issues };
  // Curated application policy, not a claim about all current store regulations.
  if (
    action.product !== "digital_subscription" ||
    context.platform !== "iOS" ||
    context.storefront !== "DE"
  ) {
    return { rule: rules.unsupported };
  }
  if (external)
    return {
      rule:
        context.external_purchase_entitlement === false
          ? rules.external
          : rules.unsupported,
    };
  return {
    rule: context.in_app_purchase_approved ? rules.approved : rules.unapproved,
  };
}
