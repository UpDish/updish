// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
/// @notice Local Anvil integration fixture only. Never deployed to GIWA by application code.
contract LocalDojang {
    mapping(address=>mapping(bytes32=>bool)) public verified;
    function setVerified(address account,bytes32 attester,bool value) external {verified[account][attester]=value;}
    function isVerified(address account,bytes32 attester) external view returns(bool) {return verified[account][attester];}
    function getVerifiedAddressAttestationUid(address account,bytes32 attester) external view returns(bytes32) {require(verified[account][attester]);return keccak256(abi.encode(account,attester));}
}
