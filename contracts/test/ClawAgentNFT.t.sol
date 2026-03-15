// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClawAgentNFT.sol";

contract ClawAgentNFTTest is Test {
    ClawAgentNFT public nft;

    address public operator = address(this);
    address public treasury = makeAddr("treasury");

    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public agent3 = makeAddr("agent3");

    uint256 public constant MINT_FEE = 0.1 ether;

    function setUp() public {
        nft = new ClawAgentNFT(operator, treasury);

        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);
        vm.deal(agent3, 10 ether);
    }

    // -----------------------------------------------------------------------
    // Constructor Tests
    // -----------------------------------------------------------------------

    function test_constructor() public view {
        assertEq(nft.operator(), operator);
        assertEq(nft.treasury(), treasury);
        assertEq(nft.nextTokenId(), 0);
        assertEq(nft.name(), "Claw Agent");
        assertEq(nft.symbol(), "CLAW-AGENT");
    }

    function test_constructor_revert_zeroOperator() public {
        vm.expectRevert("Zero operator");
        new ClawAgentNFT(address(0), treasury);
    }

    function test_constructor_revert_zeroTreasury() public {
        vm.expectRevert("Zero treasury");
        new ClawAgentNFT(operator, address(0));
    }

    // -----------------------------------------------------------------------
    // Minting Tests
    // -----------------------------------------------------------------------

    function test_mintAgent() public {
        vm.prank(agent1);
        nft.mintAgent{value: MINT_FEE}("AgentAlpha");

        assertTrue(nft.hasNFT(agent1));
        assertEq(nft.nextTokenId(), 1);
        assertEq(nft.ownerOf(0), agent1);

        (
            address agentAddress,
            string memory name,
            ClawAgentNFT.Tier tier,
            uint256 totalWins,
            uint256 totalGames,
            uint256 tournamentWins,
            uint256 seasonTitles,
            uint256 mintedAt,
            string memory arenaSpecialty
        ) = nft.getProfile(0);

        assertEq(agentAddress, agent1);
        assertEq(name, "AgentAlpha");
        assertEq(uint8(tier), uint8(ClawAgentNFT.Tier.Bronze));
        assertEq(totalWins, 0);
        assertEq(totalGames, 0);
        assertEq(tournamentWins, 0);
        assertEq(seasonTitles, 0);
        assertEq(mintedAt, block.timestamp);
        assertEq(arenaSpecialty, "");
    }

    function test_mintAgent_sendsFeeToTreasury() public {
        uint256 treasuryBefore = treasury.balance;

        vm.prank(agent1);
        nft.mintAgent{value: MINT_FEE}("Agent1");

        assertEq(treasury.balance - treasuryBefore, MINT_FEE);
    }

    function test_mintAgent_revert_alreadyHasNFT() public {
        vm.prank(agent1);
        nft.mintAgent{value: MINT_FEE}("Agent1");

        vm.prank(agent1);
        vm.expectRevert("Agent already has NFT");
        nft.mintAgent{value: MINT_FEE}("Agent1Again");
    }

    function test_mintAgent_revert_insufficientFee() public {
        vm.prank(agent1);
        vm.expectRevert("Insufficient mint fee");
        nft.mintAgent{value: 0.05 ether}("Agent1");
    }

    function test_mintAgent_revert_emptyName() public {
        vm.prank(agent1);
        vm.expectRevert("Invalid name length");
        nft.mintAgent{value: MINT_FEE}("");
    }

    function test_mintAgent_revert_nameTooLong() public {
        vm.prank(agent1);
        vm.expectRevert("Invalid name length");
        nft.mintAgent{value: MINT_FEE}("ThisNameIsWayTooLongForAnAgentXX!");  // 33 chars
    }

    function test_mintAgent_incrementsTokenId() public {
        vm.prank(agent1);
        nft.mintAgent{value: MINT_FEE}("A1");
        vm.prank(agent2);
        nft.mintAgent{value: MINT_FEE}("A2");

        assertEq(nft.nextTokenId(), 2);
        assertEq(nft.agentToToken(agent1), 0);
        assertEq(nft.agentToToken(agent2), 1);
    }

    // -----------------------------------------------------------------------
    // Stats Update Tests
    // -----------------------------------------------------------------------

    function test_updateGameStats_win() public {
        _mintForAgent(agent1);

        nft.updateGameStats(agent1, true);

        (, , , uint256 totalWins, uint256 totalGames, , , ,) = nft.getProfile(0);
        assertEq(totalWins, 1);
        assertEq(totalGames, 1);
    }

    function test_updateGameStats_loss() public {
        _mintForAgent(agent1);

        nft.updateGameStats(agent1, false);

        (, , , uint256 totalWins, uint256 totalGames, , , ,) = nft.getProfile(0);
        assertEq(totalWins, 0);
        assertEq(totalGames, 1);
    }

    function test_updateGameStats_revert_noNFT() public {
        vm.expectRevert("No NFT");
        nft.updateGameStats(agent1, true);
    }

    function test_updateGameStats_revert_notOperator() public {
        _mintForAgent(agent1);

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        nft.updateGameStats(agent1, true);
    }

    // -----------------------------------------------------------------------
    // Tier Evolution Tests
    // -----------------------------------------------------------------------

    function test_tierEvolution_toSilver() public {
        _mintForAgent(agent1);

        // 10 wins -> Silver
        for (uint256 i = 0; i < 10; i++) {
            nft.updateGameStats(agent1, true);
        }

        (, , ClawAgentNFT.Tier tier, , , , , ,) = nft.getProfile(0);
        assertEq(uint8(tier), uint8(ClawAgentNFT.Tier.Silver));
    }

    function test_tierEvolution_toGold() public {
        _mintForAgent(agent1);

        // 25 wins -> Gold
        for (uint256 i = 0; i < 25; i++) {
            nft.updateGameStats(agent1, true);
        }

        (, , ClawAgentNFT.Tier tier, , , , , ,) = nft.getProfile(0);
        assertEq(uint8(tier), uint8(ClawAgentNFT.Tier.Gold));
    }

    function test_tierEvolution_toChampion() public {
        _mintForAgent(agent1);

        nft.recordTournamentWin(agent1);

        (, , ClawAgentNFT.Tier tier, , , uint256 tournamentWins, , ,) = nft.getProfile(0);
        assertEq(uint8(tier), uint8(ClawAgentNFT.Tier.Champion));
        assertEq(tournamentWins, 1);
    }

    // -----------------------------------------------------------------------
    // Season Title Tests
    // -----------------------------------------------------------------------

    function test_recordSeasonTitle() public {
        _mintForAgent(agent1);

        nft.recordSeasonTitle(agent1);

        (, , , , , , uint256 seasonTitles, ,) = nft.getProfile(0);
        assertEq(seasonTitles, 1);
    }

    function test_recordSeasonTitle_revert_noNFT() public {
        vm.expectRevert("No NFT");
        nft.recordSeasonTitle(agent1);
    }

    function test_recordSeasonTitle_revert_notOperator() public {
        _mintForAgent(agent1);

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        nft.recordSeasonTitle(agent1);
    }

    // -----------------------------------------------------------------------
    // Arena Specialty Tests
    // -----------------------------------------------------------------------

    function test_setArenaSpecialty() public {
        _mintForAgent(agent1);

        nft.setArenaSpecialty(agent1, "Social Deduction");

        (, , , , , , , , string memory specialty) = nft.getProfile(0);
        assertEq(specialty, "Social Deduction");
    }

    // -----------------------------------------------------------------------
    // View Functions Tests
    // -----------------------------------------------------------------------

    function test_getAgentToken() public {
        _mintForAgent(agent1);

        uint256 tokenId = nft.getAgentToken(agent1);
        assertEq(tokenId, 0);
    }

    function test_getAgentToken_revert_noNFT() public {
        vm.expectRevert("No NFT");
        nft.getAgentToken(agent1);
    }

    function test_totalSupply() public {
        assertEq(nft.totalSupply(), 0);

        _mintForAgent(agent1);
        assertEq(nft.totalSupply(), 1);

        _mintForAgent(agent2);
        assertEq(nft.totalSupply(), 2);
    }

    // -----------------------------------------------------------------------
    // Admin Tests
    // -----------------------------------------------------------------------

    function test_setBaseURI() public {
        nft.setBaseURI("https://api.clawwars.com/metadata/");
        // The baseTokenURI should be set (verified via tokenURI on a minted token)
        _mintForAgent(agent1);
        assertEq(nft.tokenURI(0), "https://api.clawwars.com/metadata/0");
    }

    function test_setOperator() public {
        nft.setOperator(agent1);
        assertEq(nft.operator(), agent1);
    }

    function test_setOperator_revert_zeroAddress() public {
        vm.expectRevert("Zero address");
        nft.setOperator(address(0));
    }

    function test_setTreasury() public {
        nft.setTreasury(agent1);
        assertEq(nft.treasury(), agent1);
    }

    function test_setTreasury_revert_zeroAddress() public {
        vm.expectRevert("Zero address");
        nft.setTreasury(address(0));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function _mintForAgent(address agent) internal {
        vm.prank(agent);
        nft.mintAgent{value: MINT_FEE}(string(abi.encodePacked("Agent_", _addrToStr(agent))));
    }

    function _addrToStr(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(4);
        for (uint256 i = 0; i < 4; i++) {
            uint8 b = uint8(uint160(addr) >> (8 * (19 - i)));
            s[i] = bytes1(b == 0 ? uint8(0x41) : b); // avoid null bytes
        }
        return string(s);
    }
}
