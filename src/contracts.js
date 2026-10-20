// This boundary accepts data records, not instances, accessors, or executable code.
export function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (entry) => "value" in entry,
    )
  );
}

export const issue = (field, code, message) => ({ field, code, message });
const string = (value) => typeof value === "string" && value.trim().length > 0;
const fieldsByType = Object.freeze({
  OPEN_EXTERNAL_URL: ["target", "product"],
  PURCHASE: ["target", "product", "channel"],
  SEND_TO_THIRD_PARTY_AI: ["provider", "data"],
  REQUEST_PERMISSION: ["target", "intent"],
});

export function checkAction(value) {
  if (!isRecord(value))
    return {
      action: null,
      issues: [
        issue("action", "invalid_type", "Expected a plain action object."),
      ],
    };
  if (!Object.hasOwn(value, "type") || !string(value.type)) {
    return {
      action: null,
      issues: [
        issue("action.type", "required", "A nonempty action type is required."),
      ],
    };
  }
  if (!Object.hasOwn(fieldsByType, value.type)) {
    return {
      action: null,
      issues: [
        issue(
          "action.type",
          "unsupported",
          "This action type is not supported.",
        ),
      ],
    };
  }
  const fields = fieldsByType[value.type];
  const issues = Object.keys(value)
    .filter((key) => key !== "type" && !fields.includes(key))
    .map((key) =>
      issue(
        `action.${key}`,
        "unknown_field",
        "Unexpected action field; adapt it explicitly.",
      ),
    );
  for (const field of fields) {
    if (!Object.hasOwn(value, field) || !string(value[field])) {
      issues.push(
        issue(`action.${field}`, "required", "Expected a nonempty string."),
      );
    }
  }
  if (
    value.type === "PURCHASE" &&
    string(value.channel) &&
    !["external", "in_app"].includes(value.channel)
  ) {
    issues.push(
      issue("action.channel", "unsupported", "Expected external or in_app."),
    );
  }
  return {
    action: issues.length
      ? null
      : Object.fromEntries(["type", ...fields].map((key) => [key, value[key]])),
    issues,
  };
}

export function contextIssues(context, fields) {
  return Object.entries(fields).flatMap(([field, type]) =>
    Object.hasOwn(context, field) &&
    (type === "boolean"
      ? typeof context[field] === "boolean"
      : string(context[field]))
      ? []
      : [
          issue(
            `context.${field}`,
            "required",
            `Expected ${type === "boolean" ? "a boolean" : "a nonempty string"}.`,
          ),
        ],
  );
}

export function categoriesFor(action) {
  if (!action) return [];
  if (action.type === "OPEN_EXTERNAL_URL") {
    return action.product === "digital_subscription"
      ? ["OPEN_EXTERNAL_URL", "PURCHASE"]
      : ["OPEN_EXTERNAL_URL"];
  }
  if (action.type === "PURCHASE") {
    return action.channel === "external"
      ? ["PURCHASE", "OPEN_EXTERNAL_URL"]
      : ["PURCHASE"];
  }
  if (action.type === "SEND_TO_THIRD_PARTY_AI") {
    return action.data === "contacts"
      ? ["SEND_TO_THIRD_PARTY_AI", "SHARE_PERSONAL_DATA", "ACCESS_CONTACTS"]
      : ["SEND_TO_THIRD_PARTY_AI"];
  }
  return action.target === "contacts_full_access" ||
    action.target === "contacts_picker"
    ? ["REQUEST_PERMISSION", "ACCESS_CONTACTS"]
    : ["REQUEST_PERMISSION"];
}
