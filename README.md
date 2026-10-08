# StoreGate

A minimal, deterministic 12-second demo of a **runtime policy firewall for AI-generated actions**. Plain HTML, CSS, and JavaScript. No third-party runtime dependencies, backend, accounts, database, LLM calls, or paid services.

## Run locally

Prerequisite: Node.js 20 or later, with npm.

From this project directory, run one command (no install step needed):

```sh
npm start
```

Open **http://localhost:3000**. Stop the server with Ctrl+C. `npm run dev` is an alias. To use another port in PowerShell:

```powershell
$env:PORT = "3001"
npm start
```

Click **Run StoreGate**. The demo intercepts the mock button's structured action, checks the runtime context, and reveals the result. Reset cancels an in-progress run; Run again replays it. The decorative Continue button never opens a checkout.

## The one demo scenario

```text
Action:   open_url(stripe_checkout)
          product = digital_subscription

Context:  platform = iOS
          storefront = DE
          external_purchase_entitlement = false

Decision: BLOCK
Reason:   External digital purchase detected
Context:  iOS / DE storefront / entitlement missing
Suggested action: Use approved in-app purchase flow
```

This is an illustrative, fixed demo rule, **not a prediction of Apple review**, a comprehensive statement of current App Store rules, or a production policy engine. Unmodeled inputs return REVIEW, not an implied approval. PASS / BLOCK / REVIEW in the footer are the decision vocabulary; this demo exercises BLOCK only.

## Animation

| Time      | Visible step                                        |
| --------- | --------------------------------------------------- |
| 0–2.2 s   | Capture the generated Continue action               |
| 2.2–5.2 s | Inspect the structured action and runtime context   |
| 5.2–8 s   | Apply the illustrative blocking rule                |
| 8–12 s    | Reveal BLOCK, reason, context, and suggested action |

Animation time is presentation pacing, not a policy-engine latency benchmark. The decision is computed synchronously in the browser. The timeline uses elapsed time rather than chained timers; reset cancels the animation frame. If the browser suspends a background tab, the visible timeline catches up when resumed.

On narrow screens, the panels stack and the walkthrough scrolls to the active panel. With `prefers-reduced-motion: reduce`, moving effects and automatic scrolling are disabled while the same timed, accessible text sequence remains. Stage announcements use a polite live region; controls work with a keyboard.

## Deploy to GitHub Pages

Public demo: **https://Yarlo-AI.github.io/StoreGate-demo/**

Repository: **https://github.com/Yarlo-AI/StoreGate-demo**

Every push to `main` runs `.github/workflows/pages.yml`: it checks out the source, sets up Node.js 20, runs `npm test` and `npm run build`, and publishes `dist/` using the official GitHub Pages actions. There are no dependencies to install. The workflow can also be started manually from the repository's Actions tab.

GitHub Pages uses **GitHub Actions** as its build source. Authentication uses the workflow's automatically provided `GITHUB_TOKEN`; no custom secret, API key, environment variable, or paid service is needed. `dist/` stays out of Git and is built on the runner.

All asset and home links are relative, so the site works both at localhost and under the `/StoreGate-demo/` project path. For future updates, commit the changes and push to `main`; wait for the Pages workflow to finish before sharing the updated site.

Official instructions: [Deploying GitHub Pages with custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The existing `vercel.json` is retained as a legacy file and is not used by this deployment.

## Verification commands

```sh
npm test
npm run build
```

The tests check the exact scenario result and prevent accidental approval or blocking of unmodeled inputs. The build copies the self-contained assets into `dist/` for static hosting. Browser QA should check the full sequence, reset during playback, replay, keyboard controls, reduced motion, and laptop/mobile text fit.

Verified locally on October 7, 2026: policy tests and static build passed; the browser reached Intercept at 0 s, Inspect at 2.21 s, Enforce at 5.20 s, Verdict at 8.01 s, and Complete at 12.00 s. Reset during replay returned to the idle state. Responsive checks covered 320, 390, 820, 1024, and 1366 CSS-pixel widths. Keyboard activation and the reduced-motion setting were also checked.

## File structure

```text
StoreGate-demo/
  .github/workflows/
    pages.yml          Test, build, and deploy to GitHub Pages on main
  public/
    index.html         Semantic demo layout and inline vector symbols
    styles.css         Responsive layout, transitions, reduced-motion support
    app.js             Twelve-second playback, narration, reset, and replay
    policy.js          Fixed scenario and pure deterministic rule
    favicon.svg        StoreGate mark
  scripts/
    serve.mjs          Dependency-free local static server
    build.mjs          Copy public assets to dist for deployment
  test/
    policy.test.js     Scenario and out-of-scope checks
  package.json         Local commands; no dependencies
  vercel.json          Legacy settings; unused by GitHub Pages
  README.md
```

The local Node server is a development convenience. Production contains only static assets. All visuals are CSS or inline SVG; there are no external fonts, trackers, or network requests to third-party services.
