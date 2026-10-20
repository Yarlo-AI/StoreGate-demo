export { evaluate } from "./engine.js";
export { adaptStructuredAction } from "./adapter.js";
export { ENGINE_VERSION, POLICY_VERSION } from "./versions.js";
import { catalog, coreRules } from "./rules.js";
import { paymentsPack } from "./packs/payments.js";
import { privacyPack } from "./packs/privacy.js";
import { permissionsPack } from "./packs/permissions.js";

// Read-only discovery metadata. Packs cannot be disabled through evaluation input.
export const POLICY_PACKS = Object.freeze([
  catalog("core", "1.0.0", coreRules),
  paymentsPack,
  privacyPack,
  permissionsPack,
]);
