// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IDEX {
    function spotPrice() external view returns (uint256);
    function swapAForB(uint256 amountAIn, uint256 minBOut) external returns (uint256);
    function swapBForA(uint256 amountBIn, uint256 minAOut) external returns (uint256);
    function getAmountOut_AtoB(uint256 amountAIn) external view returns (uint256);
    function getAmountOut_BtoA(uint256 amountBIn) external view returns (uint256);
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
}

/**
 * @title Arbitrage
 * @dev Detects and executes profitable arbitrage between two DEX instances.
 *      Supports both A→B→A and B→A→B directions.
 *
 *      The contract holds initial capital in TokenA (or TokenB).
 *      When executeArbitrage() is called, it:
 *        1. Checks both directions for profit
 *        2. Executes the profitable one (if profit > minProfit threshold)
 *        3. Returns capital + profit to the owner
 *
 * Security: onlyOwner on execute; reentrancy safe via CEI pattern.
 */
contract Arbitrage is Ownable {
    using SafeERC20 for IERC20;

    IDEX public immutable dex1;
    IDEX public immutable dex2;
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    /// @dev Minimum profit (in token units, 18 decimals) to bother executing
    uint256 public minProfit;

    event ArbitrageExecuted(
        string direction,
        uint256 amountIn,
        uint256 profit
    );
    event ArbitrageFailed(string reason);

    constructor(
        address _dex1,
        address _dex2,
        uint256 _minProfit
    ) Ownable(msg.sender) {
        require(_dex1 != address(0) && _dex2 != address(0), "Arb: zero address");
        require(_dex1 != _dex2, "Arb: same DEX");

        dex1 = IDEX(_dex1);
        dex2 = IDEX(_dex2);

        // Both DEXes must share the same token pair
        require(dex1.tokenA() == dex2.tokenA(), "Arb: tokenA mismatch");
        require(dex1.tokenB() == dex2.tokenB(), "Arb: tokenB mismatch");

        tokenA = IERC20(dex1.tokenA());
        tokenB = IERC20(dex1.tokenB());
        minProfit = _minProfit;
    }

    /**
     * @notice Set the minimum profit threshold.
     */
    function setMinProfit(uint256 _minProfit) external onlyOwner {
        minProfit = _minProfit;
    }

    /**
     * @notice Main entry point. Detects and executes arbitrage if profitable.
     * @param capitalA Amount of TokenA capital to use for direction A→B→A
     * @param capitalB Amount of TokenB capital to use for direction B→A→B
     * @return profitA Profit in TokenA from A→B→A direction (0 if not executed)
     * @return profitB Profit in TokenB from B→A→B direction (0 if not executed)
     */
    function executeArbitrage(uint256 capitalA, uint256 capitalB)
        external
        onlyOwner
        returns (uint256 profitA, uint256 profitB)
    {
        // ── Direction 1: Buy B on DEX2 (cheaper), sell B on DEX1 (more expensive)
        //    Route: TokenA → DEX2 → TokenB → DEX1 → TokenA
        if (capitalA > 0) {
            uint256 bFromDex2 = dex2.getAmountOut_AtoB(capitalA);
            if (bFromDex2 > 0) {
                uint256 aFromDex1 = dex1.getAmountOut_BtoA(bFromDex2);
                if (aFromDex1 > capitalA && aFromDex1 - capitalA > minProfit) {
                    profitA = _executeABA(capitalA, bFromDex2, aFromDex1);
                }
            }
        }

        // ── Direction 2: Buy A on DEX1 (cheaper), sell A on DEX2 (more expensive)
        //    Route: TokenB → DEX1 → TokenA → DEX2 → TokenB
        if (capitalB > 0) {
            uint256 aFromDex1 = dex1.getAmountOut_BtoA(capitalB);
            if (aFromDex1 > 0) {
                uint256 bFromDex2 = dex2.getAmountOut_AtoB(aFromDex1);
                if (bFromDex2 > capitalB && bFromDex2 - capitalB > minProfit) {
                    profitB = _executeBAB(capitalB, aFromDex1, bFromDex2);
                }
            }
        }

        if (profitA == 0 && profitB == 0) {
            emit ArbitrageFailed("No profitable opportunity found");
        }
    }

    /**
     * @dev Execute A→B (DEX2) then B→A (DEX1)
     */
    function _executeABA(
        uint256 capitalA,
        uint256 expectedB,
        uint256 /*expectedA*/
    ) internal returns (uint256 profit) {
        // Step 1: Approve and swap A→B on DEX2
        tokenA.forceApprove(address(dex2), capitalA);
        uint256 bReceived = dex2.swapAForB(capitalA, (expectedB * 99) / 100);

        // Step 2: Approve and swap B→A on DEX1
        tokenB.forceApprove(address(dex1), bReceived);
        uint256 aReceived = dex1.swapBForA(bReceived, capitalA); // must at least break even

        if (aReceived > capitalA) {
            profit = aReceived - capitalA;
            // Transfer profit + capital back to owner
            tokenA.safeTransfer(owner(), aReceived);
            emit ArbitrageExecuted(unicode"A->B(DEX2)->A(DEX1)", capitalA, profit);
        } else {
            // Trade was unprofitable despite prediction (price moved); return capital
            tokenA.safeTransfer(owner(), aReceived);
            emit ArbitrageFailed(unicode"A->B->A: no profit after execution");
        }
    }

    /**
     * @dev Execute B→A (DEX1) then A→B (DEX2)
     */
    function _executeBAB(
        uint256 capitalB,
        uint256 expectedA,
        uint256 /*expectedB*/
    ) internal returns (uint256 profit) {
        // Step 1: Approve and swap B→A on DEX1
        tokenB.forceApprove(address(dex1), capitalB);
        uint256 aReceived = dex1.swapBForA(capitalB, (expectedA * 99) / 100);

        // Step 2: Approve and swap A→B on DEX2
        tokenA.forceApprove(address(dex2), aReceived);
        uint256 bReceived = dex2.swapAForB(aReceived, capitalB);

        if (bReceived > capitalB) {
            profit = bReceived - capitalB;
            tokenB.safeTransfer(owner(), bReceived);
            emit ArbitrageExecuted(unicode"B->A(DEX1)->B(DEX2)", capitalB, profit);
        } else {
            tokenB.safeTransfer(owner(), bReceived);
            emit ArbitrageFailed(unicode"B->A->B: no profit after execution");
        }
    }

    /**
     * @notice Check arbitrage opportunity without executing.
     * @return dirABA_profit Expected profit (TokenA) for A→B→A, 0 if not profitable
     * @return dirBAB_profit Expected profit (TokenB) for B→A→B, 0 if not profitable
     */
    function checkOpportunity(uint256 capitalA, uint256 capitalB)
        external
        view
        returns (uint256 dirABA_profit, uint256 dirBAB_profit)
    {
        if (capitalA > 0) {
            uint256 bFromDex2 = dex2.getAmountOut_AtoB(capitalA);
            if (bFromDex2 > 0) {
                uint256 aFromDex1 = dex1.getAmountOut_BtoA(bFromDex2);
                if (aFromDex1 > capitalA) {
                    dirABA_profit = aFromDex1 - capitalA;
                }
            }
        }

        if (capitalB > 0) {
            uint256 aFromDex1 = dex1.getAmountOut_BtoA(capitalB);
            if (aFromDex1 > 0) {
                uint256 bFromDex2 = dex2.getAmountOut_AtoB(aFromDex1);
                if (bFromDex2 > capitalB) {
                    dirBAB_profit = bFromDex2 - capitalB;
                }
            }
        }
    }

    /**
     * @notice Deposit tokens into this contract (arbitrage capital).
     */
    function depositTokenA(uint256 amount) external onlyOwner {
        tokenA.safeTransferFrom(msg.sender, address(this), amount);
    }

    function depositTokenB(uint256 amount) external onlyOwner {
        tokenB.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Emergency withdraw all tokens back to owner
    function withdrawAll() external onlyOwner {
        uint256 balA = tokenA.balanceOf(address(this));
        uint256 balB = tokenB.balanceOf(address(this));
        if (balA > 0) tokenA.safeTransfer(owner(), balA);
        if (balB > 0) tokenB.safeTransfer(owner(), balB);
    }
}
