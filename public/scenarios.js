// Fixed fixtures illustrating the intended integration, not StemJSON's wire format.
export const SCENARIOS = [
  {
    id: "purchase",
    name: "External digital purchase",
    prompt: "Add a Continue button to start a digital subscription.",
    raw: "open_url(stripe_checkout)",
    metadata: "product = digital_subscription",
    module: {
      kind: "mobile_ui",
      title: "Your next chapter",
      buttonLabel: "Continue",
      action: {
        type: "open_url",
        target: "stripe_checkout",
        product: "digital_subscription",
      },
    },
    context: {
      platform: "iOS",
      storefront: "DE",
      external_purchase_entitlement: false,
    },
    ruleNote:
      "Illustrative store-policy rule. Not a prediction of Apple review.",
  },
  {
    id: "data",
    name: "Personal data to third-party AI",
    prompt: "Use AI to help organize my contacts.",
    raw: "send_to_ai(provider = third_party_ai)",
    metadata: "data = contacts",
    module: {
      kind: "mobile_ui",
      title: "Organize your contacts",
      buttonLabel: "Continue",
      action: {
        type: "send_to_ai",
        provider: "third_party_ai",
        data: "contacts",
      },
    },
    context: { consent_for_third_party_ai: false, disclosure_present: false },
    ruleNote:
      "Illustrative privacy rule. No contact data is read or transmitted.",
  },
  {
    id: "permission",
    name: "Broad permission request",
    prompt: "Let me select three contacts to invite.",
    raw: "request_permission(contacts_full_access)",
    metadata: "intent = select_three_contacts",
    module: {
      kind: "mobile_ui",
      title: "Invite three people",
      buttonLabel: "Continue",
      action: {
        type: "request_permission",
        target: "contacts_full_access",
        intent: "select_three_contacts",
      },
    },
    context: { platform: "Android", narrower_picker_available: true },
    ruleNote:
      "Illustrative least-access rule. No device permission is requested.",
  },
];
