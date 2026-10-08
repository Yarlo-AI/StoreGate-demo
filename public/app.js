import {
  DEMO_ACTION,
  DEMO_CONTEXT,
  DEMO_DURATION,
  evaluateAction,
} from "./policy.js";

const $ = (selector) => document.querySelector(selector);
const demo = $(".demo");
const run = $("#run");
const reset = $("#reset");
const progress = $(".timeline");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let frame = null;
let startedAt = 0;
let activePhase = "idle";
let result = null;

const phases = [
  {
    at: 0,
    name: "intercept",
    step: 0,
    narration:
      "The generated “Continue” button requests an external checkout. StoreGate intercepts it.",
    source: "Action captured before execution.",
    gate: "Awaiting the action",
    bottom: "Execution is held at the boundary.",
  },
  {
    at: 2200,
    name: "inspect",
    step: 1,
    narration:
      "StoreGate reads the structured action and its runtime context: iOS, DE, no entitlement.",
    source: "Intercepted. Checkout has not opened.",
    gate: "Inspecting runtime context",
    bottom: "Action + context under inspection.",
    target: "#gate-stage",
  },
  {
    at: 5200,
    name: "enforce",
    step: 2,
    narration:
      "An external digital purchase matches this demo’s blocking rule. The action stays at the gate.",
    source: "Intercepted. Checkout has not opened.",
    gate: "Applying the demo policy",
    bottom: "Sensitive purchase rule matched.",
  },
  {
    at: 8000,
    name: "verdict",
    step: 3,
    narration:
      "BLOCK. The external checkout is stopped before execution. A safer purchase flow is suggested.",
    source: "Intercepted. Checkout has not opened.",
    gate: "Policy enforced",
    bottom: "Action stopped at the boundary.",
    target: "#result-stage",
  },
  {
    at: DEMO_DURATION,
    name: "complete",
    step: 3,
    narration:
      "The button looked harmless. StoreGate checked the action — and kept it from executing.",
    source: "Intercepted. Checkout has not opened.",
    gate: "Policy enforced",
    bottom: "Action stopped at the boundary.",
  },
];

function followStage(selector) {
  if (
    selector &&
    matchMedia("(max-width: 800px)").matches &&
    !reducedMotion.matches
  ) {
    $(selector).scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setPhase(phase) {
  if (phase.name === activePhase) return;
  activePhase = phase.name;
  demo.dataset.phase = phase.name;
  $("#narration").textContent = phase.narration;
  $("#source-status").textContent = phase.source;
  $("#gate-status").textContent = phase.gate;
  $("#gate-bottom").textContent = phase.bottom;
  document.querySelectorAll("[data-step]").forEach((step, index) => {
    step.classList.toggle("current", index === phase.step);
    step.classList.toggle(
      "done",
      index < phase.step || phase.name === "complete",
    );
  });
  if (phase.name === "verdict" || phase.name === "complete") {
    $(".result-placeholder").hidden = true;
    $(".verdict").hidden = false;
    $("#decision").textContent = result.decision;
    $("#reason").textContent = result.reason;
    $("#result-context").textContent = result.context;
    $("#suggestion").textContent = result.suggestion;
    $("#result-status").textContent = "Blocked before execution";
  }
  followStage(phase.target);
}

function tick(now) {
  const elapsed = Math.min(now - startedAt, DEMO_DURATION);
  setPhase(phases.findLast((phase) => elapsed >= phase.at));
  $("#elapsed").textContent = String(Math.floor(elapsed / 1000)).padStart(
    2,
    "0",
  );
  $("#timeline-fill").style.width = `${(elapsed / DEMO_DURATION) * 100}%`;
  progress.setAttribute("aria-valuenow", String(Math.floor(elapsed / 1000)));
  $(".reason-detail").classList.toggle("is-visible", elapsed >= 8300);
  $(".context-detail").classList.toggle("is-visible", elapsed >= 9400);
  $(".suggestion-detail").classList.toggle("is-visible", elapsed >= 10_500);
  if (elapsed < DEMO_DURATION) {
    frame = requestAnimationFrame(tick);
  } else {
    frame = null;
    run.disabled = false;
    run.querySelector("span").textContent = "Run again";
    $("#playback-label").textContent = "Action protected";
    demo.setAttribute("aria-busy", "false");
  }
}

function clearDemo() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  activePhase = "idle";
  result = null;
  demo.dataset.phase = "idle";
  demo.setAttribute("aria-busy", "false");
  run.disabled = false;
  reset.disabled = true;
  run.querySelector("span").textContent = "Run StoreGate";
  $("#playback-label").textContent = "12-second walkthrough";
  $("#elapsed").textContent = "00";
  $("#timeline-fill").style.width = "0%";
  progress.setAttribute("aria-valuenow", "0");
  $("#source-status").textContent = "Generated UI. Unevaluated action.";
  $("#gate-status").textContent = "Ready to inspect";
  $("#gate-bottom").textContent = "Check the action. Apply the rule.";
  $("#result-status").textContent = "Waiting for policy evaluation";
  $("#narration").textContent =
    "A generated interface is only the surface. Run the demo to inspect the action.";
  $(".result-placeholder").hidden = false;
  $(".verdict").hidden = true;
  document
    .querySelectorAll(".verdict-detail")
    .forEach((detail) => detail.classList.remove("is-visible"));
  document.querySelectorAll("[data-step]").forEach((step, index) => {
    step.classList.toggle("current", index === 0);
    step.classList.remove("done");
  });
}

run.addEventListener("click", () => {
  if (frame !== null) return;
  clearDemo();
  // Evaluate local structured data only. There is intentionally no URL execution path.
  result = evaluateAction(DEMO_ACTION, DEMO_CONTEXT);
  run.disabled = true;
  reset.disabled = false;
  run.querySelector("span").textContent = "Running check…";
  $("#playback-label").textContent = "Runtime check in progress";
  // The live narration remains available while the visual panels update.
  followStage("#source-stage");
  startedAt = performance.now();
  tick(startedAt);
});

reset.addEventListener("click", () => {
  clearDemo();
  run.focus({ preventScroll: true });
  followStage("#source-stage");
});
