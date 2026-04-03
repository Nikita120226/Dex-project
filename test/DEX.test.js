const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX Full Test Suite", function () {
  let tokenA, tokenB, dex, lpToken;
  let owner, lp1, lp2, trader1, trader2;

  const INITIAL = ethers.parseEther("100000");
  const e = (n) => ethers.parseEther(n.toString());

  beforeEach(async () => {
    [owner, lp1, lp2, trader1, trader2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    tokenA = await Token.deploy("Token A", "TKA", 1_000_000, owner.address);
    tokenB = await Token.deploy("Token B", "TKB", 1_000_000, owner.address);
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();

    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
    await dex.waitForDeployment();

    lpToken = await ethers.getContractAt("LPToken", await dex.lpToken());

    // Distribute tokens
    for (const user of [lp1, lp2, trader1, trader2]) {
      await tokenA.mint(user.address, INITIAL);
      await tokenB.mint(user.address, INITIAL);
      await tokenA.connect(user).approve(await dex.getAddress(), ethers.MaxUint256);
      await tokenB.connect(user).approve(await dex.getAddress(), ethers.MaxUint256);
    }
    await tokenA.approve(await dex.getAddress(), ethers.MaxUint256);
    await tokenB.approve(await dex.getAddress(), ethers.MaxUint256);
  });

  // ── Token Tests ─────────────────────────────────────────────────────────
  describe("Token (Task 1)", () => {
    it("should mint initial supply to owner", async () => {
      const bal = await tokenA.balanceOf(owner.address);
      expect(bal).to.be.gt(0n);
    });

    it("should transfer between users correctly", async () => {
      const amt = e(100);
      await tokenA.transfer(lp1.address, amt);
      expect(await tokenA.balanceOf(lp1.address)).to.equal(INITIAL + amt);
    });

    it("faucet gives 1000 tokens", async () => {
      const before = await tokenB.balanceOf(trader1.address);
      await tokenB.faucet(trader1.address);
      expect(await tokenB.balanceOf(trader1.address)).to.equal(before + e(1000));
    });
  });

  // ── LP Token Tests ───────────────────────────────────────────────────────
  describe("LPToken", () => {
    it("only DEX (owner) can mint LP tokens", async () => {
      await expect(lpToken.connect(lp1).mint(lp1.address, e(100)))
        .to.be.revertedWithCustomError(lpToken, "OwnableUnauthorizedAccount");
    });

    it("only DEX (owner) can burn LP tokens", async () => {
      await expect(lpToken.connect(lp1).burn(lp1.address, e(100)))
        .to.be.revertedWithCustomError(lpToken, "OwnableUnauthorizedAccount");
    });
  });

  // ── Liquidity Tests ──────────────────────────────────────────────────────
  describe("Add Liquidity (Task 2)", () => {
    it("first deposit sets ratio and mints LP tokens", async () => {
      await dex.addLiquidity(e(1000), e(2000));
      const lpBal = await lpToken.balanceOf(owner.address);
      expect(lpBal).to.be.gt(0n);
      const [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(e(1000));
      expect(rB).to.equal(e(2000));
    });

    it("second deposit must match ratio", async () => {
      await dex.connect(lp1).addLiquidity(e(1000), e(2000));
      // Correct ratio: 100:200
      await dex.connect(lp2).addLiquidity(e(100), e(200));
      expect(await lpToken.balanceOf(lp2.address)).to.be.gt(0n);
    });

    it("second deposit with wrong ratio reverts", async () => {
      await dex.connect(lp1).addLiquidity(e(1000), e(2000));
      await expect(dex.connect(lp2).addLiquidity(e(100), e(300)))
        .to.be.revertedWith("DEX: ratio mismatch");
    });

    it("LP tokens minted proportionally", async () => {
      await dex.connect(lp1).addLiquidity(e(1000), e(2000));
      const lp1Tokens = await lpToken.balanceOf(lp1.address);
      await dex.connect(lp2).addLiquidity(e(500), e(1000)); // 50% of lp1
      const lp2Tokens = await lpToken.balanceOf(lp2.address);
      // lp2 should get ~50% of lp1's tokens (approximately)
      const ratio = Number(lp2Tokens) / Number(lp1Tokens);
      expect(ratio).to.be.closeTo(0.5, 0.01);
    });

    it("reverts on zero amounts", async () => {
      await expect(dex.addLiquidity(0, e(100))).to.be.revertedWith("DEX: zero amount");
      await expect(dex.addLiquidity(e(100), 0)).to.be.revertedWith("DEX: zero amount");
    });
  });

  // ── Remove Liquidity Tests ───────────────────────────────────────────────
  describe("Remove Liquidity", () => {
    beforeEach(async () => {
      await dex.connect(lp1).addLiquidity(e(1000), e(2000));
    });

    it("burns LP tokens and returns proportional reserves", async () => {
      const lpBal = await lpToken.balanceOf(lp1.address);
      const aBalBefore = await tokenA.balanceOf(lp1.address);
      await dex.connect(lp1).removeLiquidity(lpBal / 2n);
      const aBalAfter = await tokenA.balanceOf(lp1.address);
      expect(aBalAfter).to.be.gt(aBalBefore);
    });

    it("reverts when burning more LP tokens than held", async () => {
      const lpBal = await lpToken.balanceOf(lp1.address);
      await expect(dex.connect(lp1).removeLiquidity(lpBal + e(1)))
        .to.be.reverted;
    });

    it("reverts on zero LP amount", async () => {
      await expect(dex.connect(lp1).removeLiquidity(0))
        .to.be.revertedWith("DEX: zero LP amount");
    });
  });

  // ── Swap Tests ───────────────────────────────────────────────────────────
  describe("Swaps (Task 2 AMM)", () => {
    beforeEach(async () => {
      await dex.addLiquidity(e(1000), e(2000));
    });

    it("swap A for B uses constant product formula", async () => {
      const [rA0, rB0] = await dex.getReserves();
      const amtIn = e(10);
      await dex.connect(trader1).swapAForB(amtIn, 0);
      const [rA1, rB1] = await dex.getReserves();
      // k increases slightly due to fees (fee stays in pool)
      expect(rA1 * rB1).to.be.gte(rA0 * rB0);
    });

    it("swap B for A uses constant product formula", async () => {
      const [rA0, rB0] = await dex.getReserves();
      await dex.connect(trader1).swapBForA(e(20), 0);
      const [rA1, rB1] = await dex.getReserves();
      expect(rA1 * rB1).to.be.gte(rA0 * rB0);
    });

    it("0.3% fee stays in pool (k increases)", async () => {
      const [rA0, rB0] = await dex.getReserves();
      const k0 = rA0 * rB0;
      await dex.connect(trader1).swapAForB(e(100), 0);
      const [rA1, rB1] = await dex.getReserves();
      expect(rA1 * rB1).to.be.gt(k0);
    });

    it("slippage protection reverts if output too low", async () => {
      const outPreview = await dex.getAmountOut_AtoB(e(10));
      const tooHigh = outPreview + e(100); // unreasonably high minimum
      await expect(dex.connect(trader1).swapAForB(e(10), tooHigh))
        .to.be.revertedWith("DEX: slippage exceeded");
    });

    it("reverts on zero swap input", async () => {
      await expect(dex.connect(trader1).swapAForB(0, 0))
        .to.be.revertedWith("DEX: zero input");
    });

    it("spot price reflects current reserves", async () => {
      // Initial: 1000 A, 2000 B → spot = 2000/1000 = 2.0 (2e18)
      const sp = await dex.spotPrice();
      expect(sp).to.be.closeTo(e(2), e(2) / 100n);
    });
  });

  // ── View Functions ───────────────────────────────────────────────────────
  describe("View Functions", () => {
    beforeEach(async () => {
      await dex.addLiquidity(e(1000), e(2000));
    });

    it("getReserves returns correct values", async () => {
      const [a, b] = await dex.getReserves();
      expect(a).to.equal(e(1000));
      expect(b).to.equal(e(2000));
    });

    it("spotPrice = reserveB/reserveA", async () => {
      const sp = await dex.spotPrice();
      expect(sp).to.be.closeTo(e(2), e(1) / 1000n);
    });

    it("priceOfBInA = reserveA/reserveB", async () => {
      const p = await dex.priceOfBInA();
      expect(p).to.be.closeTo(e("0.5"), e("0.5") / 1000n);
    });

    it("getAmountOut_AtoB preview matches actual swap", async () => {
      const preview = await dex.getAmountOut_AtoB(e(10));
      const balBefore = await tokenB.balanceOf(trader1.address);
      await dex.connect(trader1).swapAForB(e(10), 0);
      const balAfter = await tokenB.balanceOf(trader1.address);
      expect(balAfter - balBefore).to.equal(preview);
    });
  });

  // ── Arbitrage Tests (Task 3) ─────────────────────────────────────────────
  describe("Arbitrage (Task 3)", () => {
    let dex1, dex2, arb;

    beforeEach(async () => {
      const DEX = await ethers.getContractFactory("DEX");
      dex1 = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
      dex2 = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
      await dex1.waitForDeployment();
      await dex2.waitForDeployment();

      await tokenA.approve(await dex1.getAddress(), ethers.MaxUint256);
      await tokenB.approve(await dex1.getAddress(), ethers.MaxUint256);
      await tokenA.approve(await dex2.getAddress(), ethers.MaxUint256);
      await tokenB.approve(await dex2.getAddress(), ethers.MaxUint256);

      // Different ratios = arbitrage opportunity
      await dex1.addLiquidity(e(1000), e(2000));
      await dex2.addLiquidity(e(1000), e(2100));

      const Arbitrage = await ethers.getContractFactory("Arbitrage");
      arb = await Arbitrage.deploy(
        await dex1.getAddress(),
        await dex2.getAddress(),
        ethers.parseEther("0.001")
      );
      await arb.waitForDeployment();
      await tokenA.transfer(await arb.getAddress(), e(10));
    });

    it("detects profitable opportunity", async () => {
      const [profitA] = await arb.checkOpportunity(e(10), 0);
      expect(profitA).to.be.gt(0n);
    });

    it("fails when no opportunity (same prices)", async () => {
      const DEX = await ethers.getContractFactory("DEX");
      const d3 = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
      const d4 = await DEX.deploy(await tokenA.getAddress(), await tokenB.getAddress());
      await d3.waitForDeployment();
      await d4.waitForDeployment();
      await tokenA.approve(await d3.getAddress(), ethers.MaxUint256);
      await tokenB.approve(await d3.getAddress(), ethers.MaxUint256);
      await tokenA.approve(await d4.getAddress(), ethers.MaxUint256);
      await tokenB.approve(await d4.getAddress(), ethers.MaxUint256);
      await d3.addLiquidity(e(1000), e(2000));
      await d4.addLiquidity(e(1000), e(2000));

      const Arbitrage = await ethers.getContractFactory("Arbitrage");
      const arb2 = await Arbitrage.deploy(await d3.getAddress(), await d4.getAddress(), e(1));
      await arb2.waitForDeployment();
      await tokenA.transfer(await arb2.getAddress(), e(10));

      const [p1, p2] = await arb2.checkOpportunity(e(10), 0);
      expect(p1).to.equal(0n);
      expect(p2).to.equal(0n);
    });
  });

  // ── Example from Assignment ──────────────────────────────────────────────
  describe("Assignment Example Verification", () => {
    it("matches example in Table 2 (with 0.3% fee)", async () => {
      // Initial: 200 A, 300 B, 2 LPTs
      await dex.connect(lp1).addLiquidity(e(200), e(300));
      let [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(e(200));
      expect(rB).to.equal(e(300));

      // Add 100 A, 150 B → ratio preserved
      await dex.connect(lp2).addLiquidity(e(100), e(150));
      [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(e(300));
      expect(rB).to.equal(e(450));

      // Swap 50 A (0.3% fee) → expect ~63 B out
      const bOut = await dex.getAmountOut_AtoB(e(50));
      await dex.connect(trader1).swapAForB(e(50), 0);
      [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(e(350));
      console.log(`  Swap 50 A → ${ethers.formatEther(bOut)} B (expected ~63.18 with 2% fee in example)`);
    });
  });
});
