// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IDojangScroll} from "./IDojangScroll.sol";

/// @notice Hackathon test units. No financial rights or redemption; all transfers disabled.
contract UpDishDemoUnits is ERC1155, Ownable {
    IDojangScroll public immutable scroll;
    bytes32 public immutable allowedAttester;
    uint256 public immutable offeringTokenId;
    uint256 public immutable cap;
    uint256 public minted;
    mapping(bytes32 => bool) public allocations;
    error InvalidConfiguration(); error NotVerified(); error DuplicateAllocation(); error NonTransferable(); error ExceedsCap();
    event AllocationMinted(bytes32 indexed allocationId,address indexed recipient,uint256 indexed tokenId,uint256 quantity);
    constructor(address operator,address scrollAddress,bytes32 attester,uint256 tokenId,uint256 maximum)
        ERC1155("") Ownable(operator) {
        if(scrollAddress.code.length==0||attester==bytes32(0)||maximum==0) revert InvalidConfiguration();
        scroll=IDojangScroll(scrollAddress);allowedAttester=attester;offeringTokenId=tokenId;cap=maximum;
    }
    function mintAllocation(bytes32 allocationId,address recipient,uint256 tokenId,uint256 quantity) external onlyOwner {
        if(allocationId==bytes32(0)||allocations[allocationId]) revert DuplicateAllocation();
        if(tokenId!=offeringTokenId||quantity==0||minted+quantity>cap) revert ExceedsCap();
        if(!scroll.isVerified(recipient,allowedAttester)) revert NotVerified();
        allocations[allocationId]=true;minted+=quantity;
        _mint(recipient,tokenId,quantity,"");emit AllocationMinted(allocationId,recipient,tokenId,quantity);
    }
    function setApprovalForAll(address operator,bool approved) public override {
        if(approved) revert NonTransferable();super.setApprovalForAll(operator,false);
    }
    function _update(address from,address to,uint256[] memory ids,uint256[] memory values) internal override {
        if(from!=address(0)) revert NonTransferable();super._update(from,to,ids,values);
    }
}
