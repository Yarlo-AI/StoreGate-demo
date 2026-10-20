# StoreGate 1.0.0

A reusable, deterministic policy engine for sensitive structured actions. **`evaluate({ action, context })` returns a result whose `decision` is `PASS`, `BLOCK`, or `REVIEW`.** The engine is synchronous, side-effect-free, and independent of the browser demo. It has no external runtime dependencies, network calls, backend, storage, accounts, analytics, or LLM integration.

**Public demo:** https://yarlo-ai.github.io/StoreGate-demo/

The demo imports the same engine shipped to application integrators. Its three original scenarios remain available; editable boolean context can also exercise PASS. For example, select **Data to AI**, enable both disclosure and consent, and run again. The UI exposes the actual result JSON, matched rule ID, and policy version. It never executes a sensitive action.

## Local commands

Prerequisite: Node.js 20+ and npm. No dependency installation is needed to develop this repository.

```sh
npm start
```

This builds the static site and serves **http://localhost:3000**. Stop with Ctrl+C. After changing source, restart the server or run `npm run build` and reload. `npm run dev` is an alias.

```sh
npm test          # Engine, adapter, scope, and host integration tests
npm run build    # Generate dist, including a copy of the shared engine
npm run example  # BLOCK, REVIEW, and PASS with an explicitly mocked executor
npm pack         # Produce storegate-1.0.0.tgz for another application
```

The package is named `storegate`, version **1.0.0**, and intentionally marked `private` to prevent accidental registry publication. It is **not published to npm**. Install the generated archive from your application's directory:

```sh
npm install /absolute/path/to/storegate-1.0.0.tgz
```

Or install a local checkout with `npm install /absolute/path/to/StoreGate-demo`. Do not use `npm install storegate` expecting this repository's package. The archive includes engine source, TypeScript declarations, the integration example, and this contract; it excludes the demo and development output.

## Integration boundary

```text
User prompt → LLM → StemJSON → structural validation
           → structured-action adapter → StoreGate evaluate() → host execution
```

**StoreGate complements StemJSON validation. It does not replace it.**

**Structure can be valid while the action is still policy-sensitive.**

Keep your existing structural validator. After it succeeds, adapt only the sensitive action and obtain context from trusted application state. Do not accept consent, platform, entitlement, or approval claims from the generated module. The demo's LLM/StemJSON stages and local module validator are illustrative; there is no StemJSON SDK dependency or claim that the demo implements its schema.

### Minimal API example

```js
import { adaptStructuredAction, evaluate } from "storegate";

const adapted = adaptStructuredAction({
  type: "send_to_ai",
  provider: "third_party_ai",
  data: "contacts",
});

const result = evaluate({
  action: adapted.action,
  context: {
    consent_for_third_party_ai: false,
    disclosure_present: false,
  },
});

console.log(result.decision); // BLOCK
console.log(result.matchedRule.id); // SG-PRIV-002

// Only after host structural validation and with current, trusted context:
if (result.decision === "PASS") {
  // hostExecutor(result.normalizedAction);
}
// BLOCK and REVIEW both hold execution. REVIEW is not permission to proceed.
```

For canonical actions, the adapter is optional:

```js
const result = evaluate({
  action: {
    type: "REQUEST_PERMISSION",
    target: "contacts_picker",
    intent: "select_three_contacts",
  },
  context: { platform: "Android", narrower_picker_available: true },
});
// PASS under SG-PERM-003
```

`examples/host-integration.mjs` exports `executeAfterValidation({ action, context, execute })`. It snapshots the input, adapts it, evaluates it, and invokes the supplied executor **only for PASS**, with the evaluated canonical action. Its CLI uses a mock executor. Tests verify that BLOCK, REVIEW, and adapter failure never invoke that executor. The host remains responsible for running structural validation before this example, supplying current context, and handling executor errors.

## Exact integration contract

Public ESM exports:

| Export                       | Contract                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `evaluate(input)`            | Synchronous `PolicyResult`; no execution or persistence                                                 |
| `adaptStructuredAction(raw)` | Explicit DTO mapping; returns `AdaptationResult`                                                        |
| `ENGINE_VERSION`             | Engine implementation version, currently `1.0.0`                                                        |
| `POLICY_VERSION`             | Aggregate policy release, currently `1.0.0`                                                             |
| `POLICY_PACKS`               | Frozen discovery metadata for core/payments/privacy/permissions, including versions and stable rule IDs |

TypeScript declarations are provided through the package's `types` and `exports` fields. Runtime code is plain ESM JavaScript and can be imported in Node or bundled into a browser application. CommonJS `require()` is not an exported entry point.

### Evaluation input

The top-level object has exactly two supported keys: `action` and `context`. Supply plain data objects (normal or null prototypes). Action batches, class instances, getters, source-code strings, and functions are outside the contract. Malformed inputs are held with REVIEW rather than interpreted or executed.

A canonical action is one of these exact shapes. All listed fields are required; strings must be nonempty. Unknown action fields return REVIEW rather than being silently stripped.

| `action.type`            | Other required fields                                                  | Policy pack |
| ------------------------ | ---------------------------------------------------------------------- | ----------- |
| `OPEN_EXTERNAL_URL`      | `target: string`, `product: string`                                    | payments    |
| `PURCHASE`               | `target: string`, `product: string`, `channel: "external" \| "in_app"` | payments    |
| `SEND_TO_THIRD_PARTY_AI` | `provider: string`, `data: string`                                     | privacy     |
| `REQUEST_PERMISSION`     | `target: string`, `intent: string`                                     | permissions |

Values are case-sensitive, with no coercion or language inference. A URL/target is an opaque host identifier; the engine neither opens it nor validates its ownership. The host must map approved identifiers to its own allowlisted executors. Each evaluation covers **one** sensitive operation. Composite actions must be separated, structurally validated, and evaluated individually.

`context` is a plain object. Additional unrelated host fields are allowed and ignored, but the following fields are mandatory for the selected action:

| Action                                     | Required context fields and types                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `OPEN_EXTERNAL_URL` or external `PURCHASE` | `platform: string`, `storefront: string`, `external_purchase_entitlement: boolean` |
| In-app `PURCHASE`                          | `platform: string`, `storefront: string`, `in_app_purchase_approved: boolean`      |
| `SEND_TO_THIRD_PARTY_AI`                   | `consent_for_third_party_ai: boolean`, `disclosure_present: boolean`               |
| `REQUEST_PERMISSION`                       | `platform: string`, `narrower_picker_available: boolean`                           |

A required field that is missing, null, inherited, empty, or mistyped returns REVIEW. In particular, `"true"`, `1`, and a missing boolean are never equivalent to `true`. A partial context returns REVIEW even if another supplied flag is explicitly false. Once all required fields are valid, values outside the modeled scope also return REVIEW.

Context attestations must apply to the **specific action being evaluated**, including the intended provider, data scope, and approved purchase route. They are host facts, not a mechanism for the engine to verify those facts.

### Structured-action adapter

The adapter accepts these lower-case operation DTOs and maps only their explicit fields:

| Generated operation  | Canonical type           | Required fields copied         |
| -------------------- | ------------------------ | ------------------------------ |
| `open_url`           | `OPEN_EXTERNAL_URL`      | `target`, `product`            |
| `purchase`           | `PURCHASE`               | `target`, `product`, `channel` |
| `send_to_ai`         | `SEND_TO_THIRD_PARTY_AI` | `provider`, `data`             |
| `request_permission` | `REQUEST_PERMISSION`     | `target`, `intent`             |

Success: `{ ok: true, action, categories: string[], issues: [] }`.

Failure: `{ ok: false, action: null, categories: [], issues: InputIssue[] }`.

`categories` are descriptive normalization labels such as `PURCHASE`, `OPEN_EXTERNAL_URL`, `SHARE_PERSONAL_DATA`, `SEND_TO_THIRD_PARTY_AI`, `REQUEST_PERMISSION`, and `ACCESS_CONTACTS`. They are derived from the fields; callers cannot use them to skip validation or route around a policy. The evaluator derives its own `actionTypes` for the result.

The adapter does not parse `open_url(stripe_checkout)` or other function-call strings. A host with a different action format must explicitly map it to this contract. Adapter failure should hold execution; passing `action: null` to `evaluate` produces a diagnostic REVIEW result.

### Result

Every evaluation, including malformed input, returns these fields:

```json
{
  "decision": "BLOCK",
  "reason": "Personal data is about to be sent to a third-party AI provider without the required disclosure/consent state.",
  "suggestion": "Insert disclosure + explicit consent before execution.",
  "matchedRule": {
    "id": "SG-PRIV-002",
    "pack": "privacy",
    "version": "1.0.0"
  },
  "engineVersion": "1.0.0",
  "policyVersion": "1.0.0",
  "normalizedAction": {
    "type": "SEND_TO_THIRD_PARTY_AI",
    "provider": "third_party_ai",
    "data": "contacts"
  },
  "actionTypes": [
    "SEND_TO_THIRD_PARTY_AI",
    "SHARE_PERSONAL_DATA",
    "ACCESS_CONTACTS"
  ],
  "issues": []
}
```

`normalizedAction` is a fresh canonical action object, or `null` when the action is invalid. `issues` contains `{ field, code, message }` for input problems; codes are `invalid_type`, `required`, `unsupported`, and `unknown_field`. Unknown but well-formed policy scope can have an empty `issues` array; its rule and reason explain the REVIEW.

Results contain no timestamps, randomness, hidden state, or runtime context echoes. Repeated evaluations of the same data and policy version produce the same JSON result. Inputs are not mutated, and returned objects do not share mutable state with the policy definitions.

### Precedence and supported rules

Evaluation order is deterministic: envelope → action contract → context object → required pack context → modeled rule/scope. There is one matched rule per result. All packs are bundled; evaluation options cannot disable them. There is no cross-pack voting, implicit allow, or configurable override in 1.0.

| Stable rule ID | Result | Scope                                                                                   |
| -------------- | ------ | --------------------------------------------------------------------------------------- |
| `SG-CORE-001`  | REVIEW | Invalid evaluation envelope / unreadable non-data input                                 |
| `SG-CORE-002`  | REVIEW | Missing, malformed, or ambiguous action fields                                          |
| `SG-CORE-003`  | REVIEW | Unsupported canonical action type                                                       |
| `SG-CORE-004`  | REVIEW | Missing or invalid context object                                                       |
| `SG-PAY-001`   | REVIEW | Missing or mistyped payment context                                                     |
| `SG-PAY-002`   | BLOCK  | External digital subscription, iOS, DE, entitlement false; any nonempty checkout target |
| `SG-PAY-003`   | PASS   | In-app digital subscription, iOS, DE, host approval true                                |
| `SG-PAY-004`   | REVIEW | Unmodeled payment scope, including an external entitlement being true                   |
| `SG-PAY-005`   | BLOCK  | In-app digital subscription, iOS, DE, host approval false                               |
| `SG-PRIV-001`  | REVIEW | Missing or mistyped disclosure/consent context                                          |
| `SG-PRIV-002`  | BLOCK  | Contacts to `third_party_ai`, with complete boolean context and either flag false       |
| `SG-PRIV-003`  | PASS   | Contacts to `third_party_ai`, with both flags true                                      |
| `SG-PRIV-004`  | REVIEW | Unmodeled provider or data category                                                     |
| `SG-PERM-001`  | REVIEW | Missing or mistyped permission context                                                  |
| `SG-PERM-002`  | REVIEW | Android full contact access for selecting three contacts when a picker exists           |
| `SG-PERM-003`  | PASS   | Android `contacts_picker` for `select_three_contacts` when the picker exists            |
| `SG-PERM-004`  | REVIEW | Other permission scope, including unavailable picker or unknown intent/platform         |

Rule IDs identify a policy's purpose and must not be reused for a different purpose. Change the relevant pack version and aggregate policy version whenever rule behavior changes. Version the engine/API separately; incompatible contract changes require a major package version. Consumers should pin the package and retain both the matched-rule version and aggregate policy version when they record decisions.

## Demo and deployment

The existing dark/blue UI, three scenarios, 10-second playback, Reset, Run again, keyboard tabs, and reduced-motion behavior are preserved. Changing context or scenario cancels old playback and clears stale results. PASS is blue, BLOCK red, REVIEW amber. The result JSON comes directly from `evaluate()`.

The animation is presentation pacing only; evaluation itself is synchronous. With reduced motion enabled, transitions and automatic scrolling are disabled while the timed text sequence remains.

`npm run build` clears only this project's generated `dist/`, copies `public/`, and copies `src/` unchanged into `dist/engine/v1.0.0/`. Both Node consumers and the demo therefore use the same source implementation. Browser assets carry release queries; engine imports use a versioned directory, including their transitive imports. Update release pins together to avoid mixing cached versions.

The existing GitHub Pages workflow runs tests and build and deploys `dist/` for every push to `main`:

```sh
git push origin main
```

Wait for the Actions deployment to succeed before sharing the update. Asset paths are relative and work under `/StoreGate-demo/`. No custom secrets or paid services are required. For optional Vercel hosting, use `npm run build` and output directory `dist`, as specified in `vercel.json`.

## File structure

```text
src/
  index.js / index.d.ts   Public ESM API and TypeScript declarations
  engine.js              Input guards, dispatch, deterministic results
  adapter.js             Explicit structured-action normalization
  contracts.js           Contract validation and derived action categories
  rules.js               Core fallback rules and immutable rule metadata
  versions.js            Engine and aggregate policy versions
  packs/
    payments.js          Payment rules and version
    privacy.js           Disclosure/consent rules and version
    permissions.js       Least-access rules and version
examples/
  host-integration.mjs   PASS-only host dispatch with a mock CLI
public/
  index.html, styles.css Browser UI
  app.js                 Playback and calls to the shared engine
  scenarios.js           Three original fixtures
  module-validation.js   Separate, illustrative module shape validation
scripts/
  build.mjs, serve.mjs   Static packaging and local server
test/policy.test.js      Engine, adapter, and host boundary tests
.github/workflows/pages.yml
```

## Remaining limitations

- This is a production-oriented integration foundation with a deliberately small policy catalog, not a complete compliance product or a prediction of Apple review. The payment rules are curated application examples, not a live source of store regulations.
- PASS means eligible **under the matched modeled rule**. It does not certify overall legal, store, privacy, or security compliance. Unmodeled actions and contexts need policy work or human review.
- The host supplies trustworthy, current context and binds consent/approval to the actual provider, data, target, and user. StoreGate does not verify attestations, identify personal data, refresh policy rules, or enforce a sandbox around an executor.
- Each call evaluates one explicit action. Multi-action transactions, combined policy composition, consent UI, URL allowlisting, auditing/storage, and human review workflows belong to the host or future work.
- The host must evaluate immediately before dispatch and re-evaluate if context or the action changes. A client-side decision alone is not a security boundary against a hostile client. No external security or compliance audit has been performed.
- Only the four documented action forms, Node ESM/browser ESM, and the listed policy scopes are supported. There is no production StemJSON adapter because this repository does not depend on an authoritative StemJSON wire schema; the included DTO adapter is explicit and standalone.
