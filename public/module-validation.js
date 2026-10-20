// Demo-only module shape check. The integrating host keeps its own validator.
// This does not implement StemJSON's schema or participate in policy decisions.
export function validateDemoModule(module) {
  const string = (value) =>
    typeof value === "string" && value.trim().length > 0;
  const errors = [];
  if (module?.kind !== "mobile_ui") errors.push("kind must be mobile_ui");
  if (!string(module?.title)) errors.push("title is required");
  if (!string(module?.buttonLabel)) errors.push("buttonLabel is required");
  if (!string(module?.action?.type)) errors.push("action.type is required");
  return { valid: errors.length === 0, errors };
}
