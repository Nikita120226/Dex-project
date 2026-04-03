/**
 * simulate.js
 * Runs the DEX simulation: 5 LPs + 8 traders, 75 random transactions.
 * Outputs metrics to simulate_results.json for plotting.
 * Run: npx hardhat run scripts/simulate.js --network localhost
 */
const { ethers } = require("hardhat");
const fs = require("fs");

const N = 75; // Number of transactions (∈ [50,100])

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // ── Deploy fresh contracts ────────────────────────────────────────────────
  const Token = await ethers.getContractFactory("Token");
  const tokenA = await Token.deploy("Token A", "TKA", 10_000_000, deployer.address);
  const tokenB = await Token.deploy("Token B", "TKB", 10_000_000, deployer.address);
  await tokenA.waitForDeployment();
  await tokenB.waitForDeployment();

  const DEX = await ethers.getContractFactory("DEX");
  const dex = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
  await dex.waitForDeployment();

  const addrA = await tokenA.getAddress();
  const addrB = await tokenB.getAddress();
  const addrDex = await dex.getAddress();
  const lpToken = await ethers.getContractAt("LPToken", await dex.lpToken());

  // ── Setup users ──────────────────────────────────────────────────────────
  const LPS     = signers.slice(1, 6);  // 5 LP providers
  const TRADERS = signers.slice(6, 14); // 8 traders

  const INITIAL_TOKENS = ethers.parseEther("10000");

  // Fund all users
  for (const user of [...LPS, ...TRADERS]) {
    await tokenA.mint(user.address, INITIAL_TOKENS);
    await tokenB.mint(user.address, INITIAL_TOKENS);
    await tokenA.connect(user).approve(addrDex, ethers.MaxUint256);
    await tokenB.connect(user).approve(addrDex, ethers.MaxUint256);
  }

  // ── First LP seeds the pool (required before ratio enforcement) ──────────
  const seedA = ethers.parseEther("1000");
  const seedB = ethers.parseEther("2000");
  await tokenA.connect(LPS[0]).approve(addrDex, ethers.MaxUint256);
  await tokenB.connect(LPS[0]).approve(addrDex, ethers.MaxUint256);
  await dex.connect(LPS[0]).addLiquidity(seedA, seedB);
  console.log("Pool seeded with 1000 TKA : 2000 TKB");

  // ── Metric arrays ────────────────────────────────────────────────────────
  const metrics = {
    tx:         [],
    tvl:        [],
    reserveA:   [],
    reserveB:   [],
    ratio:      [],
    spotPrice:  [],
    swapVolA:   [],
    swapVolB:   [],
    totalFees:  [],
    slippage:   [],
    lpHoldings: LPS.map(() => []),
  };

  let cumulativeVolA = 0n;
  let cumulativeVolB = 0n;
  let cumulativeFees = 0n;

  // Helper: random bigint in [0, max]
  function randBig(max) {
    if (max <= 0n) return 0n;
    return BigInt(Math.floor(Math.random() * Number(max / BigInt(1e14)))) * BigInt(1e14);
  }

  async function snapshot(txIndex) {
    const [rA, rB] = await dex.getReserves();
    const sp = rA > 0n ? (rB * BigInt(1e18)) / rA : 0n;
    const ratio = rB > 0n ? (rA * BigInt(1e18)) / rB : 0n;
    // TVL in TokenA units: rA + rB / spotPrice
    const tvl = rA + (rB * BigInt(1e18)) / (sp > 0n ? sp : BigInt(1e18));

    metrics.tx.push(txIndex);
    metrics.tvl.push(Number(ethers.formatEther(tvl)));
    metrics.reserveA.push(Number(ethers.formatEther(rA)));
    metrics.reserveB.push(Number(ethers.formatEther(rB)));
    metrics.ratio.push(Number(ethers.formatEther(ratio)));
    metrics.spotPrice.push(Number(ethers.formatEther(sp)));
    metrics.swapVolA.push(Number(ethers.formatEther(cumulativeVolA)));
    metrics.swapVolB.push(Number(ethers.formatEther(cumulativeVolB)));
    metrics.totalFees.push(Number(ethers.formatEther(cumulativeFees)));

    for (let i = 0; i < LPS.length; i++) {
      const bal = await lpToken.balanceOf(LPS[i].address);
      metrics.lpHoldings[i].push(Number(ethers.formatEther(bal)));
    }
  }

  await snapshot(0);

  // ── Main simulation loop ─────────────────────────────────────────────────
  const ALL_USERS = [...LPS, ...TRADERS];
  let lastSlippage = 0;

  for (let t = 1; t <= N; t++) {
    const user = ALL_USERS[Math.floor(Math.random() * ALL_USERS.length)];
    const isLP = LPS.includes(user);
    const txType = isLP
      ? Math.random() < 0.5 ? "addLiquidity" : "removeLiquidity"
      : Math.random() < 0.5 ? "swapAtoB" : "swapBtoA";

    try {
      if (txType === "addLiquidity") {
        const [rA, rB] = await dex.getReserves();
        const balA = await tokenA.balanceOf(user.address);
        const maxA = balA > rA / 10n ? rA / 10n : balA;
        const depositA = randBig(maxA);
        if (depositA < BigInt(1e15)) { metrics.slippage.push(lastSlippage); await snapshot(t); continue; }
        const depositB = (depositA * rB) / rA;
        const balB = await tokenB.balanceOf(user.address);
        if (depositB > balB || depositB < BigInt(1e15)) { metrics.slippage.push(lastSlippage); await snapshot(t); continue; }
        await dex.connect(user).addLiquidity(depositA, depositB);
        console.log(`  T${t} addLiquidity: ${ethers.formatEther(depositA)} TKA by ${user.address.slice(0,8)}`);

      } else if (txType === "removeLiquidity") {
        const lpBal = await lpToken.balanceOf(user.address);
        if (lpBal === 0n) { metrics.slippage.push(lastSlippage); await snapshot(t); continue; }
        // LP tokens are not approved to DEX directly — the DEX burns them from msg.sender
        const burnAmt = randBig(lpBal);
        if (burnAmt < BigInt(1e15)) { metrics.slippage.push(lastSlippage); await snapshot(t); continue; }
        await dex.connect(user).removeLiquidity(burnAmt);
        console.log(`  T${t} removeLiquidity: ${ethers.formatEther(burnAmt)} LPT by ${user.address.slice(0,8)}`);

      } else if (txType === "swapAtoB") {
        const [rA, rB] = await dex.getReserves();
        const balA = await tokenA.balanceOf(user.address);
        const maxSwap = balA < rA / 10n ? balA : rA / 10n;
        const amtIn = randBig(maxSwap);
        if (amtIn < BigInt(1e15)) { metrics.slippage.push(lastSlippage); await snapshot(t); continue; }

        const expectedOut = (rB * amtIn * 997n) / (rA * 1000n + amtIn * 997n);
        const expectedPrice = (rB * BigInt(1e18)) / rA; // price B/A before swap

        await dex.connect(user).swapAForB(amtIn, 0n);

        const actualPrice = (expectedOut * BigInt(1e18)) / amtIn;
        const slip = Number((actualPrice - expectedPrice) * 10000n / expectedPrice) / 100;
        lastSlippage = slip;
        cumulativeVolA += amtIn;
        cumulativeFees += (amtIn * 3n) / 1000n;
        console.log(`  T${t} swapAtoB: ${ethers.formatEther(amtIn)} TKA, slip=${slip.toFixed(2)}%`);

      } else if (txType === "swapBtoA") {
        const [rA, rB] = await dex.getReserves();
        const balB = await tokenB.balanceOf(user.address);
        const maxSwap = balB < rB / 10n ? balB : rB / 10n;
        const amtIn = randBig(maxSwap);
        if (amtIn < BigInt(1e15)) { metrics.slippage.push(lastSlippage); await snapshot(t); continue; }

        const expectedOut = (rA * amtIn * 997n) / (rB * 1000n + amtIn * 997n);
        const expectedPrice = (rA * BigInt(1e18)) / rB;

        await dex.connect(user).swapBForA(amtIn, 0n);

        const actualPrice = (expectedOut * BigInt(1e18)) / amtIn;
        const slip = Number((actualPrice - expectedPrice) * 10000n / expectedPrice) / 100;
        lastSlippage = slip;
        cumulativeVolB += amtIn;
        cumulativeFees += (amtIn * 3n) / 1000n;
        console.log(`  T${t} swapBtoA: ${ethers.formatEther(amtIn)} TKB, slip=${slip.toFixed(2)}%`);
      }
    } catch (e) {
      console.log(`  T${t} [SKIP] ${txType}: ${e.message.slice(0, 60)}`);
    }

    metrics.slippage.push(lastSlippage);
    await snapshot(t);
  }

  fs.writeFileSync("./simulate_results.json", JSON.stringify(metrics, null, 2));
  console.log("\n✅ Simulation complete. Results saved to simulate_results.json");
  console.log(`   Final reserves: ${metrics.reserveA.at(-1).toFixed(2)} TKA / ${metrics.reserveB.at(-1).toFixed(2)} TKB`);
  console.log(`   Total swap vol: ${metrics.swapVolA.at(-1).toFixed(2)} TKA, ${metrics.swapVolB.at(-1).toFixed(2)} TKB`);
  console.log(`   Total fees: ${metrics.totalFees.at(-1).toFixed(4)} tokens`);
}

main().catch((e) => { console.error(e); process.exit(1); });
