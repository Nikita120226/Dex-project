// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LPToken
 * @dev ERC20 LP tokens representing share of the DEX liquidity pool.
 *      Only the DEX contract (owner) can mint and burn these tokens.
 *      This enforces that LP tokens only exist when backed by real reserves.
 */
contract LPToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        address dexAddress
    ) ERC20(name, symbol) Ownable(dexAddress) {}

    /**
     * @dev Mint LP tokens. Only DEX contract can call this.
     *      Called when liquidity is added.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "LPToken: mint to zero address");
        require(amount > 0, "LPToken: mint zero amount");
        _mint(to, amount);
    }

    /**
     * @dev Burn LP tokens. Only DEX contract can call this.
     *      Called when liquidity is removed.
     */
    function burn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "LPToken: burn from zero address");
        require(amount > 0, "LPToken: burn zero amount");
        _burn(from, amount);
    }
}
