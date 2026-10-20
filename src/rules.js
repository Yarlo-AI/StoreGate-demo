export function defineRules(pack, version, definitions) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(definitions).map(([key, rule]) => [
        key,
        Object.freeze({
          ...rule,
          matchedRule: Object.freeze({ id: rule.id, pack, version }),
        }),
      ]),
    ),
  );
}

export const coreRules = defineRules("core", "1.0.0", {
  input: {
    id: "SG-CORE-001",
    decision: "REVIEW",
    reason: "The evaluation request is not a supported data object.",
    suggestion:
      "Supply exactly { action, context } as plain data and keep execution on hold.",
  },
  action: {
    id: "SG-CORE-002",
    decision: "REVIEW",
    reason:
      "The action is missing required fields or contains ambiguous fields.",
    suggestion:
      "Validate and explicitly adapt one complete action before evaluating it again.",
  },
  unsupported: {
    id: "SG-CORE-003",
    decision: "REVIEW",
    reason: "The action type is outside the supported policy contract.",
    suggestion:
      "Add a reviewed adapter and policy rule; keep this action on hold.",
  },
  context: {
    id: "SG-CORE-004",
    decision: "REVIEW",
    reason: "Runtime context must be supplied as a plain data object.",
    suggestion:
      "Obtain trusted runtime context from the host application before execution.",
  },
});

export function catalog(name, version, rules) {
  return Object.freeze({
    name,
    version,
    rules: Object.freeze(
      Object.values(rules).map(({ id, decision, reason }) =>
        Object.freeze({ id, decision, description: reason }),
      ),
    ),
  });
}
