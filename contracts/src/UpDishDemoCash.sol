// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet-only, non-redeemable DEMO units. No KRW backing or financial rights.
contract UpDishDemoCash is ERC20 {
    constructor(address operator) ERC20("UpDish Demo Cash", "DEMO") {
        _mint(operator, 1_000_000_000);
    }

    function decimals() public pure override returns (uint8) { return 0; }
}
