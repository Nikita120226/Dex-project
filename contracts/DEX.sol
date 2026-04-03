// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LPToken.sol";

/**
 * @title DEX
 * @dev Automated Market Maker (AMM) DEX using constant product formula x*y=k.
 *      Swap fee: 0.3% (997/1000 of input used for swap after fee deduction).
 *
 * Security measures:
 * - ReentrancyGuard on all state-changing functions
 * - SafeERC20 for all token transfers
 * - Input validation on all public functions
 * - Integer overflow safe (Solidity 0.8+)
 * - Minimum liquidity lock to prevent division-by-zero attacks
 * - Slippage protection via minOutput parameter on swaps
 */
contract DEX is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────────
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    LPToken public immutable lpToken;

    uint256 public reserveA;
    uint256 public reserveB;

    /// @dev Swap fee numerator (fee = 0.3% → 997/1000 of input goes to pool)
    uint256 public constant FEE_NUMERATOR   = 997;
    uint256 public constant FEE_DENOMINATOR = 1000;

    /// @dev Minimum LP tokens permanently locked (prevents first-deposit attack)
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // ─── Events ──────────────────────────────────────────────────────────────
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpMinted
    );
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpBurned
    );
    event Swap(
        address indexed trader,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut,
        uint256 fee
    );

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0) && _tokenB != address(0), "DEX: zero address");
        require(_tokenA != _tokenB, "DEX: identical tokens");

        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);

        // Deploy LP token; DEX is the owner so only DEX can mint/burn
        lpToken = new LPToken("DEX LP Token", "DLP", address(this));
    }

    // ─── Liquidity Functions ─────────────────────────────────────────────────

    /**
     * @notice Add liquidity to the pool.
     * @dev First deposit sets the price ratio. Subsequent deposits must match
     *      the existing ratio exactly (within integer precision).
     * @param amountA Amount of TokenA to deposit
     * @param amountB Amount of TokenB to deposit
     * @return lpMinted Amount of LP tokens minted to the caller
     */
    function addLiquidity(uint256 amountA, uint256 amountB)
        external
        nonReentrant
        returns (uint256 lpMinted)
    {
        require(amountA > 0 && amountB > 0, "DEX: zero amount");

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        uint256 totalLP   = lpToken.totalSupply();

        if (totalLP == 0) {
            // ── First deposit: sets the price ratio ──────────────────────────
            // Geometric mean minus MINIMUM_LIQUIDITY (locked forever)
            lpMinted = _sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            require(lpMinted > 0, "DEX: insufficient initial liquidity");

            // Permanently lock MINIMUM_LIQUIDITY to address(1) to prevent
            // the pool from ever being fully drained (avoids divide-by-zero)
            lpToken.mint(address(1), MINIMUM_LIQUIDITY);
        } else {
            // ── Subsequent deposits: must preserve ratio ─────────────────────
            // Verify ratio: amountA / amountB == reserveA / reserveB
            // Cross-multiply to avoid division: amountA * reserveB == amountB * reserveA
            require(
                amountA * _reserveB == amountB * _reserveA,
                "DEX: ratio mismatch"
            );

            // LP tokens minted proportional to share added
            uint256 lpFromA = (amountA * totalLP) / _reserveA;
            uint256 lpFromB = (amountB * totalLP) / _reserveB;
            lpMinted = lpFromA < lpFromB ? lpFromA : lpFromB; // take minimum
            require(lpMinted > 0, "DEX: insufficient liquidity minted");
        }

        // Pull tokens from the caller
        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);

        // Update reserves
        reserveA = _reserveA + amountA;
        reserveB = _reserveB + amountB;

        // Mint LP tokens to the provider
        lpToken.mint(msg.sender, lpMinted);

        emit LiquidityAdded(msg.sender, amountA, amountB, lpMinted);
    }

    /**
     * @notice Remove liquidity by burning LP tokens.
     * @param lpAmount Amount of LP tokens to burn
     * @return amountA TokenA returned to the caller
     * @return amountB TokenB returned to the caller
     */
    function removeLiquidity(uint256 lpAmount)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        require(lpAmount > 0, "DEX: zero LP amount");

        uint256 totalLP = lpToken.totalSupply();
        require(totalLP > 0, "DEX: no liquidity");

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;

        // Proportional share of reserves
        amountA = (lpAmount * _reserveA) / totalLP;
        amountB = (lpAmount * _reserveB) / totalLP;

        require(amountA > 0 && amountB > 0, "DEX: insufficient output");

        // Burn LP tokens first (checks balance)
        lpToken.burn(msg.sender, lpAmount);

        // Update reserves before transfer (checks-effects-interactions)
        reserveA = _reserveA - amountA;
        reserveB = _reserveB - amountB;

        // Transfer tokens to the provider
        tokenA.safeTransfer(msg.sender, amountA);
        tokenB.safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, lpAmount);
    }

    // ─── Swap Functions ──────────────────────────────────────────────────────

    /**
     * @notice Swap TokenA for TokenB.
     * @param amountAIn  Amount of TokenA to sell
     * @param minBOut    Minimum TokenB to receive (slippage protection)
     * @return amountBOut Amount of TokenB received
     */
    function swapAForB(uint256 amountAIn, uint256 minBOut)
        external
        nonReentrant
        returns (uint256 amountBOut)
    {
        require(amountAIn > 0, "DEX: zero input");

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        require(_reserveA > 0 && _reserveB > 0, "DEX: no liquidity");

        // Apply 0.3% fee: effective input = amountAIn * 997 / 1000
        uint256 amountAWithFee = amountAIn * FEE_NUMERATOR;
        uint256 fee = amountAIn - (amountAWithFee / FEE_DENOMINATOR);

        // Constant product formula: (x + dx*997/1000) * (y - dy) = x * y
        // => dy = y * dx*997/1000 / (x + dx*997/1000)
        amountBOut = (_reserveB * amountAWithFee) /
            (_reserveA * FEE_DENOMINATOR + amountAWithFee);

        require(amountBOut >= minBOut, "DEX: slippage exceeded");
        require(amountBOut < _reserveB, "DEX: insufficient B reserve");

        // Pull TokenA from trader
        tokenA.safeTransferFrom(msg.sender, address(this), amountAIn);

        // Update reserves (fee stays in pool, increasing k slightly)
        reserveA = _reserveA + amountAIn;
        reserveB = _reserveB - amountBOut;

        // Send TokenB to trader
        tokenB.safeTransfer(msg.sender, amountBOut);

        emit Swap(
            msg.sender,
            address(tokenA), amountAIn,
            address(tokenB), amountBOut,
            fee
        );
    }

    /**
     * @notice Swap TokenB for TokenA.
     * @param amountBIn  Amount of TokenB to sell
     * @param minAOut    Minimum TokenA to receive (slippage protection)
     * @return amountAOut Amount of TokenA received
     */
    function swapBForA(uint256 amountBIn, uint256 minAOut)
        external
        nonReentrant
        returns (uint256 amountAOut)
    {
        require(amountBIn > 0, "DEX: zero input");

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        require(_reserveA > 0 && _reserveB > 0, "DEX: no liquidity");

        uint256 amountBWithFee = amountBIn * FEE_NUMERATOR;
        uint256 fee = amountBIn - (amountBWithFee / FEE_DENOMINATOR);

        amountAOut = (_reserveA * amountBWithFee) /
            (_reserveB * FEE_DENOMINATOR + amountBWithFee);

        require(amountAOut >= minAOut, "DEX: slippage exceeded");
        require(amountAOut < _reserveA, "DEX: insufficient A reserve");

        tokenB.safeTransferFrom(msg.sender, address(this), amountBIn);

        reserveB = _reserveB + amountBIn;
        reserveA = _reserveA - amountAOut;

        tokenA.safeTransfer(msg.sender, amountAOut);

        emit Swap(
            msg.sender,
            address(tokenB), amountBIn,
            address(tokenA), amountAOut,
            fee
        );
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Spot price of TokenA in terms of TokenB (scaled by 1e18)
    function spotPrice() external view returns (uint256) {
        require(reserveA > 0, "DEX: no liquidity");
        return (reserveB * 1e18) / reserveA;
    }

    /// @notice Reserve ratio TokenA/TokenB (scaled by 1e18)
    function getReserveRatio() external view returns (uint256) {
        require(reserveB > 0, "DEX: no liquidity");
        return (reserveA * 1e18) / reserveB;
    }

    /// @notice Returns (reserveA, reserveB)
    function getReserves() external view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }

    /// @notice Price of TokenB in terms of TokenA (scaled by 1e18)
    function priceOfBInA() external view returns (uint256) {
        require(reserveB > 0, "DEX: no liquidity");
        return (reserveA * 1e18) / reserveB;
    }

    /// @notice Preview output for A→B swap (before executing)
    function getAmountOut_AtoB(uint256 amountAIn) external view returns (uint256) {
        require(amountAIn > 0, "DEX: zero input");
        uint256 amountAWithFee = amountAIn * FEE_NUMERATOR;
        return (reserveB * amountAWithFee) /
            (reserveA * FEE_DENOMINATOR + amountAWithFee);
    }

    /// @notice Preview output for B→A swap (before executing)
    function getAmountOut_BtoA(uint256 amountBIn) external view returns (uint256) {
        require(amountBIn > 0, "DEX: zero input");
        uint256 amountBWithFee = amountBIn * FEE_NUMERATOR;
        return (reserveA * amountBWithFee) /
            (reserveB * FEE_DENOMINATOR + amountBWithFee);
    }

    // ─── Internal Helpers ────────────────────────────────────────────────────

    /// @dev Babylonian square root (integer)
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
