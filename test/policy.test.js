import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ACTION, DEMO_CONTEXT, evaluateAction } from "../public/policy.js";

test("the specified purchase and runtime context produce the required BLOCK result", () => {
  assert.deepEqual(evaluateAction(DEMO_ACTION, DEMO_CONTEXT), {
    decision: "BLOCK",
    reason: "External digital purchase detected",
    context: "iOS / DE storefront / entitlement missing",
    suggestion: "Use approved in-app purchase flow",
  });
});

test("the demo never invents approval for unmodeled actions or contexts", () => {
  for (const [action, context] of [
    [{ ...DEMO_ACTION, product: "physical_product" }, DEMO_CONTEXT],
    [{ ...DEMO_ACTION, target: "documentation" }, DEMO_CONTEXT],
    [{ ...DEMO_ACTION, type: "render_text" }, DEMO_CONTEXT],
    [DEMO_ACTION, { ...DEMO_CONTEXT, external_purchase_entitlement: true }],
    [
      DEMO_ACTION,
      { ...DEMO_CONTEXT, external_purchase_entitlement: undefined },
    ],
    [DEMO_ACTION, { ...DEMO_CONTEXT, platform: "Android" }],
    [DEMO_ACTION, { ...DEMO_CONTEXT, storefront: "US" }],
    [null, null],
  ])
    assert.equal(evaluateAction(action, context).decision, "REVIEW");
});
