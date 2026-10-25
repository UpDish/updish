// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DojangEligibility} from "../src/DojangEligibility.sol";

contract MockDojangScroll {
    mapping(address => mapping(bytes32 => bool)) public verified;
    bool public unavailable;
    function setVerified(address account, bytes32 attester, bool value) external {
        verified[account][attester] = value;
    }
    function setUnavailable() external { unavailable = true; }
    function isVerified(address account, bytes32 attester) external view returns (bool) {
        require(!unavailable, "unavailable");
        return verified[account][attester];
    }
}

contract DojangEligibilityTest {
    bytes32 constant FAUCET = keccak256("test-faucet");
    address constant INVESTOR = address(123);

    function testIssuanceAndRevocation() public {
        MockDojangScroll source = new MockDojangScroll();
        DojangEligibility gate = new DojangEligibility(address(source), FAUCET);
        require(!gate.isEligible(INVESTOR));
        source.setVerified(INVESTOR, FAUCET, true);
        require(gate.isEligible(INVESTOR));
        source.setVerified(INVESTOR, FAUCET, false);
        require(!gate.isEligible(INVESTOR));
    }

    function testOtherAttesterDoesNotGrantAccess() public {
        MockDojangScroll source = new MockDojangScroll();
        DojangEligibility gate = new DojangEligibility(address(source), FAUCET);
        source.setVerified(INVESTOR, keccak256("other"), true);
        require(!gate.isEligible(INVESTOR));
    }

    function testReadFailureIsNotConvertedToFalse() public {
        MockDojangScroll source = new MockDojangScroll();
        DojangEligibility gate = new DojangEligibility(address(source), FAUCET);
        source.setUnavailable();
        (bool ok,) = address(gate).staticcall(abi.encodeCall(gate.isEligible, (INVESTOR)));
        require(!ok);
    }
}
