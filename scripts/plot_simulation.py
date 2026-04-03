#!/usr/bin/env python3
"""
plot_simulation.py
Reads simulate_results.json and plots all required DEX metrics.
Usage: python3 scripts/plot_simulation.py
"""
import json, sys, os
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np

data_path = os.path.join(os.path.dirname(__file__), "..", "simulate_results.json")
if not os.path.exists(data_path):
    print("simulate_results.json not found. Run simulate.js first.")
    sys.exit(1)

with open(data_path) as f:
    d = json.load(f)

tx = d["tx"]
fig = plt.figure(figsize=(18, 22))
fig.suptitle("DEX Simulation Metrics", fontsize=20, fontweight="bold", y=0.98)
gs = gridspec.GridSpec(4, 2, figure=fig, hspace=0.45, wspace=0.35)

def ax(row, col, colspan=1):
    return fig.add_subplot(gs[row, col:col+colspan])

# ── 1. TVL ───────────────────────────────────────────────────────────────────
a1 = ax(0, 0)
a1.plot(tx, d["tvl"], color="#2196F3", linewidth=2)
a1.fill_between(tx, d["tvl"], alpha=0.15, color="#2196F3")
a1.set_title("Total Value Locked (TVL) in TokenA units")
a1.set_xlabel("Transaction #"); a1.set_ylabel("TVL (TKA)")
a1.grid(alpha=0.3)

# ── 2. Reserve Ratio ─────────────────────────────────────────────────────────
a2 = ax(0, 1)
a2.plot(tx, d["ratio"], color="#FF5722", linewidth=2)
a2.set_title("Reserve Ratio (TokenA / TokenB)")
a2.set_xlabel("Transaction #"); a2.set_ylabel("TKA / TKB")
a2.grid(alpha=0.3)

# ── 3. Reserves A & B ────────────────────────────────────────────────────────
a3 = ax(1, 0)
a3.plot(tx, d["reserveA"], label="Reserve A", color="#4CAF50", linewidth=2)
a3.plot(tx, d["reserveB"], label="Reserve B", color="#9C27B0", linewidth=2)
a3.set_title("Pool Reserves Over Time")
a3.set_xlabel("Transaction #"); a3.set_ylabel("Tokens")
a3.legend(); a3.grid(alpha=0.3)

# ── 4. LP Token Holdings ──────────────────────────────────────────────────────
a4 = ax(1, 1)
colors = ["#E91E63","#FF9800","#00BCD4","#8BC34A","#673AB7"]
for i, holdings in enumerate(d["lpHoldings"]):
    a4.plot(tx, holdings, label=f"LP{i+1}", color=colors[i], linewidth=1.8)
a4.set_title("LP Token Holdings Per Provider")
a4.set_xlabel("Transaction #"); a4.set_ylabel("LP Tokens")
a4.legend(fontsize=8); a4.grid(alpha=0.3)

# ── 5. Cumulative Swap Volume ─────────────────────────────────────────────────
a5 = ax(2, 0)
a5.plot(tx, d["swapVolA"], label="TKA Volume", color="#2196F3", linewidth=2)
a5.plot(tx, d["swapVolB"], label="TKB Volume", color="#FF5722", linewidth=2)
a5.set_title("Cumulative Swap Volume")
a5.set_xlabel("Transaction #"); a5.set_ylabel("Tokens Swapped")
a5.legend(); a5.grid(alpha=0.3)

# ── 6. Fee Accumulation ───────────────────────────────────────────────────────
a6 = ax(2, 1)
a6.plot(tx, d["totalFees"], color="#FF9800", linewidth=2)
a6.fill_between(tx, d["totalFees"], alpha=0.2, color="#FF9800")
a6.set_title("Cumulative Fee Accumulation")
a6.set_xlabel("Transaction #"); a6.set_ylabel("Total Fees (tokens)")
a6.grid(alpha=0.3)

# ── 7. Spot Price ─────────────────────────────────────────────────────────────
a7 = ax(3, 0)
a7.plot(tx, d["spotPrice"], color="#009688", linewidth=2)
a7.set_title("Spot Price (TKB per TKA)")
a7.set_xlabel("Transaction #"); a7.set_ylabel("Price (TKB/TKA)")
a7.grid(alpha=0.3)

# ── 8. Slippage ───────────────────────────────────────────────────────────────
a8 = ax(3, 1)
slippage = [abs(s) for s in d["slippage"]]
tx_slip = tx[len(tx) - len(slippage):]
a8.bar(tx_slip, slippage, color="#F44336", alpha=0.7, width=0.8)
a8.set_title("Swap Slippage per Transaction")
a8.set_xlabel("Transaction #"); a8.set_ylabel("Slippage (%)")
a8.grid(alpha=0.3, axis='y')

# ── 9. Theory Q7: Slippage vs Trade Lot Fraction ─────────────────────────────
fig2, ax9 = plt.subplots(figsize=(9, 5))
fractions = np.linspace(0.001, 0.5, 500)
# Expected price = rB/rA, actual price = out/in
# out = rB * in * 0.997 / (rA + in*0.997)
# Slippage = (actual - expected)/expected * 100
expected_price = 1.0  # normalized: rA=1, rB=1
slippage_theory = []
for f in fractions:
    amtIn = f  # fraction of rA
    amtInWithFee = amtIn * 0.997
    out = amtInWithFee / (1 + amtInWithFee)  # rB=1, rA=1
    actual_price = out / amtIn
    slip = (actual_price - expected_price) / expected_price * 100
    slippage_theory.append(abs(slip))

ax9.plot(fractions * 100, slippage_theory, color="#673AB7", linewidth=2.5)
ax9.fill_between(fractions * 100, slippage_theory, alpha=0.15, color="#673AB7")
ax9.set_title("Theory Q7: Slippage vs Trade Lot Fraction (Constant Product AMM)", fontsize=13)
ax9.set_xlabel("Trade Lot Fraction (% of Reserve X)")
ax9.set_ylabel("|Slippage| (%)")
ax9.grid(alpha=0.3)
ax9.annotate("Slippage grows non-linearly\nas trade size increases",
             xy=(25, slippage_theory[int(500*0.5)]),
             xytext=(10, slippage_theory[int(500*0.5)]-3),
             arrowprops=dict(arrowstyle="->", color="black"),
             fontsize=10)

out_path = os.path.join(os.path.dirname(__file__), "..", "dex_simulation_plots.png")
theory_path = os.path.join(os.path.dirname(__file__), "..", "slippage_theory_plot.png")
fig.savefig(out_path, dpi=150, bbox_inches="tight")
fig2.savefig(theory_path, dpi=150, bbox_inches="tight")
print(f"Plots saved: {out_path}")
print(f"Theory plot saved: {theory_path}")
plt.show()