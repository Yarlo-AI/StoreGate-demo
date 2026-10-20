import { pathToFileURL } from "node:url";
import { adaptStructuredAction, evaluate } from "storegate";

/**
 * Call only after your host's structural validator succeeds.
 * Context must come from trusted host state, never from the generated module.
 * This example executes nothing unless you explicitly provide an executor.
 */
export async function executeAfterValidation({ action, context, execute }) {
  const snapshot = structuredClone({ action, context });
  const adapted = adaptStructuredAction(snapshot.action);
  const result = evaluate({
    action: adapted.action,
    context: snapshot.context,
  });
  if (result.decision !== "PASS") {
    return { executed: false, result, adapterIssues: adapted.issues };
  }
  if (typeof execute !== "function")
    throw new TypeError("A host executor is required for PASS.");
  // No async gap between the check and dispatch. The executor receives the
  // evaluated canonical action, never a newer, mutable generated action.
  const value = await execute(structuredClone(result.normalizedAction));
  return { executed: true, result, adapterIssues: [], value };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const examples = [
    {
      action: {
        type: "open_url",
        target: "stripe_checkout",
        product: "digital_subscription",
      },
      context: {
        platform: "iOS",
        storefront: "DE",
        external_purchase_entitlement: false,
      },
    },
    {
      action: {
        type: "request_permission",
        target: "contacts_full_access",
        intent: "select_three_contacts",
      },
      context: { platform: "Android", narrower_picker_available: true },
    },
    {
      action: {
        type: "send_to_ai",
        provider: "third_party_ai",
        data: "contacts",
      },
      context: { consent_for_third_party_ai: true, disclosure_present: true },
    },
  ];
  for (const input of examples) {
    const outcome = await executeAfterValidation({
      ...input,
      execute: (action) => ({ simulated: true, type: action.type }),
    });
    console.log(JSON.stringify(outcome, null, 2));
  }
}
