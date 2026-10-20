import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluate,
  adaptStructuredAction,
  ENGINE_VERSION,
  POLICY_VERSION,
  POLICY_PACKS,
} from "storegate";
import { executeAfterValidation } from "../examples/host-integration.mjs";
import { SCENARIOS } from "../public/scenarios.js";
import { validateDemoModule } from "../public/module-validation.js";

const external = {
  type: "OPEN_EXTERNAL_URL",
  target: "stripe_checkout",
  product: "digital_subscription",
};
const paymentContext = {
  platform: "iOS",
  storefront: "DE",
  external_purchase_entitlement: false,
};
const sharing = {
  type: "SEND_TO_THIRD_PARTY_AI",
  provider: "third_party_ai",
  data: "contacts",
};
const consent = { consent_for_third_party_ai: true, disclosure_present: true };
const broad = {
  type: "REQUEST_PERMISSION",
  target: "contacts_full_access",
  intent: "select_three_contacts",
};
const permissionContext = {
  platform: "Android",
  narrower_picker_available: true,
};
const inApp = {
  type: "PURCHASE",
  target: "storekit_subscription",
  product: "digital_subscription",
  channel: "in_app",
};
const inAppContext = {
  platform: "iOS",
  storefront: "DE",
  in_app_purchase_approved: true,
};
const picker = { ...broad, target: "contacts_picker" };

function verdict(action, context, decision, rule) {
  const actual = evaluate({ action, context });
  assert.equal(actual.decision, decision);
  assert.equal(actual.matchedRule.id, rule);
  assert.equal(actual.engineVersion, "1.0.0");
  assert.equal(actual.policyVersion, "1.0.0");
  assert.equal(actual.matchedRule.version, "1.0.0");
  assert.ok(actual.reason.length > 10);
  assert.ok(actual.suggestion.length > 10);
  assert.deepEqual(
    JSON.parse(JSON.stringify(actual)),
    actual,
    "result is JSON data",
  );
  return actual;
}

for (const [index, scenario] of SCENARIOS.entries()) {
  test(`demo fixture ${scenario.id} validates structurally and uses the exported engine`, () => {
    assert.equal(validateDemoModule(scenario.module).valid, true);
    const adapted = adaptStructuredAction(scenario.module.action);
    assert.equal(adapted.ok, true);
    verdict(
      adapted.action,
      scenario.context,
      ["BLOCK", "BLOCK", "REVIEW"][index],
      ["SG-PAY-002", "SG-PRIV-002", "SG-PERM-002"][index],
    );
  });
}

test("payment block covers another external checkout, not only the presentation fixture", () => {
  verdict(
    { ...external, target: "https://merchant.example/checkout" },
    paymentContext,
    "BLOCK",
    "SG-PAY-002",
  );
});
test("explicit external PURCHASE uses the same payment boundary", () => {
  verdict(
    {
      type: "PURCHASE",
      target: "merchant_checkout",
      product: "digital_subscription",
      channel: "external",
    },
    paymentContext,
    "BLOCK",
    "SG-PAY-002",
  );
});
test("external entitlement alone never implies approval", () => {
  verdict(
    external,
    { ...paymentContext, external_purchase_entitlement: true },
    "REVIEW",
    "SG-PAY-004",
  );
});
test("unknown storefront, platform, and product do not inherit the known payment rule", () => {
  verdict(
    external,
    { ...paymentContext, platform: "Android" },
    "REVIEW",
    "SG-PAY-004",
  );
  verdict(
    external,
    { ...paymentContext, storefront: "US" },
    "REVIEW",
    "SG-PAY-004",
  );
  verdict(
    { ...external, product: "physical_goods" },
    paymentContext,
    "REVIEW",
    "SG-PAY-004",
  );
});
test("payment context requires all fields with no boolean coercion", () => {
  for (const field of Object.keys(paymentContext)) {
    const context = { ...paymentContext };
    delete context[field];
    const result = verdict(external, context, "REVIEW", "SG-PAY-001");
    assert.ok(
      result.issues.some((entry) => entry.field === `context.${field}`),
    );
  }
  for (const flag of ["false", 0, null])
    verdict(
      external,
      { ...paymentContext, external_purchase_entitlement: flag },
      "REVIEW",
      "SG-PAY-001",
    );
});
test("approved in-app purchase returns the scoped PASS rule", () => {
  verdict(inApp, inAppContext, "PASS", "SG-PAY-003");
});
test("explicitly unapproved in-app purchase is blocked", () => {
  verdict(
    inApp,
    { ...inAppContext, in_app_purchase_approved: false },
    "BLOCK",
    "SG-PAY-005",
  );
});
test("in-app approval cannot be replaced by an external entitlement", () => {
  verdict(inApp, paymentContext, "REVIEW", "SG-PAY-001");
});

for (const [allowed, disclosed] of [
  [false, false],
  [false, true],
  [true, false],
]) {
  test(`privacy blocks complete context with consent=${allowed}, disclosure=${disclosed}`, () => {
    verdict(
      sharing,
      { consent_for_third_party_ai: allowed, disclosure_present: disclosed },
      "BLOCK",
      "SG-PRIV-002",
    );
  });
}
test("privacy passes only both explicit boolean approvals", () => {
  verdict(sharing, consent, "PASS", "SG-PRIV-003");
});
test("partial privacy context is REVIEW even when one supplied state is false", () => {
  for (const context of [
    {},
    { disclosure_present: true },
    { consent_for_third_party_ai: false },
  ]) {
    const result = verdict(sharing, context, "REVIEW", "SG-PRIV-001");
    assert.ok(result.issues.length > 0);
  }
});
test("truthy strings and numbers never count as consent", () => {
  for (const value of ["true", 1, [], {}])
    verdict(
      sharing,
      { ...consent, consent_for_third_party_ai: value },
      "REVIEW",
      "SG-PRIV-001",
    );
});
test("privacy scope is explicit for both provider and data", () => {
  verdict(
    { ...sharing, provider: "unknown_provider" },
    consent,
    "REVIEW",
    "SG-PRIV-004",
  );
  verdict(
    { ...sharing, data: "medical_records" },
    consent,
    "REVIEW",
    "SG-PRIV-004",
  );
});
test("irrelevant payment approval cannot satisfy privacy requirements", () => {
  verdict(sharing, inAppContext, "REVIEW", "SG-PRIV-001");
});

test("broad contact access with a narrower picker requires REVIEW", () => {
  verdict(broad, permissionContext, "REVIEW", "SG-PERM-002");
});
test("narrow picker for the exact intent can PASS", () => {
  verdict(picker, permissionContext, "PASS", "SG-PERM-003");
});
test("unavailable picker does not approve broad or narrow requests", () => {
  for (const action of [broad, picker])
    verdict(
      action,
      { ...permissionContext, narrower_picker_available: false },
      "REVIEW",
      "SG-PERM-004",
    );
});
test("permission scope requires known intent and platform", () => {
  verdict(
    { ...picker, intent: "upload_all_contacts" },
    permissionContext,
    "REVIEW",
    "SG-PERM-004",
  );
  verdict(
    picker,
    { ...permissionContext, platform: "iOS" },
    "REVIEW",
    "SG-PERM-004",
  );
  verdict(
    { ...picker, target: "camera" },
    permissionContext,
    "REVIEW",
    "SG-PERM-004",
  );
});
test("missing or mistyped picker availability returns REVIEW", () => {
  verdict(picker, { platform: "Android" }, "REVIEW", "SG-PERM-001");
  verdict(
    picker,
    { platform: "Android", narrower_picker_available: "true" },
    "REVIEW",
    "SG-PERM-001",
  );
});

test("malformed evaluation envelopes are conservative and never throw", () => {
  for (const input of [
    undefined,
    null,
    [],
    "PASS",
    1,
    true,
    { action: sharing, context: consent, disablePolicies: true },
  ]) {
    const result = evaluate(input);
    assert.equal(result.decision, "REVIEW");
    assert.equal(result.matchedRule.id, "SG-CORE-001");
    assert.ok(result.reason && result.suggestion);
  }
});
test("missing or non-record context cannot inherit permission", () => {
  for (const context of [undefined, null, [], true, "{}", new Date()])
    verdict(sharing, context, "REVIEW", "SG-CORE-004");
});
test("invalid action shapes cannot reach a PASS rule", () => {
  for (const action of [
    null,
    [],
    "send_to_ai(...) ",
    {},
    { ...sharing, data: "" },
    { ...sharing, provider: 42 },
    { ...sharing, extraAction: external },
    { ...inApp, channel: "web" },
  ]) {
    verdict(action, consent, "REVIEW", "SG-CORE-002");
  }
});
test("unknown types including prototype names are reviewed", () => {
  for (const type of [
    "UNKNOWN",
    "constructor",
    "toString",
    "__proto__",
    "send_to_ai",
  ])
    verdict({ type }, consent, "REVIEW", "SG-CORE-003");
});
test("multiple actions must be evaluated separately; batches cannot bypass policies", () => {
  verdict([sharing, external], consent, "REVIEW", "SG-CORE-002");
  verdict(
    { ...sharing, actions: [external] },
    consent,
    "REVIEW",
    "SG-CORE-002",
  );
});
test("inherited and getter-provided approval is not trusted context", () => {
  verdict(sharing, Object.create(consent), "REVIEW", "SG-CORE-004");
  let accessed = false;
  const context = {
    ...consent,
    get disclosure_present() {
      accessed = true;
      return true;
    },
  };
  verdict(sharing, context, "REVIEW", "SG-CORE-004");
  assert.equal(accessed, false);
});
test("null-prototype JSON records work without inherited fields", () => {
  verdict(
    Object.assign(Object.create(null), sharing),
    Object.assign(Object.create(null), consent),
    "PASS",
    "SG-PRIV-003",
  );
});
test("hostile JavaScript wrappers fail closed without throwing", () => {
  const input = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error("unreadable");
      },
    },
  );
  assert.equal(evaluate(input).decision, "REVIEW");
  assert.equal(adaptStructuredAction(input).ok, false);
});
test("unrelated host context is allowed but cannot override a verdict", () => {
  verdict(
    sharing,
    { ...consent, requestId: "abc", decision: "BLOCK" },
    "PASS",
    "SG-PRIV-003",
  );
  verdict(
    external,
    { ...paymentContext, decision: "PASS" },
    "BLOCK",
    "SG-PAY-002",
  );
});
test("evaluation is deterministic, mutation-free, and result objects are independent", () => {
  const action = Object.freeze({ ...sharing });
  const context = Object.freeze({ ...consent });
  const input = Object.freeze({ action, context });
  const first = evaluate(input);
  assert.deepEqual(first, evaluate(input));
  first.matchedRule.id = "spoofed";
  first.normalizedAction.provider = "changed";
  first.actionTypes.push("BYPASS");
  const fresh = evaluate(input);
  assert.equal(fresh.matchedRule.id, "SG-PRIV-003");
  assert.deepEqual(fresh.normalizedAction, sharing);
  assert.equal(context.consent_for_third_party_ai, true);
  assert.equal(fresh.actionTypes.includes("BYPASS"), false);
});

for (const raw of [
  {
    type: "open_url",
    target: "stripe_checkout",
    product: "digital_subscription",
  },
  {
    type: "purchase",
    target: "storekit_subscription",
    product: "digital_subscription",
    channel: "in_app",
  },
  { type: "send_to_ai", provider: "third_party_ai", data: "contacts" },
  {
    type: "request_permission",
    target: "contacts_picker",
    intent: "select_three_contacts",
  },
]) {
  test(`adapter maps ${raw.type} without mutating or sharing the raw action`, () => {
    const before = structuredClone(raw);
    const adapted = adaptStructuredAction(Object.freeze(raw));
    assert.equal(adapted.ok, true);
    assert.notEqual(adapted.action, raw);
    assert.deepEqual(adapted.issues, []);
    assert.deepEqual(raw, before);
    const { type, ...fields } = adapted.action;
    assert.deepEqual(
      fields,
      Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "type")),
    );
    assert.ok(adapted.categories.includes(type));
  });
}
test("adapter never parses source strings or silently ignores extra action fields", () => {
  for (const raw of [
    "open_url(stripe_checkout)",
    [{ type: "send_to_ai" }],
    { ...SCENARIOS[1].module.action, url: "exfiltrate" },
    { type: "send_to_ai", provider: "third_party_ai" },
    { type: "constructor" },
  ]) {
    const adapted = adaptStructuredAction(raw);
    assert.equal(adapted.ok, false);
    assert.equal(adapted.action, null);
    assert.ok(adapted.issues.length > 0);
  }
});
test("all rule IDs are unique and every pack carries an immutable version", () => {
  assert.deepEqual(
    POLICY_PACKS.map((pack) => pack.name),
    ["core", "payments", "privacy", "permissions"],
  );
  const ids = POLICY_PACKS.flatMap((pack) => pack.rules.map((rule) => rule.id));
  assert.equal(ids.length, new Set(ids).size);
  for (const pack of POLICY_PACKS) {
    assert.equal(pack.version, "1.0.0");
    assert.ok(Object.isFrozen(pack) && Object.isFrozen(pack.rules));
    for (const rule of pack.rules) assert.ok(Object.isFrozen(rule));
  }
});
test("package exports and browser pin agree on release 1.0.0", async () => {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(pkg.version, ENGINE_VERSION);
  assert.equal(POLICY_VERSION, "1.0.0");
  const app = await readFile(
    new URL("../public/app.js", import.meta.url),
    "utf8",
  );
  assert.ok(app.includes(`./engine/v${ENGINE_VERSION}/index.js`));
  assert.equal(pkg.dependencies, undefined);
});

test("host integration never invokes an executor for BLOCK or REVIEW", async () => {
  let calls = 0;
  for (const scenario of SCENARIOS) {
    const outcome = await executeAfterValidation({
      action: scenario.module.action,
      context: scenario.context,
      execute: () => calls++,
    });
    assert.equal(outcome.executed, false);
  }
  assert.equal(calls, 0);
});
test("host integration executes precisely the evaluated canonical action once for PASS", async () => {
  let calls = 0;
  const raw = { ...SCENARIOS[1].module.action };
  const outcome = await executeAfterValidation({
    action: raw,
    context: consent,
    execute: async (action) => {
      calls++;
      assert.deepEqual(action, sharing);
      action.provider = "mutated by executor";
      raw.data = "changed later";
      return "mock executed";
    },
  });
  assert.equal(outcome.executed, true);
  assert.equal(calls, 1);
  assert.equal(outcome.value, "mock executed");
  assert.deepEqual(outcome.result.normalizedAction, sharing);
});
test("host integration holds adapter failures and returns diagnostics", async () => {
  const outcome = await executeAfterValidation({
    action: "send_to_ai()",
    context: consent,
    execute: () => assert.fail("must not execute"),
  });
  assert.equal(outcome.executed, false);
  assert.equal(outcome.result.decision, "REVIEW");
  assert.ok(outcome.adapterIssues.length > 0);
});
test("PASS does not create an implicit executor", async () => {
  await assert.rejects(
    executeAfterValidation({
      action: SCENARIOS[1].module.action,
      context: consent,
    }),
    /host executor is required/,
  );
});
