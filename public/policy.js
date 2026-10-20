// Illustrative local rules, not StemJSON's schema or a production policy SDK.
export const DEMO_DURATION = 10_000;
const nonemptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

// Limited to the demo fixture's shape. No runtime context enters this check.
export function validateDemoModule(module) {
  const action = module?.action;
  const errors = [];
  if (module?.kind !== "mobile_ui") errors.push("kind must be mobile_ui");
  if (!nonemptyString(module?.title)) errors.push("title is required");
  if (!nonemptyString(module?.buttonLabel))
    errors.push("buttonLabel is required");
  if (!nonemptyString(action?.type)) errors.push("action.type is required");
  const shapes = {
    open_url: ["target", "product"],
    send_to_ai: ["provider", "data"],
    request_permission: ["target", "intent"],
  };
  const fields = Object.hasOwn(shapes, action?.type) ? shapes[action.type] : [];
  for (const field of fields) {
    if (!nonemptyString(action[field]))
      errors.push(`action.${field} is required`);
  }
  return { valid: errors.length === 0, errors };
}

// Map structured fields to explicit action categories. No language inference.
export function normalizeAction(action) {
  const normalized = {
    types: [],
    target: action?.target,
    product: action?.product,
    provider: action?.provider,
    data: action?.data,
    intent: action?.intent,
  };
  if (action?.type === "open_url") {
    normalized.types.push("OPEN_EXTERNAL_URL");
    if (action.product === "digital_subscription")
      normalized.types.push("PURCHASE");
  }
  if (action?.type === "send_to_ai") {
    if (action.provider === "third_party_ai")
      normalized.types.push("SEND_TO_THIRD_PARTY_AI");
    if (action.data === "contacts")
      normalized.types.push("SHARE_PERSONAL_DATA", "ACCESS_CONTACTS");
  }
  if (action?.type === "request_permission") {
    normalized.types.push("REQUEST_PERMISSION");
    if (action.target === "contacts_full_access")
      normalized.types.push("ACCESS_CONTACTS");
  }
  return normalized;
}

export function evaluateAction(action, context = {}) {
  const has = (type) =>
    Array.isArray(action?.types) && action.types.includes(type);
  if (
    has("PURCHASE") &&
    has("OPEN_EXTERNAL_URL") &&
    action.target === "stripe_checkout" &&
    action.product === "digital_subscription" &&
    context?.platform === "iOS" &&
    context?.storefront === "DE" &&
    context?.external_purchase_entitlement === false
  ) {
    return {
      decision: "BLOCK",
      reason:
        "External digital purchase action detected in a context requiring additional store-policy handling.",
      suggestion: "Use the approved in-app purchase flow or route for review.",
    };
  }
  if (
    has("SEND_TO_THIRD_PARTY_AI") &&
    has("SHARE_PERSONAL_DATA") &&
    action.provider === "third_party_ai" &&
    action.data === "contacts"
  ) {
    if (
      context?.consent_for_third_party_ai === false ||
      context?.disclosure_present === false
    ) {
      return {
        decision: "BLOCK",
        reason:
          "Personal data is about to be sent to a third-party AI provider without the required disclosure/consent state.",
        suggestion: "Insert disclosure + explicit consent before execution.",
      };
    }
    // PASS is scoped to this illustrative rule. The three UI fixtures never execute actions.
    if (
      context?.consent_for_third_party_ai === true &&
      context?.disclosure_present === true
    ) {
      return {
        decision: "PASS",
        reason:
          "Disclosure and explicit consent are present for this illustrative data-sharing rule.",
        suggestion:
          "Proceed only through the application's approved execution flow.",
      };
    }
  }
  if (
    has("REQUEST_PERMISSION") &&
    has("ACCESS_CONTACTS") &&
    action.target === "contacts_full_access" &&
    action.intent === "select_three_contacts" &&
    context?.platform === "Android" &&
    context?.narrower_picker_available === true
  ) {
    return {
      decision: "REVIEW",
      reason:
        "Requested access appears broader than necessary for the stated intent.",
      suggestion: "Use a narrower contact picker or request human review.",
    };
  }
  return {
    decision: "REVIEW",
    reason:
      "This action or runtime context is outside the demo's known policy rules.",
    suggestion: "Keep execution on hold and request human review.",
  };
}
