import { SCENARIOS } from "./scenarios.js?v=1.0.0";
import { validateDemoModule } from "./module-validation.js?v=1.0.0";
import {
  adaptStructuredAction,
  evaluate,
  ENGINE_VERSION,
  POLICY_VERSION,
} from "./engine/v1.0.0/index.js";

const DEMO_DURATION = 10_000;
const $ = (selector) => document.querySelector(selector);
const demo = $(".demo");
const run = $("#run");
const reset = $("#reset");
const tabs = [...document.querySelectorAll('[role="tab"]')];
const nodes = [...document.querySelectorAll("[data-node]")];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const idleNodeLabels = [
  "Intent provided",
  "Generates module",
  "Structured output",
  "Structure: valid",
  "Policy check",
  "Held at the gate",
];
const completedNodeLabels = [
  "Intent captured",
  "Module generated",
  "Structured module",
  "Structure: valid",
];
const phases = [
  {
    at: 0,
    name: "prompt",
    node: 0,
    text: "A user asks for a mobile feature. Follow the module to the execution boundary.",
  },
  {
    at: 900,
    name: "generate",
    node: 1,
    text: "The illustrated LLM stage supplies a fixed generated module. No model is called.",
  },
  {
    at: 1700,
    name: "structure",
    node: 2,
    text: "The illustrated StemJSON stage provides structured output for validation.",
  },
  {
    at: 2500,
    name: "validate",
    node: 3,
    text: "validate() confirms the module's shape. Valid structure does not approve the action.",
  },
  {
    at: 3500,
    name: "normalize",
    node: 4,
    text: "StoreGate intercepts only the sensitive action and deterministically normalizes its fields.",
    target: "#source-stage",
  },
  {
    at: 4800,
    name: "context",
    node: 4,
    text: "StoreGate checks the normalized action against the runtime context.",
    target: "#gate-stage",
  },
  { at: 6500, name: "verdict", node: 4, target: "#result-stage" },
  { at: 8000, name: "safer", node: 5 },
  { at: DEMO_DURATION, name: "complete", node: 5 },
];
let selected = SCENARIOS[0];
let validation;
let normalized;
let runtimeContext;
let verdict;
let frame = null;
let startedAt = 0;
let activePhase = "idle";

function followStage(selector) {
  const narrowScreen = matchMedia("(max-width: 800px)").matches;
  if (
    selector &&
    (narrowScreen || selector === ".pipeline") &&
    !reducedMotion.matches
  ) {
    $(selector).scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function resetPlayback() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  verdict = null;
  activePhase = "idle";
  demo.dataset.phase = "idle";
  demo.dataset.verdict = "pending";
  run.disabled = !validation?.valid;
  run.querySelector("span").textContent = "Run StoreGate";
  reset.disabled = true;
  $("#elapsed").textContent = "00";
  $("#timeline-fill").style.width = "0%";
  $(".timeline").setAttribute("aria-valuenow", "0");
  $(".result-placeholder").hidden = false;
  $(".verdict").hidden = true;
  $("#result-json").textContent =
    "Run StoreGate to inspect the engine's JSON result.";
  $("#matched-rule").textContent = "";
  for (const detail of document.querySelectorAll(".verdict-detail"))
    detail.classList.remove("is-visible");
  $("#source-status").textContent =
    "Valid structure. Sensitive action unevaluated.";
  $("#gate-status").textContent = "Only the sensitive action";
  $("#gate-bottom").textContent = "Between validate() and execute()";
  $("#execution-status").textContent = "execute() has not been called";
  $("#narration").textContent =
    "The module is structurally valid. Run the demo to check its sensitive action.";
  nodes.forEach((node, index) => {
    node.classList.remove("current", "done");
    node.removeAttribute("aria-current");
    node.querySelector(".node-status").textContent = idleNodeLabels[index];
  });
}

function selectScenario(id) {
  const next = SCENARIOS.find((scenario) => scenario.id === id);
  if (!next) return;
  selected = next;
  validation = validateDemoModule(selected.module);
  const adapted = adaptStructuredAction(selected.module.action);
  normalized = adapted.action;
  runtimeContext = structuredClone(selected.context);
  resetPlayback();
  demo.dataset.scenario = id;
  tabs.forEach((tab) => {
    const active = tab.dataset.scenario === id;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const fixture = SCENARIOS.find((item) => item.id === tab.dataset.scenario);
    updateTabVerdict(
      tab,
      evaluate({
        action: adaptStructuredAction(fixture.module.action).action,
        context: fixture.context,
      }).decision,
    );
  });
  $("#scenario-panel").setAttribute("aria-labelledby", `tab-${id}`);
  $("#scenario-name").textContent = selected.name;
  $("#prompt").textContent = selected.prompt;
  $("#module-title").textContent = selected.module.title;
  $("#raw-action").textContent = selected.raw;
  $("#metadata").textContent = selected.metadata;
  $("#rule-note").textContent = selected.ruleNote;
  const types = adapted.categories.map((type) => {
    const item = document.createElement("li");
    item.textContent = type;
    return item;
  });
  $("#normalized-types").replaceChildren(...types);
  const fields = Object.entries(runtimeContext).map(([key, value]) => {
    const pair = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = key;
    if (typeof value === "boolean") {
      const toggle = document.createElement("input");
      const label = document.createElement("label");
      const text = document.createElement("span");
      toggle.type = "checkbox";
      toggle.checked = value;
      toggle.setAttribute("aria-label", key.replaceAll("_", " "));
      text.textContent = String(value);
      toggle.addEventListener("change", () => {
        runtimeContext[key] = toggle.checked;
        text.textContent = String(toggle.checked);
        resetPlayback();
        updateTabVerdict(
          tabs.find((tab) => tab.dataset.scenario === selected.id),
          evaluate({ action: normalized, context: runtimeContext }).decision,
        );
        $("#narration").textContent =
          "Context updated. Run the engine again to inspect the decision and matched rule.";
      });
      label.append(toggle, text);
      description.append(label);
    } else description.textContent = String(value);
    pair.append(term, description);
    return pair;
  });
  $("#context-fields").replaceChildren(...fields);
  if (!validation.valid) {
    $(".structure-badge").textContent = "INVALID";
    nodes[3].querySelector(".node-status").textContent = "Structure: invalid";
    $("#source-status").textContent = "Structural validation failed.";
    $("#narration").textContent =
      "Fix the module structure before a policy check can run.";
  }
}

function updateTabVerdict(tab, decision) {
  const label = tab.querySelector(".scenario-verdict");
  label.textContent = decision;
  label.className = `scenario-verdict ${decision.toLowerCase()}`;
}

function applyPhase(phase) {
  if (activePhase === phase.name) return;
  activePhase = phase.name;
  demo.dataset.phase = phase.name;
  nodes.forEach((node, index) => {
    node.classList.toggle(
      "current",
      index === phase.node && phase.name !== "complete",
    );
    // The demo never dispatches an action, including when the engine returns PASS.
    node.classList.toggle("done", index < Math.min(phase.node, 4));
    if (index === phase.node) node.setAttribute("aria-current", "step");
    else node.removeAttribute("aria-current");
    if (index < Math.min(phase.node, 4))
      node.querySelector(".node-status").textContent =
        completedNodeLabels[index];
  });
  if (phase.at >= 3500) {
    $("#source-status").textContent =
      "Module valid. Sensitive action intercepted.";
    $("#gate-status").textContent =
      phase.at < 4800 ? "Normalizing action" : "Inspecting runtime context";
    $("#gate-bottom").textContent = "Execution held during policy evaluation";
    nodes[4].querySelector(".node-status").textContent =
      phase.at < 4800 ? "Normalize action" : "Check context";
  }
  let narration = phase.text;
  if (phase.at >= 6500) {
    demo.dataset.verdict = verdict.decision.toLowerCase();
    $(".result-placeholder").hidden = true;
    $(".verdict").hidden = false;
    $("#decision").textContent = verdict.decision;
    $("#reason").textContent = verdict.reason;
    $("#suggestion").textContent = verdict.suggestion;
    $("#matched-rule").textContent =
      `${verdict.matchedRule.id} · ${verdict.matchedRule.pack} v${verdict.matchedRule.version}`;
    $("#result-json").textContent = JSON.stringify(verdict, null, 2);
    $("#gate-status").textContent = "Policy decision returned";
    $("#gate-bottom").textContent = "Module remains structurally valid";
    nodes[4].querySelector(".node-status").textContent = verdict.decision;
    const blocked = verdict.decision === "BLOCK";
    const passed = verdict.decision === "PASS";
    nodes[5].querySelector(".node-status").textContent = blocked
      ? "Stopped · not called"
      : passed
        ? "Eligible · simulated"
        : "Held · needs review";
    $("#execution-status").textContent = blocked
      ? "execute() stopped — no action executed"
      : passed
        ? "PASS eligible — demo does not execute"
        : "execute() held — review required";
    narration = blocked
      ? "BLOCK. The module is still valid. StoreGate stops this sensitive action before execute()."
      : passed
        ? "PASS under the matched rule. The host could dispatch this exact action; the demo never executes it."
        : "REVIEW. The module is still valid. StoreGate holds execution for a narrower action or human review.";
    if (phase.at >= 8000)
      narration = `${verdict.decision}. ${verdict.suggestion} No sensitive action is executed.`;
  }
  $("#narration").textContent = narration;
  followStage(phase.target);
}

function tick(now) {
  const elapsed = Math.min(now - startedAt, DEMO_DURATION);
  applyPhase(phases.findLast((phase) => elapsed >= phase.at));
  $("#elapsed").textContent = String(Math.floor(elapsed / 1000)).padStart(
    2,
    "0",
  );
  $("#timeline-fill").style.width = `${(elapsed / DEMO_DURATION) * 100}%`;
  $(".timeline").setAttribute(
    "aria-valuenow",
    String(Math.floor(elapsed / 1000)),
  );
  $(".reason-detail").classList.toggle("is-visible", elapsed >= 6800);
  $(".suggestion-detail").classList.toggle("is-visible", elapsed >= 8000);
  if (elapsed < DEMO_DURATION) frame = requestAnimationFrame(tick);
  else {
    frame = null;
    run.disabled = false;
    run.querySelector("span").textContent = "Run again";
  }
}

run.addEventListener("click", () => {
  if (frame !== null || !validation.valid) return;
  resetPlayback();
  verdict = evaluate({ action: normalized, context: runtimeContext });
  run.disabled = true;
  reset.disabled = false;
  run.querySelector("span").textContent = "Running…";
  followStage(".pipeline");
  startedAt = performance.now();
  tick(startedAt);
});
reset.addEventListener("click", () => {
  resetPlayback();
  run.focus({ preventScroll: true });
  followStage("#source-stage");
});
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => selectScenario(tab.dataset.scenario));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectScenario(tabs[next].dataset.scenario);
    tabs[next].focus({ preventScroll: true });
  });
}
$("#engine-version").textContent = ENGINE_VERSION;
$("#policy-version").textContent = POLICY_VERSION;
selectScenario(selected.id);
