/**
 * export_abi.js
 * After compiling, run: node scripts/export_abi.js
 * Copies compiled ABIs to frontend/src/ for use in the UI.
 */
const fs   = require("fs");
const path = require("path");

const contracts = ["Token", "LPToken", "DEX", "Arbitrage"];
const outDir    = path.join(__dirname, "../frontend/src");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let abiExports = "// Auto-generated ABI file — do not edit manually\n\n";

for (const name of contracts) {
  const artifactPath = path.join(
    __dirname, `../artifacts/contracts/${name}.sol/${name}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    console.warn(`⚠ Artifact not found for ${name}. Run 'npx hardhat compile' first.`);
    continue;
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  abiExports += `window.${name.toUpperCase()}_ABI_FULL = ${JSON.stringify(artifact.abi, null, 2)};\n\n`;
  console.log(`✅ Exported ABI for ${name}`);
}

fs.writeFileSync(path.join(outDir, "abis_full.js"), abiExports);
console.log("Done. ABIs written to frontend/src/abis_full.js");
