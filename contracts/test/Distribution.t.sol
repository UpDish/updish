// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {UpDishDemoCash} from "../src/UpDishDemoCash.sol";
import {UpDishDistribution} from "../src/UpDishDistribution.sol";
import {UpDishDemoUnits} from "../src/UpDishDemoUnits.sol";
import {SettlementRegistry} from "../src/SettlementRegistry.sol";
import {MockDojangScroll} from "./DojangEligibility.t.sol";
interface DistributionVm {function prank(address) external;function expectRevert() external;}
contract DistributionTest {
    DistributionVm constant vm=DistributionVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USER=address(123);
    bytes32 constant RUN=bytes32(uint256(1)); bytes32 constant PERIOD=bytes32(uint256(2)); bytes32 constant RECORD=bytes32(uint256(3));
    UpDishDemoCash cash; UpDishDistribution vault; UpDishDemoUnits units; SettlementRegistry registry; MockDojangScroll dojang;
    function setUp() public {
        dojang=new MockDojangScroll();dojang.setVerified(USER,bytes32(uint256(5)),true);
        units=new UpDishDemoUnits(address(this),address(dojang),bytes32(uint256(5)),1,10000);
        units.mintAllocation(bytes32(uint256(6)),USER,1,100);
        cash=new UpDishDemoCash(address(this));registry=new SettlementRegistry(address(this));
        vault=new UpDishDistribution(address(this),address(cash),address(units),address(registry),RUN,1,10000);
        registry.record(RUN,RECORD,keccak256("approved sales snapshot"),bytes32(0));cash.approve(address(vault),10_000_000);
    }
    function testPresentationMathAndRealTestTokenReceipt() public {
        vault.publish(PERIOD,RECORD,3_000_000);require(cash.balanceOf(address(vault))==3_000_000);
        vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,30_000);
        require(cash.balanceOf(USER)==30_000 && vault.paidTo(PERIOD,USER)==30_000);
    }
    function testRequiresRecordedSalesAndDepositedFunds() public {
        vm.expectRevert();vault.publish(PERIOD,bytes32(uint256(99)),3_000_000);
        cash.approve(address(vault),0);vm.expectRevert();vault.publish(PERIOD,RECORD,3_000_000);
        require(!vault.published(RECORD));vm.expectRevert();vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,30_000);
    }
    function testOwnershipEntitlementAndDuplicatePaymentAreEnforced() public {
        vault.publish(PERIOD,RECORD,3_000_000);
        vm.expectRevert();vm.prank(USER);vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,30_000);
        vm.expectRevert();vault.pay(bytes32(uint256(7)),PERIOD,RECORD,address(456),100,30_000);
        vm.expectRevert();vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,30_001);
        vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,30_000);
        vm.expectRevert();vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,1);
        vm.expectRevert();vault.pay(bytes32(uint256(8)),PERIOD,RECORD,USER,100,1);
    }
    function testCorrectionCarriesReceiptsForwardAndRejectsOldRevision() public {
        vault.publish(PERIOD,RECORD,3_000_000);vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,30_000);
        bytes32 revised=bytes32(uint256(8));registry.record(RUN,revised,keccak256("corrected"),RECORD);
        vault.publish(PERIOD,revised,3_200_000);
        vm.expectRevert();vault.pay(bytes32(uint256(9)),PERIOD,RECORD,USER,100,2000);
        vault.pay(bytes32(uint256(9)),PERIOD,revised,USER,100,2000);require(cash.balanceOf(USER)==32_000);
        bytes32 lower=bytes32(uint256(10));registry.record(RUN,lower,keccak256("lower"),revised);vault.publish(PERIOD,lower,2_900_000);
        require(vault.paidTo(PERIOD,USER)==32_000);vm.expectRevert();vault.pay(bytes32(uint256(11)),PERIOD,lower,USER,100,1);
    }
    function testRevocationPreservesExistingDistributionRights() public {
        vault.publish(PERIOD,RECORD,3_000_000);dojang.setVerified(USER,bytes32(uint256(5)),false);
        vault.pay(bytes32(uint256(7)),PERIOD,RECORD,USER,100,30_000);require(cash.balanceOf(USER)==30_000);
    }
    function testWrongRunAndSkippedRevisionAreRejected() public {
        bytes32 other=bytes32(uint256(20));registry.record(bytes32(uint256(99)),other,keccak256("wrong run"),bytes32(0));
        vm.expectRevert();vault.publish(PERIOD,other,3_000_000);
        vault.publish(PERIOD,RECORD,3_000_000);vm.expectRevert();vault.publish(PERIOD,RECORD,4_000_000);
        bytes32 skipped=bytes32(uint256(21));registry.record(RUN,skipped,keccak256("skipped"),bytes32(0));
        vm.expectRevert();vault.publish(PERIOD,skipped,4_000_000);
    }
}
