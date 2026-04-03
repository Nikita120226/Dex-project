/**
 * test_arbitrage.js
 * Uses already-deployed Sepolia contracts from addresses.json
 * Scenario 1: Profitable arbitrage (DEX1 rate 2.0, DEX2 rate 2.1)
 * Scenario 2: Failed arbitrage (no opportunity)
 */
const { ethers } = require("hardhat");
const addresses = require("../frontend/src/addresses.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("ARBITRAGE TEST SCENARIOS");
  console.log("Deployer:", deployer.address);
  console.log("=".repeat(60));

  const tokenA   = await ethers.getContractAt("Token",     addresses.tokenA);
  const tokenB   = await ethers.getContractAt("Token",     addresses.tokenB);
  const dex1     = await ethers.getContractAt("DEX",       addresses.dex1);
  const dex2     = await ethers.getContractAt("DEX",       addresses.dex2);
  const arb      = await ethers.getContractAt("Arbitrage", addresses.arbitrage);

  // ── Show current state ────────────────────────────────────────────────────
  const [rA1, rB1] = await dex1.getReserves();
  const [rA2, rB2] = await dex2.getReserves();
  console.log("\nDEX1 reserves:", ethers.formatEther(rA1), "TKA :", ethers.formatEther(rB1), "TKB");
  console.log("DEX2 reserves:", ethers.formatEther(rA2), "TKA :", ethers.formatEther(rB2), "TKB");

  const sp1 = await dex1.spotPrice();
  const sp2 = await dex2.spotPrice();
  console.log("DEX1 spot price:", ethers.formatEther(sp1), "TKB/TKA");
  console.log("DEX2 spot price:", ethers.formatEther(sp2), "TKB/TKA");

  // ── SCENARIO 1: Check & Execute Profitable Arbitrage ─────────────────────
  console.log("\n" + "-".repeat(60));
  console.log("SCENARIO 1: Profitable Arbitrage");
  console.log("-".repeat(60));

  const capitalA = ethers.parseEther("10");

  // Check opportunity first (free view call)
  const [profitA, profitB] = await arb.checkOpportunity(capitalA, 0n);
  console.log("Estimated profit A->B->A:", ethers.formatEther(profitA), "TKA");
  console.log("Estimated profit B->A->B:", ethers.formatEther(profitB), "TKB");

  if (profitA > 0n) {
    // Fund arbitrage contract
    console.log("\nFunding arbitrage contract with 10 TKA...");
    await (await tokenA.transfer(addresses.arbitrage, capitalA)).wait();

    const balBefore = await tokenA.balanceOf(deployer.address);
    console.log("Deployer TKA before:", ethers.formatEther(balBefore));

    console.log("Executing arbitrage...");
    const tx = await arb.executeArbitrage(capitalA, 0n);
    const receipt = await tx.wait();
    console.log("Tx hash:", receipt.hash);

    const balAfter = await tokenA.balanceOf(deployer.address);
    console.log("Deployer TKA after:", ethers.formatEther(balAfter));

    if (balAfter > balBefore) {
      console.log("✅ PROFITABLE! Profit:", ethers.formatEther(balAfter - balBefore), "TKA");
    } else {
      console.log("❌ No profit this time (prices may have converged)");
    }
  } else {
    console.log("❌ No profitable opportunity detected");
    console.log("   Prices may already be equal — DEX2 needs reseeding with 2100 TKB");
  }

  // ── SCENARIO 2: Failed Arbitrage ─────────────────────────────────────────
  console.log("\n" + "-".repeat(60));
  console.log("SCENARIO 2: Failed Arbitrage (set minProfit very high)");
  console.log("-".repeat(60));

  // Set minimum profit threshold extremely high so it always fails
  console.log("Setting minProfit to 1000 TKA (impossible to achieve)...");
  await (await arb.setMinProfit(ethers.parseEther("1000"))).wait();

  const capitalA2 = ethers.parseEther("5");
  await (await tokenA.transfer(addresses.arbitrage, capitalA2)).wait();

  console.log("Executing arbitrage with impossible profit threshold...");
  const tx2 = await arb.executeArbitrage(capitalA2, 0n);
  const receipt2 = await tx2.wait();
  console.log("Tx hash:", receipt2.hash);

  // Check for ArbitrageFailed event
  const iface = arb.interface;
  const failEvents = receipt2.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .filter(e => e && e.name === "ArbitrageFailed");

  if (failEvents.length > 0) {
    console.log("FAILED:", failEvents[0].args[0]);
  } else {
    console.log("Transaction completed — no ArbitrageFailed event emitted");
  }

  // Reset minProfit back to normal
  await (await arb.setMinProfit(ethers.parseEther("0.001"))).wait();
  console.log("\nminProfit reset to 0.001 TKA");

  console.log("\n" + "=".repeat(60));
  console.log("=".repeat(60));
}

main().catch(console.error);