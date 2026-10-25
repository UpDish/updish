// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Minimal read ABI from the official GIWA Dojang documentation.
interface IDojangScroll {
    function isVerified(address account, bytes32 attesterId) external view returns (bool);
    function getVerifiedAddressAttestationUid(address account, bytes32 attesterId)
        external view returns (bytes32);
}
