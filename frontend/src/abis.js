// Auto-generated ABIs for frontend use
// These are updated after contract compilation via: node scripts/export_abi.js

window.DEX_ABI = [
  "function addLiquidity(uint256 amountA, uint256 amountB) returns (uint256)",
  "function removeLiquidity(uint256 lpAmount) returns (uint256, uint256)",
  "function swapAForB(uint256 amountAIn, uint256 minBOut) returns (uint256)",
  "function swapBForA(uint256 amountBIn, uint256 minAOut) returns (uint256)",
  "function spotPrice() view returns (uint256)",
  "function getReserveRatio() view returns (uint256)",
  "function getReserves() view returns (uint256, uint256)",
  "function priceOfBInA() view returns (uint256)",
  "function getAmountOut_AtoB(uint256) view returns (uint256)",
  "function getAmountOut_BtoA(uint256) view returns (uint256)",
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)",
  "function lpToken() view returns (address)",
  "function reserveA() view returns (uint256)",
  "function reserveB() view returns (uint256)",
  "event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpMinted)",
  "event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpBurned)",
  "event Swap(address indexed trader, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut, uint256 fee)"
];

window.TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function faucet(address to)"
];

window.ARBITRAGE_ABI = [
  "function executeArbitrage(uint256 capitalA, uint256 capitalB) returns (uint256, uint256)",
  "function checkOpportunity(uint256 capitalA, uint256 capitalB) view returns (uint256, uint256)",
  "function depositTokenA(uint256 amount)",
  "function depositTokenB(uint256 amount)",
  "function withdrawAll()",
  "function setMinProfit(uint256)",
  "function minProfit() view returns (uint256)",
  "event ArbitrageExecuted(string direction, uint256 amountIn, uint256 profit)",
  "event ArbitrageFailed(string reason)"
];
