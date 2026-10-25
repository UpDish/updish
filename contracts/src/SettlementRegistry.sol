// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
/// @notice Public digest only; private manifests/salts and individual amounts stay off chain.
contract SettlementRegistry is Ownable {
    struct Record {bytes32 runId;bytes32 digest;bytes32 previous;}
    mapping(bytes32 => Record) public records;
    error InvalidRecord();
    event SettlementRecorded(bytes32 indexed runId,bytes32 indexed recordId,bytes32 digest,bytes32 previous);
    constructor(address operator) Ownable(operator) {}
    function record(bytes32 runId,bytes32 recordId,bytes32 digest,bytes32 previous) external onlyOwner {
        if(runId==bytes32(0)||recordId==bytes32(0)||digest==bytes32(0)||records[recordId].digest!=bytes32(0)) revert InvalidRecord();
        if(previous!=bytes32(0)&&(records[previous].digest==bytes32(0)||records[previous].runId!=runId)) revert InvalidRecord();
        records[recordId]=Record(runId,digest,previous);emit SettlementRecorded(runId,recordId,digest,previous);
    }
}
