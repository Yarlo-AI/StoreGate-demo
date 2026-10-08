// One deliberately narrow, illustrative demo rule. This is not an App Store policy engine.
export const DEMO_ACTION = Object.freeze({
  type: "open_url",
  target: "stripe_checkout",
  product: "digital_subscription",
});
export const DEMO_CONTEXT = Object.freeze({
  platform: "iOS",
  storefront: "DE",
  external_purchase_entitlement: false,
});
export const DEMO_DURATION = 12_000;

export function evaluateAction(action, context) {
  const matchesDemoRule =
    action?.type === "open_url" &&
    action?.target === "stripe_checkout" &&
    action?.product === "digital_subscription" &&
    context?.platform === "iOS" &&
    context?.storefront === "DE" &&
    context?.external_purchase_entitlement === false;

  if (!matchesDemoRule)
    return { decision: "REVIEW", reason: "Outside this demo rule" };

  return {
    decision: "BLOCK",
    reason: "External digital purchase detected",
    context: "iOS / DE storefront / entitlement missing",
    suggestion: "Use approved in-app purchase flow",
  };
}
