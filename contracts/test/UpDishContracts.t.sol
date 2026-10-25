// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {UpDishDemoUnits} from "../src/UpDishDemoUnits.sol";
import {SettlementRegistry} from "../src/SettlementRegistry.sol";
import {MockDojangScroll} from "./DojangEligibility.t.sol";
interface Vm {function prank(address) external;function expectRevert() external;}
contract UpDishContractsTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant FAUCET=keccak256("test-faucet");address constant USER=address(123);address constant OTHER=address(456);
    function setup() internal returns (UpDishDemoUnits units,MockDojangScroll source) {source=new MockDojangScroll();units=new UpDishDemoUnits(address(this),address(source),FAUCET,1,3600);source.setVerified(USER,FAUCET,true);}
    function testVerifiedMintAndDuplicateAllocation() public {(UpDishDemoUnits u,)=setup();u.mintAllocation(bytes32(uint256(1)),USER,1,100);require(u.balanceOf(USER,1)==100);vm.expectRevert();u.mintAllocation(bytes32(uint256(1)),USER,1,100);}
    function testUnauthorizedOperatorAndOverCap() public {(UpDishDemoUnits u,)=setup();vm.expectRevert();vm.prank(OTHER);u.mintAllocation(bytes32(uint256(1)),USER,1,100);vm.expectRevert();u.mintAllocation(bytes32(uint256(2)),USER,1,3601);}
    function testRevocationStopsNewMintAndPreservesExistingBalance() public {(UpDishDemoUnits u,MockDojangScroll s)=setup();u.mintAllocation(bytes32(uint256(1)),USER,1,100);s.setVerified(USER,FAUCET,false);vm.expectRevert();u.mintAllocation(bytes32(uint256(2)),USER,1,1);require(u.balanceOf(USER,1)==100);}
    function testSingleBatchAndApprovalPathsAreBlocked() public {(UpDishDemoUnits u,)=setup();u.mintAllocation(bytes32(uint256(1)),USER,1,100);vm.expectRevert();vm.prank(USER);u.safeTransferFrom(USER,OTHER,1,1,"");uint256[] memory ids=new uint256[](1);uint256[] memory values=new uint256[](1);ids[0]=1;values[0]=1;vm.expectRevert();vm.prank(USER);u.safeBatchTransferFrom(USER,OTHER,ids,values,"");vm.expectRevert();vm.prank(USER);u.setApprovalForAll(OTHER,true);}
    function testRegistryPreservesOriginalAndReferencesCorrection() public {SettlementRegistry r=new SettlementRegistry(address(this));bytes32 run=bytes32(uint256(1));bytes32 first=bytes32(uint256(2));bytes32 second=bytes32(uint256(3));r.record(run,first,keccak256("original"),bytes32(0));r.record(run,second,keccak256("correction"),first);(,bytes32 digest,bytes32 previous)=r.records(second);require(digest==keccak256("correction")&&previous==first);vm.expectRevert();r.record(run,first,keccak256("overwrite"),bytes32(0));}
    function testRegistryRejectsOtherOwnerAndUnknownCorrection() public {SettlementRegistry r=new SettlementRegistry(address(this));vm.expectRevert();vm.prank(OTHER);r.record(bytes32(uint256(1)),bytes32(uint256(2)),keccak256("x"),bytes32(0));vm.expectRevert();r.record(bytes32(uint256(1)),bytes32(uint256(2)),keccak256("x"),bytes32(uint256(99)));}
}
