import { cp, lstat, mkdir, readFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_VERSION } from "../src/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist");
// Only remove this project's generated output; refuse a redirected directory.
if (dirname(output) !== resolve(root)) throw new Error("Unsafe build output.");
const existing = await lstat(output).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
if (existing?.isSymbolicLink())
  throw new Error("Refusing to replace a linked dist directory.");
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
if (pkg.version !== ENGINE_VERSION)
  throw new Error("Package and engine versions differ.");
const app = await readFile(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
if (!app.includes(`./engine/v${ENGINE_VERSION}/index.js`))
  throw new Error("Demo engine import is not pinned to this release.");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("../public/", import.meta.url), output, { recursive: true });
await cp(
  new URL("../src/", import.meta.url),
  resolve(output, "engine", `v${ENGINE_VERSION}`),
  { recursive: true },
);
console.log(
  `Built static StoreGate site with the shared v${ENGINE_VERSION} engine in dist/.`,
);
