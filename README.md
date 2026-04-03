# Decentralized Exchange - Cryptocurrencies and Smart Contracts

---

## Testnet Used
**Sepolia Ethereum Testnet**
> Chain ID: `11155111` | Explorer: https://sepolia.etherscan.io

---

### TokenA (TKA)
| Field | Value |
|-------|-------|
| **Address** | `0x7256DC231CbE0d3E29CE86A88555533D1ffF0DD6` |
| **Etherscan** | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x7256DC231CbE0d3E29CE86A88555533D1ffF0DD6#code) |

### TokenB (TKB)
| Field | Value |
|-------|-------|
| **Address** | `0x9190DE5799841336a5D58478f5ABb3D4930239B9` |
| **Etherscan** | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x9190DE5799841336a5D58478f5ABb3D4930239B9#code) |

### DEX 1 (Primary)
| Field | Value |
|-------|-------|
| **Address** | `0x63D142aE5A2ffbb85882748536A10Ca3b5a6Fe96` |
| **Etherscan** | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x63D142aE5A2ffbb85882748536A10Ca3b5a6Fe96#code) |
| **Initial Reserves** | 1000 TKA : 2000 TKB (price = 2.0 TKB/TKA) |

### DEX 2 (Arbitrage Pair)
| Field | Value |
|-------|-------|
| **Address** | `0xb5A50798baF821ABADBAab0EED20b806555e4832` |
| **Etherscan** | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xb5A50798baF821ABADBAab0EED20b806555e4832#code) |
| **Initial Reserves** | 1000 TKA : 2100 TKB (price = 2.1 TKB/TKA) |

### LP Token 1 (DLP — for DEX 1)
| Field | Value |
|-------|-------|
| **Address** | `0xa085dE14b9fBADD5D926d8203f0D2761BbC26cC1` |
| **Etherscan** | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xa085dE14b9fBADD5D926d8203f0D2761BbC26cC1#code) |
| **Access Control** | Only DEX 1 contract can mint/burn — enforced via `Ownable` |

### LP Token 2 (DLP — for DEX 2)
| Field | Value |
|-------|-------|
| **Address** | `0x964f26b13743634b92430bfB955463E8b3A1F64C` |
| **Etherscan** | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x964f26b13743634b92430bfB955463E8b3A1F64C#code) |
| **Access Control** | Only DEX 2 contract can mint/burn — enforced via `Ownable` |

### Arbitrage Contract
| Field | Value |
|-------|-------|
| **Address** | `0xc8BC0B60db82CB78A20caDFC2D6CA431FA345938` |
| **Etherscan** | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xc8BC0B60db82CB78A20caDFC2D6CA431FA345938#code) |
| **Access Control** | Only deployer (owner) can call `executeArbitrage()` |

---

## 🔐 Access Control Summary

| Contract | Restricted Function | Who Can Call |
| LPToken 1 | `mint()`, `burn()` | DEX 1 contract only |
| LPToken 2 | `mint()`, `burn()` | DEX 2 contract only |
| Token (TKA/TKB) | `mint()` | Deployer (owner) only |
| Token (TKA/TKB) | `faucet()` | Anyone (for testing) |
| Arbitrage | `executeArbitrage()` | Deployer (owner) only |
| Arbitrage | `checkOpportunity()` | Anyone (view — free) |
| DEX | `addLiquidity()`, `removeLiquidity()`, `swap*()` | Anyone |

---

## 🔗 Transaction Hashes

### Liquidity Addition + LP Token Minting
| Action | Transaction Hash |

| Add Liquidity (DEX 1) | [`0xf69ea9faf887645eac5fd01a597a8214c496715e015b0a30991d81fa90812f49`](https://sepolia.etherscan.io/tx/0xf69ea9faf887645eac5fd01a597a8214c496715e015b0a30991d81fa90812f49) |

> Deposited `100 TKA` + `200 TKB` → received `141.421 LP tokens` minted to wallet

---

### Liquidity Removal + LP Token Burning
| Action | Transaction Hash |
|--------|-----------------|
| Remove Liquidity (DEX 1) | [`0x3143f724d86ab129643a6038c18f7b3e5fda855092b43ad7778b4906e79bce70`](https://sepolia.etherscan.io/tx/0x3143f724d86ab129643a6038c18f7b3e5fda855092b43ad7778b4906e79bce70) |

> Burned `200 LP tokens` → received proportional `141.421712475516366027 TKA` + `282.843424951032732055 TKB` back

---

### Swap TokenA → TokenB
| Action | Transaction Hash |
|--------|-----------------|
| Swap TKA → TKB | [`0x6bde762dbc716fa1d7e032a67d37970ebbd27cb49c9d95b9ce36139c78b836a2`](https://sepolia.etherscan.io/tx/0x6bde762dbc716fa1d7e032a67d37970ebbd27cb49c9d95b9ce36139c78b836a2) |

> Sent `100 TKA` → received `180.614600890562007976 TKB` (0.3% fee deducted)

---

### Swap TokenB → TokenA
| Action | Transaction Hash |
|--------|-----------------|
| Swap TKB → TKA | [`0xce30a32275a3ca831b2c61050480e29a99ec2c3c3615f3b578c9dfa8f8e0d62b`](https://sepolia.etherscan.io/tx/0xce30a32275a3ca831b2c61050480e29a99ec2c3c3615f3b578c9dfa8f8e0d62b) |

> Sent `100 TKB` → received `57.476224131388078462 TKA` (0.3% fee deducted)

---

### Profitable Arbitrage Execution
| Action | Transaction Hash |
|--------|-----------------|
| Arbitrage (profitable) | [`0xdf062b55751be0deeed862dea487638c48d41670da0c252990daf9a08146e215`](https://sepolia.etherscan.io/tx/0xdf062b55751be0deeed862dea487638c48d41670da0c252990daf9a08146e215) |

> DEX1 price: 2.0 TKB/TKA, DEX2 price: 2.1 TKB/TKA
> Route: `10 TKA → DEX2 → ~20.58 TKB → DEX1 → ~10.08 TKA`
> Profit: `~0.08 TKA`

---

### Failed Arbitrage (Insufficient Profit)
| Action | Transaction Hash |
|--------|-----------------|
| Arbitrage (failed) | [`0x6271549f5eb4814ace27a68f1e6161b9550bb875fb3cc045610ca4b30488fb44`](https://sepolia.etherscan.io/tx/0x6271549f5eb4814ace27a68f1e6161b9550bb875fb3cc045610ca4b30488fb44) |

> Both DEXes at identical 1:2 ratio → no price discrepancy → emits `ArbitrageFailed` event
> Capital returned to owner, no profit

---

## 🖥️ How to Access the Deployed UI

### Option A — Hosted UI (Recommended)
> 🔗https://nikita-assignment3.vercel.app

1. Open the link in any browser
2. Make sure MetaMask is installed → https://metamask.io/download
3. Switch MetaMask to **Sepolia Testnet**:
   - Open MetaMask → click network dropdown → select **"Sepolia"**
   - If not visible: Settings → Advanced → Show test networks → ON
4. Click **"🦊 Connect Wallet"** on the page
5. Approve the connection in MetaMask popup

### Option B — Run Locally

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/Nikita_assignment3.git
cd Nikita_assignment3

# Install dependencies
npm install

# Serve the frontend
cd frontend
npx http-server . -p 3000

# Open http://localhost:3000 in your browser
```

---

## 💧 How to Add Liquidity and Receive LP Tokens

### Prerequisites
- Wallet connected to UI on Sepolia
- TKA and TKB in your wallet (use faucet above)

### Step-by-Step

**Step 1 — Open the Liquidity section**
- Find the **" Liquidity"** card in the UI
- Make sure the **"Add"** tab is selected (not "Remove")

**Step 2 — Enter TokenA amount**
- Type how much TKA you want to deposit (e.g. `100`)
- The TKB field **auto-calculates** based on the current pool ratio
- Example: pool ratio is 1:2 → depositing 100 TKA auto-fills 200 TKB

**Step 3 — First deposit (if pool is empty)**
- You get to set the initial price by choosing your own ratio
- Enter any amounts for TKA and TKB manually
- This ratio becomes the starting price

**Step 4 — Click "Add Liquidity"**
- MetaMask will prompt for approvals and the transaction:
  - Tx 1: Approve TKA spending *(skip if already approved)*
  - Tx 2: Approve TKB spending *(skip if already approved)*
  - Tx 3: `addLiquidity()` call — confirm this
- Wait for confirmation (~15 seconds on Sepolia)

**Step 5 — Receive LP Tokens**
- Your LP token balance appears in the stats bar at the top
- LP tokens = your ownership share of the pool
- You automatically earn 0.3% of all swap fees proportional to your share

> ⚠️ **Note:** Deposits after the first must match the current pool ratio exactly.
> Always use the auto-fill — do not change the TKB value manually.

---

## 🔄 How to Perform Swaps Using the DEX

### Step-by-Step

**Step 1 — Open the Swap section**
- Find the **"🔄 Swap Tokens"** card in the UI

**Step 2 — Select swap direction**
- Click **"TKA → TKB"** to sell TKA and buy TKB
- Click **"TKB → TKA"** to sell TKB and buy TKA

**Step 3 — Enter the amount to sell**
- Type your amount in the **"You Pay"** input
- The **"You Receive (est.)"** field automatically shows:
  - Estimated output tokens
  - 0.3% swap fee
  - Estimated slippage %
  - Price impact %
- Click **MAX** to use your full balance

**Step 4 — Click "Swap"**
- MetaMask prompts:
  - Tx 1: Approve token spending *(first time only)*
  - Tx 2: Confirm the swap
- Wait ~15 seconds for Sepolia confirmation

**Step 5 — Verify**
- Token balances update instantly in the stats bar
- Transaction appears in the **" Transaction Log"** at the bottom
- Click the hash link → opens Sepolia Etherscan to verify on-chain

### Swap Pricing Formula
```
Output = reserveOut × amountIn × 997
         ──────────────────────────────────────
         reserveIn × 1000 + amountIn × 997
```
Fee (0.3%) stays in the pool — LPs accumulate it over time.

### Tips for Better Swaps
| Tip | Reason |
|-----|--------|
| Keep trades under 5% of pool reserves | Minimises slippage |
| Check price impact before confirming | High impact = bad rate |
| Use "Get Test Tokens" if balance is low | Faucet gives 1000 of each |
| Switch to DEX 2 to compare rates | Rates differ due to different ratios |

---

## 🗂️ Project Structure

```
Nikita_assignment3/
├── contracts/
│   ├── Token.sol           # ERC20 token — deploy twice for TKA & TKB
│   ├── LPToken.sol         # LP token, only DEX can mint/burn
│   ├── DEX.sol             # Core AMM: x*y=k, 0.3% fee, ReentrancyGuard
│   └── Arbitrage.sol       # Cross-DEX arbitrage with profit check
├── scripts/
│   ├── deploy.js           # Deploys all 7 contracts + seeds liquidity
│   ├── simulate.js         # 5 LPs + 8 traders, 75 random transactions
│   ├── plot_simulation.py  # 8-panel metric plots + theory & plot
│   └── test_arbitrage.js   # Profitable + failed arbitrage demo
├── test/
│   └── DEX.test.js         # tess covering all tasks
├── frontend/
│   ├── index.html          # Complete DEX UI (single file, no build needed)
│   └── src/
│       ├── abis.js         # Human-readable ABIs for ethers.js v6
│       └── addresses.json  # Auto-populated by deploy.js
├── .env.example            # Environment variable template
├── hardhat.config.js       # Hardhat config (localhost + Sepolia)
└── README.md               
```

---

## Run Everything Locally

```bash
# Install
npm install

# Compile
npx hardhat compile

# Terminal 1 — local blockchain
npx hardhat node

# Terminal 2 — deploy, test, simulate
npx hardhat run scripts/deploy.js --network localhost
npx hardhat test
npx hardhat run scripts/simulate.js --network localhost
python scripts/plot_simulation.py
npx hardhat run scripts/test_arbitrage_local.js --network localhost

# Serve UI
cd frontend && npx http-server . -p 3000
# Open http://127.0.0.1:3000
```

---

## Deploy to Sepolia

```bash
# 1. Set up .env
cp .env.example .env
# Edit .env with your Alchemy URL and private key

# 2. Deploy all contracts
npx hardhat run scripts/deploy.js --network sepolia

# 3. Verify on Etherscan (requires ETHERSCAN_API_KEY in .env)
# npx hardhat verify --network sepolia <TOKENA_ADDRESS> "Token A" "TKA" "1000000" "<DEPLOYER>"
npx hardhat verify --network sepolia 0x7256DC231CbE0d3E29CE86A88555533D1ffF0DD6 "Token A" "TKA" "1000000" "0x394B15344011E66949e7B695A246893f23206fc5"
# npx hardhat verify --network sepolia <TOKENB_ADDRESS> "Token B" "TKB" "1000000" "<DEPLOYER>"
npx hardhat verify --network sepolia 0x9190DE5799841336a5D58478f5ABb3D4930239B9 "Token B" "TKB" "1000000" "0x394B15344011E66949e7B695A246893f23206fc5"
# npx hardhat verify --network sepolia <DEX1_ADDRESS> <TOKENA_ADDRESS> <TOKENB_ADDRESS>
npx hardhat verify --network sepolia 0x63D142aE5A2ffbb85882748536A10Ca3b5a6Fe96 0x7256DC231CbE0d3E29CE86A88555533D1ffF0DD6 0x9190DE5799841336a5D58478f5ABb3D4930239B9
# npx hardhat verify --network sepolia <DEX2_ADDRESS> <TOKENA_ADDRESS> <TOKENB_ADDRESS>
npx hardhat verify --network sepolia 0xb5A50798baF821ABADBAab0EED20b806555e4832 0x7256DC231CbE0d3E29CE86A88555533D1ffF0DD6 0x9190DE5799841336a5D58478f5ABb3D4930239B9
# npx hardhat verify --network sepolia <ARBITRAGE_ADDRESS> <DEX1_ADDRESS> <DEX2_ADDRESS> "10000000000000000"
npx hardhat verify --network sepolia 0xc8BC0B60db82CB78A20caDFC2D6CA431FA345938 0x63D142aE5A2ffbb85882748536A10Ca3b5a6Fe96 0xb5A50798baF821ABADBAab0EED20b806555e4832 "10000000000000000"

# LP Token Verification
npx hardhat verify --network sepolia 0xa085dE14b9fBADD5D926d8203f0D2761BbC26cC1 "DEX LP Token" "DLP" 0x63D142aE5A2ffbb85882748536A10Ca3b5a6Fe96
npx hardhat verify --network sepolia 0x964f26b13743634b92430bfB955463E8b3A1F64C "DEX LP Token" "DLP" 0xb5A50798baF821ABADBAab0EED20b806555e4832
```

---

## 📹 Video Demonstration
> 🎬 **[VIDEO LINK HERE]** 

Covers:
- Connecting MetaMask to the deployed UI
- Adding liquidity and observing LP token minting
- Performing TKA→TKB and TKB→TKA swaps
- Checking arbitrage opportunity between DEX1 and DEX2
- Executing profitable arbitrage and observing profit
- Demonstrating failed arbitrage with same-ratio DEXes
- On-chain verification via Sepolia Etherscan

---

## References
- [Uniswap v2 Whitepaper](https://uniswap.org/whitepaper.pdf)
- [Automated Market Makers — Ethereum.org](https://ethereum.org/en/defi/#dex)
- [OpenZeppelin ERC-20 Documentation](https://docs.openzeppelin.com/contracts/erc20)
- [Solidity Documentation](https://docs.soliditylang.org)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Etherscan Verification Guide](https://docs.etherscan.io/tutorials/verifying-contracts)
