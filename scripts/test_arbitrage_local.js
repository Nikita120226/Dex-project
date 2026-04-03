/**
 * test_arbitrage.js
 * Demonstrates profitable and failed arbitrage scenarios.
 * Run: npx hardhat run scripts/test_arbitrage.js --network localhost
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer, trader] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("ARBITRAGE TEST SCENARIOS");
  console.log("=".repeat(60));

  // ── Deploy tokens ────────────────────────────────────────────────────────
  const Token = await ethers.getContractFactory("Token");
  const tokenA = await Token.deploy("Token A", "TKA", 10_000_000, deployer.address);
  const tokenB = await Token.deploy("Token B", "TKB", 10_000_000, deployer.address);
  await tokenA.waitForDeployment();
  await tokenB.waitForDeployment();
  const addrA = await tokenA.getAddress();
  const addrB = await tokenB.getAddress();

  // ── Deploy two DEXes ─────────────────────────────────────────────────────
  const DEX = await ethers.getContractFactory("DEX");
  const dex1 = await DEX.deploy(addrA, addrB);
  const dex2 = await DEX.deploy(addrA, addrB);
  await dex1.waitForDeployment();
  await dex2.waitForDeployment();
  const addrDex1 = await dex1.getAddress();
  const addrDex2 = await dex2.getAddress();

  // ── Scenario 1: PROFITABLE ARBITRAGE ─────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("SCENARIO 1: Profitable Arbitrage");
  console.log("─".repeat(60));

  // DEX1: 1000 A : 2000 B  (price = 2.0 B/A)
  // DEX2: 1000 A : 2100 B  (price = 2.1 B/A)  ← cheaper A here
  console.log("DEX1: 1000 TKA : 2000 TKB  (rate = 2.0 B/A)");
  console.log("DEX2: 1000 TKA : 2100 TKB  (rate = 2.1 B/A)");

  await tokenA.approve(addrDex1, ethers.MaxUint256);
  await tokenB.approve(addrDex1, ethers.MaxUint256);
  await tokenA.approve(addrDex2, ethers.MaxUint256);
  await tokenB.approve(addrDex2, ethers.MaxUint256);

  await dex1.addLiquidity(ethers.parseEther("1000"), ethers.parseEther("2000"));
  await dex2.addLiquidity(ethers.parseEther("1000"), ethers.parseEther("2100"));

  // Deploy arbitrage
  const Arbitrage = await ethers.getContractFactory("Arbitrage");
  const arb = await Arbitrage.deploy(addrDex1, addrDex2, ethers.parseEther("0.001"));
  await arb.waitForDeployment();
  const addrArb = await arb.getAddress();

  // Fund arbitrage contract with capital
  const capitalA = ethers.parseEther("10"); // 10 TKA
  await tokenA.transfer(addrArb, capitalA);
  await tokenA.approve(addrArb, ethers.MaxUint256);
  await tokenB.approve(addrArb, ethers.MaxUint256);

  // Grant DEX approvals from arbitrage contract perspective
  // (already done via safeApprove inside the contract)

  const balBefore = await tokenA.balanceOf(deployer.address);

  // Check opportunity first
  const [profitA_est, profitB_est] = await arb.checkOpportunity(capitalA, 0n);
  console.log(`\nEstimated profit (A->B->A): ${ethers.formatEther(profitA_est)} TKA`);

  try {
    const tx = await arb.executeArbitrage(capitalA, 0n);
    const receipt = await tx.wait();
    const balAfter = await tokenA.balanceOf(deployer.address);
    const profit = balAfter - balBefore;
    console.log(`\n✅ PROFITABLE ARBITRAGE EXECUTED`);
    console.log(`   Profit received: ${ethers.formatEther(profit)} TKA`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
  } catch (e) {
    console.log(`   [Note] ${e.message.slice(0, 120)}`);
  }

  // ── Scenario 2: FAILED ARBITRAGE (no opportunity) ────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("SCENARIO 2: Failed Arbitrage (same price on both DEXes)");
  console.log("─".repeat(60));

  const dex3 = await DEX.deploy(addrA, addrB);
  const dex4 = await DEX.deploy(addrA, addrB);
  await dex3.waitForDeployment();
  await dex4.waitForDeployment();

  // Same ratio on both
  await tokenA.approve(await dex3.getAddress(), ethers.MaxUint256);
  await tokenB.approve(await dex3.getAddress(), ethers.MaxUint256);
  await tokenA.approve(await dex4.getAddress(), ethers.MaxUint256);
  await tokenB.approve(await dex4.getAddress(), ethers.MaxUint256);

  await dex3.addLiquidity(ethers.parseEther("1000"), ethers.parseEther("2000"));
  await dex4.addLiquidity(ethers.parseEther("1000"), ethers.parseEther("2000")); // same!

  console.log("DEX3: 1000 TKA : 2000 TKB");
  console.log("DEX4: 1000 TKA : 2000 TKB  (identical to DEX3)");

  const arb2 = await Arbitrage.deploy(
    await dex3.getAddress(),
    await dex4.getAddress(),
    ethers.parseEther("0.001") // requires >0.001 TKA profit
  );
  await arb2.waitForDeployment();
  await tokenA.transfer(await arb2.getAddress(), ethers.parseEther("10"));

  const [p1, p2] = await arb2.checkOpportunity(ethers.parseEther("10"), 0n);
  console.log(`\nEstimated A->B->A profit: ${ethers.formatEther(p1)} TKA`);
  console.log(`Estimated B->A->B profit: ${ethers.formatEther(p2)} TKB`);

  const tx2 = await arb2.executeArbitrage(ethers.parseEther("10"), 0n);
  const receipt2 = await tx2.wait();

  // Check for ArbitrageFailed event
  const iface = arb2.interface;
  const failEvents = receipt2.logs
    .map(l => { try { return iface.parseLog(l); } catch { return null; } })
    .filter(e => e && e.name === "ArbitrageFailed");

  if (failEvents.length > 0) {
    console.log(`\n❌ ARBITRAGE CORRECTLY FAILED: "${failEvents[0].args[0]}"`);
  } else {
    console.log("\n❌ No profitable opportunity — transaction completed with no profit.");
  }

  console.log("\n" + "=".repeat(60));
  console.log("ARBITRAGE TESTS COMPLETE");
}

main().catch(e => { console.error(e); process.exit(1); });
