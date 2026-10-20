import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDemoModule,
  normalizeAction,
  evaluateAction,
} from "../public/policy.js";
import { SCENARIOS } from "../public/scenarios.js";

const expected = [
  {
    types: ["OPEN_EXTERNAL_URL", "PURCHASE"],
    decision: "BLOCK",
    reason:
      "External digital purchase action detected in a context requiring additional store-policy handling.",
    suggestion: "Use the approved in-app purchase flow or route for review.",
  },
  {
    types: ["SEND_TO_THIRD_PARTY_AI", "SHARE_PERSONAL_DATA", "ACCESS_CONTACTS"],
    decision: "BLOCK",
    reason:
      "Personal data is about to be sent to a third-party AI provider without the required disclosure/consent state.",
    suggestion: "Insert disclosure + explicit consent before execution.",
  },
  {
    types: ["REQUEST_PERMISSION", "ACCESS_CONTACTS"],
    decision: "REVIEW",
    reason:
      "Requested access appears broader than necessary for the stated intent.",
    suggestion: "Use a narrower contact picker or request human review.",
  },
];
for (const [index, fixture] of SCENARIOS.entries()) {
  test(`${fixture.id}: a structurally valid module produces the required normalized policy verdict`, () => {
    const before = structuredClone(fixture);
    assert.deepEqual(validateDemoModule(fixture.module), {
      valid: true,
      errors: [],
    });
    const normalized = normalizeAction(fixture.module.action);
    const { types, ...verdict } = expected[index];
    assert.deepEqual(normalized.types, types);
    assert.deepEqual(evaluateAction(normalized, fixture.context), verdict);
    assert.deepEqual(
      fixture,
      before,
      "checking never mutates the generated module or context",
    );
  });
}

test("changing consent changes policy, not structural validation", () => {
  const module = SCENARIOS[1].module;
  const action = normalizeAction(module.action);
  assert.equal(validateDemoModule(module).valid, true);
  for (const context of [
    { consent_for_third_party_ai: false, disclosure_present: false },
    { consent_for_third_party_ai: true, disclosure_present: false },
    { consent_for_third_party_ai: false, disclosure_present: true },
  ])
    assert.equal(evaluateAction(action, context).decision, "BLOCK");
  assert.equal(
    evaluateAction(action, {
      consent_for_third_party_ai: true,
      disclosure_present: true,
    }).decision,
    "PASS",
  );
  assert.equal(validateDemoModule(module).valid, true);
});

test("missing or truthy non-boolean consent never implies permission", () => {
  const action = normalizeAction(SCENARIOS[1].module.action);
  for (const context of [
    null,
    {},
    { consent_for_third_party_ai: true },
    { disclosure_present: true },
    { consent_for_third_party_ai: "true", disclosure_present: "true" },
  ]) {
    assert.equal(evaluateAction(action, context).decision, "REVIEW");
  }
});

test("store rule does not invent approval for other platforms, storefronts, or entitlements", () => {
  const action = normalizeAction(SCENARIOS[0].module.action);
  for (const context of [
    null,
    {},
    { ...SCENARIOS[0].context, platform: "Android" },
    { ...SCENARIOS[0].context, storefront: "US" },
    { ...SCENARIOS[0].context, external_purchase_entitlement: true },
  ]) {
    assert.equal(evaluateAction(action, context).decision, "REVIEW");
  }
});

test("malformed module shape fails before a policy check", () => {
  const module = SCENARIOS[0].module;
  for (const candidate of [
    null,
    {},
    { ...module, title: "" },
    { ...module, action: null },
    {
      ...module,
      action: { type: "open_url", target: 1, product: "digital_subscription" },
    },
  ]) {
    assert.equal(validateDemoModule(candidate).valid, false);
  }
});

test("unknown structured actions do not crash validation or get automatic PASS", () => {
  for (const type of [
    "unknown_action",
    "constructor",
    "toString",
    "__proto__",
  ]) {
    const module = { ...SCENARIOS[0].module, action: { type } };
    assert.equal(validateDemoModule(module).valid, true);
    assert.equal(
      evaluateAction(normalizeAction(module.action), {}).decision,
      "REVIEW",
    );
  }
  assert.equal(evaluateAction(normalizeAction(null), {}).decision, "REVIEW");
});
