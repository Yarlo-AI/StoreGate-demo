import { contextIssues } from "../contracts.js";
import { catalog, defineRules } from "../rules.js";

const version = "1.0.0";
const rules = defineRules("permissions", version, {
  context: {
    id: "SG-PERM-001",
    decision: "REVIEW",
    reason:
      "Required permission runtime context is missing or has an invalid type.",
    suggestion:
      "Supply the platform and availability of a narrower picker before execution.",
  },
  broad: {
    id: "SG-PERM-002",
    decision: "REVIEW",
    reason:
      "Requested access appears broader than necessary for the stated intent.",
    suggestion: "Use a narrower contact picker or request human review.",
  },
  picker: {
    id: "SG-PERM-003",
    decision: "PASS",
    reason:
      "An available contact picker matches the stated intent to select three contacts.",
    suggestion:
      "Open the host's narrow contact picker and use only the selected contacts.",
  },
  unsupported: {
    id: "SG-PERM-004",
    decision: "REVIEW",
    reason:
      "This access request, intent, or runtime context is outside the modeled permission approvals.",
    suggestion: "Keep execution on hold and review the minimum access needed.",
  },
});
export const permissionsPack = catalog("permissions", version, rules);

export function checkPermissions(action, context) {
  const issues = contextIssues(context, {
    platform: "string",
    narrower_picker_available: "boolean",
  });
  if (issues.length) return { rule: rules.context, issues };
  if (
    context.platform !== "Android" ||
    action.intent !== "select_three_contacts"
  )
    return { rule: rules.unsupported };
  if (
    action.target === "contacts_full_access" &&
    context.narrower_picker_available
  )
    return { rule: rules.broad };
  if (action.target === "contacts_picker" && context.narrower_picker_available)
    return { rule: rules.picker };
  return { rule: rules.unsupported };
}
