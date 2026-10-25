// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IDojangScroll} from "./IDojangScroll.sol";

/// @notice Testnet eligibility reader for later allocation/mint integration.
/// @dev This does not establish legal investment eligibility or issue an attestation.
contract DojangEligibility {
    IDojangScroll public immutable scroll;
    bytes32 public immutable allowedAttester;

    error InvalidConfiguration();

    constructor(address scrollAddress, bytes32 attesterId) {
        if (scrollAddress.code.length == 0 || attesterId == bytes32(0)) revert InvalidConfiguration();
        scroll = IDojangScroll(scrollAddress);
        allowedAttester = attesterId;
    }

    function isEligible(address account) external view returns (bool) {
        return scroll.isVerified(account, allowedAttester);
    }
}
