const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // ── 1. Deploy TokenA and TokenB ─────────────────────────────────────────
  console.log("1. Deploying TokenA...");
  const Token = await ethers.getContractFactory("Token");
  const tokenA = await Token.deploy("Token A", "TKA", 1_000_000, deployer.address);
  await tokenA.waitForDeployment();
  console.log("   TokenA deployed:", await tokenA.getAddress());

  console.log("2. Deploying TokenB...");
  const tokenB = await Token.deploy("Token B", "TKB", 1_000_000, deployer.address);
  await tokenB.waitForDeployment();
  console.log("   TokenB deployed:", await tokenB.getAddress());

  // ── 2. Deploy DEX1 ───────────────────────────────────────────────────────
  console.log("3. Deploying DEX1...");
  const DEX = await ethers.getContractFactory("DEX");
  const dex1 = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
  await dex1.waitForDeployment();
  console.log("   DEX1 deployed:", await dex1.getAddress());
  console.log("   LPToken1 deployed:", await dex1.lpToken());

  // ── 3. Deploy DEX2 (for arbitrage) ───────────────────────────────────────
  console.log("4. Deploying DEX2 (for arbitrage demo)...");
  const dex2 = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
  await dex2.waitForDeployment();
  console.log("   DEX2 deployed:", await dex2.getAddress());
  console.log("   LPToken2 deployed:", await dex2.lpToken());

  // ── 4. Deploy Arbitrage Contract ─────────────────────────────────────────
  console.log("5. Deploying Arbitrage contract...");
  const Arbitrage = await ethers.getContractFactory("Arbitrage");
  const minProfit = ethers.parseEther("0.01"); // 0.01 token min profit
  const arbitrage = await Arbitrage.deploy(
    await dex1.getAddress(),
    await dex2.getAddress(),
    minProfit
  );
  await arbitrage.waitForDeployment();
  console.log("   Arbitrage deployed:", await arbitrage.getAddress());

  // ── 5. Seed liquidity in DEX1 ─────────────────────────────
  console.log("\n6. Seeding initial liquidity in DEX1 (1000 TKA : 2000 TKB)...");

  const seedA1 = ethers.parseEther("1000");  
  const seedB1 = ethers.parseEther("2000");  

  await (await tokenA.approve(dex1.target, seedA1)).wait();
  await (await tokenB.approve(dex1.target, seedB1)).wait();

  await (await dex1.addLiquidity(seedA1, seedB1)).wait();
  console.log("   DEX1 seeded.");


  // ── 6. Seed DEX2 ─────────────────────────────────────────
  console.log("7. Seeding DEX2 with different ratio (1000 TKA : 2100 TKB) for arbitrage...");

  const seedA2 = ethers.parseEther("1000");  
  const seedB2 = ethers.parseEther("2100");  

  await (await tokenA.approve(dex2.target, seedA2)).wait();
  await (await tokenB.approve(dex2.target, seedB2)).wait();

  await (await dex2.addLiquidity(seedA2, seedB2)).wait();
  console.log("   DEX2 seeded.");


  // ── 7. Save addresses to JSON for frontend ───────────────────────────────
  const addresses = {
    tokenA:    await tokenA.getAddress(),
    tokenB:    await tokenB.getAddress(),
    dex1:      await dex1.getAddress(),
    dex2:      await dex2.getAddress(),
    lpToken1:  await dex1.lpToken(),
    lpToken2:  await dex2.lpToken(),
    arbitrage: await arbitrage.getAddress(),
    deployer:  deployer.address,
    network:   (await ethers.provider.getNetwork()).name,
  };

  fs.writeFileSync(
    "./frontend/src/addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ All contracts deployed! Addresses saved to frontend/src/addresses.json");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
