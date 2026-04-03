const { ethers } = require("hardhat");
const addresses = require("../frontend/src/addresses.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding with:", deployer.address);

  const tokenA = await ethers.getContractAt("Token", addresses.tokenA);
  const tokenB = await ethers.getContractAt("Token", addresses.tokenB);
  const dex1   = await ethers.getContractAt("DEX",   addresses.dex1);
  const dex2   = await ethers.getContractAt("DEX",   addresses.dex2);

  const [rA] = await dex1.getReserves();
  console.log("Current DEX1 Reserve A:", ethers.formatEther(rA), "TKA");

  // =========================
  // ✅ SEED DEX1
  // =========================
  const amtA1 = ethers.parseEther("1000");   
  const amtB1 = ethers.parseEther("2000");   

  console.log("\n--- DEX1 INPUT ---");
  console.log("Amount A:", ethers.formatEther(amtA1));
  console.log("Amount B:", ethers.formatEther(amtB1));

  console.log("\nApproving TKA for DEX1...");
  await (await tokenA.approve(addresses.dex1, ethers.MaxUint256)).wait();

  console.log("Approving TKB for DEX1...");
  await (await tokenB.approve(addresses.dex1, ethers.MaxUint256)).wait();

  console.log("Adding liquidity to DEX1...");
  await (await dex1.addLiquidity(amtA1, amtB1)).wait();

  const [rA1, rB1] = await dex1.getReserves();
  console.log("✅ DEX1 seeded:", ethers.formatEther(rA1), "TKA :", ethers.formatEther(rB1), "TKB");

  // =========================
  // ✅ SEED DEX2 (DIFFERENT RATIO)
  // =========================
  const amtA2 = ethers.parseEther("1000");
  const amtB2 = ethers.parseEther("2100");   // slightly different for arbitrage

  console.log("\n--- DEX2 INPUT ---");
  console.log("Amount A:", ethers.formatEther(amtA2));
  console.log("Amount B:", ethers.formatEther(amtB2));

  console.log("\nApproving TKA for DEX2...");
  await (await tokenA.approve(addresses.dex2, ethers.MaxUint256)).wait();

  console.log("Approving TKB for DEX2...");
  await (await tokenB.approve(addresses.dex2, ethers.MaxUint256)).wait();

  console.log("Adding liquidity to DEX2...");
  await (await dex2.addLiquidity(amtA2, amtB2)).wait();

  const [rA2, rB2] = await dex2.getReserves();
  console.log("✅ DEX2 seeded:", ethers.formatEther(rA2), "TKA :", ethers.formatEther(rB2), "TKB");
}

main().catch(console.error);
