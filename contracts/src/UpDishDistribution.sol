// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SettlementRegistry} from "./SettlementRegistry.sol";

/// @notice Test-asset distribution. The operator confirms offchain sales; this is not a sales oracle.
contract UpDishDistribution is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable cash;
    IERC1155 public immutable units;
    SettlementRegistry public immutable registry;
    bytes32 public immutable runId;
    uint256 public immutable tokenId;
    uint256 public immutable cap;

    struct Period { bytes32 recordId; uint256 pool; uint256 funded; uint256 totalPaid; }
    mapping(bytes32 => Period) public periods;
    mapping(bytes32 => mapping(address => uint256)) public paidTo;
    mapping(bytes32 => bool) public published;
    mapping(bytes32 => uint256) public publishedPool;
    mapping(bytes32 => bool) public payments;
    error InvalidConfiguration();
    error InvalidRecord();
    error InvalidPayment();
    error ExceedsEntitlement();
    event DistributionFunded(bytes32 indexed periodId, bytes32 indexed recordId, uint256 pool, uint256 deposited);
    event DistributionPaid(bytes32 indexed paymentId, bytes32 indexed periodId, address indexed recipient, bytes32 recordId, uint256 amount);

    constructor(address operator, address cashAddress, address unitsAddress, address registryAddress,
        bytes32 run, uint256 offeringTokenId, uint256 maximum) Ownable(operator) {
        if(cashAddress.code.length==0 || unitsAddress.code.length==0 || registryAddress.code.length==0 || run==bytes32(0) || maximum==0) revert InvalidConfiguration();
        cash=IERC20(cashAddress); units=IERC1155(unitsAddress); registry=SettlementRegistry(registryAddress);
        runId=run; tokenId=offeringTokenId; cap=maximum;
    }

    /// @dev Revisions carry earlier payments forward. Lower corrections never erase or claw back receipts.
    function publish(bytes32 periodId, bytes32 recordId, uint256 pool) external onlyOwner nonReentrant {
        (bytes32 recordedRun, bytes32 digest, bytes32 previous)=registry.records(recordId);
        Period storage p=periods[periodId];
        if(periodId==bytes32(0) || recordedRun!=runId || digest==bytes32(0) || published[recordId]
            || (p.recordId!=bytes32(0) && previous!=p.recordId)) revert InvalidRecord();
        uint256 required=pool>p.totalPaid ? pool-p.totalPaid : 0;
        uint256 available=p.funded-p.totalPaid;
        uint256 deposited=required>available ? required-available : 0;
        p.recordId=recordId; p.pool=pool; p.funded+=deposited;
        published[recordId]=true; publishedPool[recordId]=pool;
        if(deposited>0) cash.safeTransferFrom(msg.sender,address(this),deposited);
        emit DistributionFunded(periodId,recordId,pool,deposited);
    }

    function pay(bytes32 paymentId, bytes32 periodId, bytes32 recordId, address recipient, uint256 heldUnits, uint256 amount)
        external onlyOwner nonReentrant {
        Period storage p=periods[periodId];
        if(paymentId==bytes32(0) || payments[paymentId] || recipient==address(0) || amount==0
            || p.recordId==bytes32(0) || p.recordId!=recordId || heldUnits==0 || heldUnits>cap
            || units.balanceOf(recipient,tokenId)!=heldUnits) revert InvalidPayment();
        // One-unit rounding allowance supports the ledger's largest-remainder rule; the global pool remains a hard limit.
        uint256 entitlement=Math.mulDiv(p.pool,heldUnits,cap,Math.Rounding.Ceil);
        if(paidTo[periodId][recipient]+amount>entitlement || p.totalPaid+amount>p.pool
            || p.totalPaid+amount>p.funded) revert ExceedsEntitlement();
        payments[paymentId]=true; paidTo[periodId][recipient]+=amount; p.totalPaid+=amount;
        cash.safeTransfer(recipient,amount);
        emit DistributionPaid(paymentId,periodId,recipient,recordId,amount);
    }
}
