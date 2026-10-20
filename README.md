# StoreGate v0.2

A static, deterministic demo of a **runtime policy firewall for AI-generated actions**, showing the intended integration boundary with StemJSON. Three selectable, 10-second walkthroughs. Plain HTML, CSS, and JavaScript, with no third-party runtime dependencies.

**Live demo:** https://yarlo-ai.github.io/StoreGate-demo/

## Run locally

Prerequisite: Node.js 20 or later, with npm. From this directory, run:

```sh
npm start
```

No install step is required. Open **http://localhost:3000**. Stop with Ctrl+C. `npm run dev` is an alias. To use another port in PowerShell:

```powershell
$env:PORT = "3001"
npm start
```

Choose a scenario and click **Run StoreGate**. **Reset** cancels playback; **Run again** replays it. Selecting another scenario also cancels the current run and clears its result. The mock Continue button never performs an action.

## The integration point

```text
User Prompt → LLM → StemJSON → validate() → StoreGate → execute()
                              structure     policy       held
```

**StoreGate complements StemJSON validation. It does not replace it.**

**Structure can be valid while the action is still policy-sensitive.**

StemJSON says the module is valid. StoreGate asks whether the sensitive action is acceptable in this runtime context. The first four pipeline steps establish structural validity; StoreGate intercepts only the sensitive action at the execution boundary.

The LLM and StemJSON stages are illustrated using fixed fixtures. `validateDemoModule()` is a small local shape check, not an implementation of StemJSON's schema or an integration with its actual API. The expandable UI example is conceptual host pseudocode, not an SDK. No model, external API, device permission, contact data, or checkout is used.

## Three scenarios

| Scenario                        | Generated action                           | Normalized types                                                   | Result |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | ------ |
| External digital purchase       | `open_url(stripe_checkout)`                | `OPEN_EXTERNAL_URL`, `PURCHASE`                                    | BLOCK  |
| Personal data to third-party AI | `send_to_ai(provider = third_party_ai)`    | `SEND_TO_THIRD_PARTY_AI`, `SHARE_PERSONAL_DATA`, `ACCESS_CONTACTS` | BLOCK  |
| Broad permission request        | `request_permission(contacts_full_access)` | `REQUEST_PERMISSION`, `ACCESS_CONTACTS`                            | REVIEW |

### A — External digital purchase

- Metadata: `product = digital_subscription`
- Runtime context: `platform = iOS`, `storefront = DE`, `external_purchase_entitlement = false`
- Reason: External digital purchase action detected in a context requiring additional store-policy handling.
- Suggested safer action: Use the approved in-app purchase flow or route for review.

This is an illustrative store-policy rule, **not a prediction of Apple review** or a comprehensive statement of current App Store rules.

### B — Personal data to third-party AI

- Data: `contacts`
- Runtime context: `consent_for_third_party_ai = false`, `disclosure_present = false`
- Reason: Personal data is about to be sent to a third-party AI provider without the required disclosure/consent state.
- Suggested safer action: Insert disclosure + explicit consent before execution.

### C — Broad permission request

- Intent: `select_three_contacts`
- Runtime context: `platform = Android`, `narrower_picker_available = true`
- Reason: Requested access appears broader than necessary for the stated intent.
- Suggested safer action: Use a narrower contact picker or request human review.

The UI displays the raw action, normalized types, runtime context, verdict, reason, and safer action for each scenario. BLOCK stops execution; REVIEW holds execution for a revised action or human review. All three fixture modules remain structurally VALID.

`normalizeAction()` maps explicit structured fields with deterministic JavaScript rules. `evaluateAction()` is a pure, intentionally small demo evaluator. Missing or unmodeled inputs return REVIEW. The known data-to-AI rule can return PASS only when both consent and disclosure are boolean `true`; that boundary is unit-tested, but there is no fourth selectable scenario or real execution. PASS means eligible under that modeled rule, not blanket policy approval.

## Playback and accessibility

| Time      | Visible step                                            |
| --------- | ------------------------------------------------------- |
| 0–2.5 s   | User prompt → illustrated LLM → StemJSON output         |
| 2.5–3.5 s | `validate()` confirms structural validity               |
| 3.5–4.8 s | Sensitive action is intercepted and normalized          |
| 4.8–6.5 s | StoreGate checks runtime context                        |
| 6.5–8 s   | BLOCK or REVIEW and its reason appear                   |
| 8–10 s    | Safer action appears; `execute()` stays stopped or held |

The decision is computed synchronously; the 10 seconds are presentation pacing, not an engine latency benchmark. Playback uses elapsed time with `requestAnimationFrame`, so a suspended tab catches up on return.

Scenario tabs support Left/Right, Home/End, and native Enter/Space activation. Run and Reset are keyboard-accessible. A polite live region announces the stages. On mobile, panels stack and playback scrolls to the active stage, with controls remaining accessible. With `prefers-reduced-motion: reduce`, moving effects, transitions, and automatic scrolling are disabled while the timed text sequence remains.

## Verification

```sh
npm test
npm run build
```

Tests cover all three exact outcomes and normalizations, independent structural validation, consent boundaries, unknown/missing context, malformed modules, and conservative handling of unmodeled actions. The build copies the self-contained assets to `dist/`.

Browser checks should cover all three full walkthroughs, reset/replay, switching during playback, keyboard tabs, reduced motion, and laptop/mobile text fit. No sensitive action should execute in any of the three scenarios.

## Deploy

The existing GitHub Pages site uses `.github/workflows/pages.yml`. Push a committed change to `main`:

```sh
git push origin main
```

The workflow runs `npm test` and `npm run build`, then deploys `dist/` with the official GitHub Pages actions. Pages uses **GitHub Actions** as its build source. The workflow can also be run manually in the repository's Actions tab. No custom secret or paid service is required.

All asset and home links are relative, including the JavaScript module imports, so the site works under `/StoreGate-demo/` and at localhost. `dist/` is generated on the runner and stays out of Git.

For an optional Vercel deployment, import the repository, use `npm run build` as the build command, and `dist` as the output directory. The included `vercel.json` provides those settings; GitHub Pages remains the existing deployment target.

## File structure

```text
StoreGate-demo/
  .github/workflows/
    pages.yml          Test, build, and deploy main to GitHub Pages
  public/
    index.html         Six-step pipeline and three scenario tabs
    styles.css         Responsive layout and reduced-motion support
    app.js             Ten-second playback, keyboard tabs, reset/replay
    scenarios.js       Fixed modules, metadata, and runtime contexts
    policy.js          Shape check, normalization, and demo policy rules
    favicon.svg        StoreGate shield
  scripts/
    serve.mjs          Dependency-free local static server
    build.mjs          Copy public assets to dist
  test/
    policy.test.js     Normalization, validity, and policy boundary tests
  package.json         Commands; no dependencies
  vercel.json          Optional static Vercel deployment settings
  README.md
```

The Node server is only a local development convenience. Production contains static assets. There is no backend, database, account system, analytics, SDK, wallet/token logic, external font, LLM call, or external API request.
