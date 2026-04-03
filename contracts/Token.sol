// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Token
 * @dev Simple ERC20 token. Deploy twice to get TokenA and TokenB.
 *      The deployer (owner) can mint tokens to any address for testing.
 */
contract Token is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _decimals = 18;
        // Mint initial supply to deployer
        _mint(initialOwner, initialSupply * (10 ** 18));
    }

    /**
     * @dev Owner can mint tokens (useful for testing / faucet on testnet)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Anyone can call faucet to get 1000 tokens for testing
     */
    function faucet(address to) external {
        _mint(to, 1000 * (10 ** 18));
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
