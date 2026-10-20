import { contextIssues } from "../contracts.js";
import { catalog, defineRules } from "../rules.js";

const version = "1.0.0";
const rules = defineRules("privacy", version, {
  context: {
    id: "SG-PRIV-001",
    decision: "REVIEW",
    reason: "Disclosure or consent context is missing or has an invalid type.",
    suggestion:
      "Obtain both disclosure and explicit consent states from the trusted host before execution.",
  },
  missingConsent: {
    id: "SG-PRIV-002",
    decision: "BLOCK",
    reason:
      "Personal data is about to be sent to a third-party AI provider without the required disclosure/consent state.",
    suggestion: "Insert disclosure + explicit consent before execution.",
  },
  approved: {
    id: "SG-PRIV-003",
    decision: "PASS",
    reason:
      "Disclosure and explicit consent are present for the modeled contacts-to-third-party-AI action.",
    suggestion:
      "Use the host's approved data-sharing executor for only the disclosed contact data.",
  },
  unsupported: {
    id: "SG-PRIV-004",
    decision: "REVIEW",
    reason:
      "This provider or data category is outside the modeled privacy policy.",
    suggestion:
      "Review the provider and data scope before allowing transmission.",
  },
});
export const privacyPack = catalog("privacy", version, rules);

export function checkPrivacy(action, context) {
  const issues = contextIssues(context, {
    consent_for_third_party_ai: "boolean",
    disclosure_present: "boolean",
  });
  if (issues.length) return { rule: rules.context, issues };
  if (action.provider !== "third_party_ai" || action.data !== "contacts")
    return { rule: rules.unsupported };
  return {
    rule:
      context.consent_for_third_party_ai && context.disclosure_present
        ? rules.approved
        : rules.missingConsent,
  };
}
