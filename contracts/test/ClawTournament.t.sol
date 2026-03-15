// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClawTournament.sol";

contract ClawTournamentTest is Test {
    ClawTournament public tournament;

    address public operator = address(this);
    address public treasury = makeAddr("treasury");

    address public player1 = makeAddr("player1");
    address public player2 = makeAddr("player2");
    address public player3 = makeAddr("player3");
    address public player4 = makeAddr("player4");

    uint256 public constant ENTRY_FEE = 1 ether;
    uint256 public constant REG_DURATION = 7 days;

    function setUp() public {
        tournament = new ClawTournament(operator, treasury);

        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);
        vm.deal(player4, 10 ether);
    }

    // -----------------------------------------------------------------------
    // Constructor Tests
    // -----------------------------------------------------------------------

    function test_constructor() public view {
        assertEq(tournament.operator(), operator);
        assertEq(tournament.treasury(), treasury);
        assertEq(tournament.nextTournamentId(), 0);
    }

    function test_constructor_revert_zeroOperator() public {
        vm.expectRevert("Zero operator");
        new ClawTournament(address(0), treasury);
    }

    function test_constructor_revert_zeroTreasury() public {
        vm.expectRevert("Zero treasury");
        new ClawTournament(operator, address(0));
    }

    // -----------------------------------------------------------------------
    // Create Tournament Tests
    // -----------------------------------------------------------------------

    function test_createTournament() public {
        uint256 id = tournament.createTournament("Season 1", ENTRY_FEE, 4, REG_DURATION, 0);
        assertEq(id, 0);

        (
            string memory name,
            uint256 entryFee,
            uint256 prizePool,
            uint8 maxParticipants,
            uint8 currentRound,
            uint8 totalRounds,
            ClawTournament.TournamentStatus status,
            uint256 arenaType
        ) = tournament.getTournamentInfo(id);

        assertEq(name, "Season 1");
        assertEq(entryFee, ENTRY_FEE);
        assertEq(prizePool, 0);
        assertEq(maxParticipants, 4);
        assertEq(currentRound, 0);
        assertEq(totalRounds, 2); // log2(4) = 2
        assertEq(uint8(status), uint8(ClawTournament.TournamentStatus.Registration));
        assertEq(arenaType, 0);
    }

    function test_createTournament_incrementsId() public {
        uint256 id1 = tournament.createTournament("T1", ENTRY_FEE, 4, REG_DURATION, 0);
        uint256 id2 = tournament.createTournament("T2", ENTRY_FEE, 8, REG_DURATION, 1);
        assertEq(id1, 0);
        assertEq(id2, 1);
    }

    function test_createTournament_revert_zeroEntryFee() public {
        vm.expectRevert("Entry fee must be > 0");
        tournament.createTournament("T", 0, 4, REG_DURATION, 0);
    }

    function test_createTournament_revert_invalidParticipantCount() public {
        // Not power of two
        vm.expectRevert("Invalid participant count");
        tournament.createTournament("T", ENTRY_FEE, 3, REG_DURATION, 0);

        // Too small (< 4)
        vm.expectRevert("Invalid participant count");
        tournament.createTournament("T", ENTRY_FEE, 2, REG_DURATION, 0);
    }

    function test_createTournament_revert_notOperator() public {
        vm.prank(player1);
        vm.expectRevert("Only operator");
        tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);
    }

    // -----------------------------------------------------------------------
    // Registration Tests
    // -----------------------------------------------------------------------

    function test_register() public {
        uint256 id = tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);

        vm.prank(player1);
        tournament.register{value: ENTRY_FEE}(id);

        assertEq(tournament.getParticipantCount(id), 1);
        assertTrue(tournament.isRegistered(id, player1));

        (, , uint256 prizePool, , , , ,) = tournament.getTournamentInfo(id);
        assertEq(prizePool, ENTRY_FEE);
    }

    function test_register_revert_wrongFee() public {
        uint256 id = tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);

        vm.prank(player1);
        vm.expectRevert("Wrong entry fee");
        tournament.register{value: 0.5 ether}(id);
    }

    function test_register_revert_alreadyRegistered() public {
        uint256 id = tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);

        vm.prank(player1);
        tournament.register{value: ENTRY_FEE}(id);

        vm.prank(player1);
        vm.expectRevert("Already registered");
        tournament.register{value: ENTRY_FEE}(id);
    }

    function test_register_revert_registrationClosed() public {
        uint256 id = tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);

        // Warp past deadline
        vm.warp(block.timestamp + REG_DURATION + 1);

        vm.prank(player1);
        vm.expectRevert("Registration closed");
        tournament.register{value: ENTRY_FEE}(id);
    }

    function test_register_revert_tournamentFull() public {
        uint256 id = _createAndFillTournament();

        address player5 = makeAddr("player5");
        vm.deal(player5, 10 ether);
        vm.prank(player5);
        vm.expectRevert("Tournament full");
        tournament.register{value: ENTRY_FEE}(id);
    }

    // -----------------------------------------------------------------------
    // Start Tournament Tests
    // -----------------------------------------------------------------------

    function test_startTournament() public {
        uint256 id = _createAndFillTournament();

        address[] memory seeded = new address[](4);
        seeded[0] = player1;
        seeded[1] = player2;
        seeded[2] = player3;
        seeded[3] = player4;

        tournament.startTournament(id, seeded);

        (, , , , uint8 currentRound, , ClawTournament.TournamentStatus status,) = tournament.getTournamentInfo(id);
        assertEq(uint8(status), uint8(ClawTournament.TournamentStatus.Active));
        assertEq(currentRound, 1);

        // Verify first round matches created
        (address p1, address p2, , , bool completed) = tournament.getMatch(id, 1, 0);
        assertEq(p1, player1);
        assertEq(p2, player2);
        assertFalse(completed);

        (p1, p2, , , completed) = tournament.getMatch(id, 1, 1);
        assertEq(p1, player3);
        assertEq(p2, player4);
        assertFalse(completed);
    }

    function test_startTournament_revert_notOperator() public {
        uint256 id = _createAndFillTournament();

        address[] memory seeded = new address[](4);
        seeded[0] = player1;
        seeded[1] = player2;
        seeded[2] = player3;
        seeded[3] = player4;

        vm.prank(player1);
        vm.expectRevert("Only operator");
        tournament.startTournament(id, seeded);
    }

    function test_startTournament_revert_notEnoughPlayers() public {
        uint256 id = tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);
        vm.prank(player1);
        tournament.register{value: ENTRY_FEE}(id);
        vm.prank(player2);
        tournament.register{value: ENTRY_FEE}(id);

        address[] memory seeded = new address[](2);
        seeded[0] = player1;
        seeded[1] = player2;

        vm.expectRevert("Not enough players");
        tournament.startTournament(id, seeded);
    }

    // -----------------------------------------------------------------------
    // Report Match Result & Tournament Completion
    // -----------------------------------------------------------------------

    function test_reportMatchResult() public {
        uint256 id = _createAndStartTournament();

        // Report match 0: player1 wins
        tournament.reportMatchResult(id, 1, 0, player1, 100);

        (, , address winner, uint256 gameId, bool completed) = tournament.getMatch(id, 1, 0);
        assertEq(winner, player1);
        assertEq(gameId, 100);
        assertTrue(completed);
    }

    function test_reportMatchResult_revert_winnerNotInMatch() public {
        uint256 id = _createAndStartTournament();

        vm.expectRevert("Winner not in match");
        tournament.reportMatchResult(id, 1, 0, player3, 100); // player3 is in match 1, not match 0
    }

    function test_reportMatchResult_revert_notOperator() public {
        uint256 id = _createAndStartTournament();

        vm.prank(player1);
        vm.expectRevert("Only operator");
        tournament.reportMatchResult(id, 1, 0, player1, 100);
    }

    function test_fullTournamentFlow() public {
        uint256 id = _createAndStartTournament();

        // Round 1: player1 beats player2, player3 beats player4
        tournament.reportMatchResult(id, 1, 0, player1, 100);
        tournament.reportMatchResult(id, 1, 1, player3, 101);

        // Round should have advanced to 2
        (, , , , uint8 currentRound, , ,) = tournament.getTournamentInfo(id);
        assertEq(currentRound, 2);

        // Final: player1 beats player3
        tournament.reportMatchResult(id, 2, 0, player1, 102);

        // Tournament completed
        (, , , , , , ClawTournament.TournamentStatus status,) = tournament.getTournamentInfo(id);
        assertEq(uint8(status), uint8(ClawTournament.TournamentStatus.Completed));

        // Check placements
        assertEq(tournament.placements(id, 1), player1); // champion
        assertEq(tournament.placements(id, 2), player3); // runner-up
    }

    // -----------------------------------------------------------------------
    // Cancel Tournament Tests
    // -----------------------------------------------------------------------

    function test_cancelTournament() public {
        uint256 id = tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);

        vm.prank(player1);
        tournament.register{value: ENTRY_FEE}(id);
        vm.prank(player2);
        tournament.register{value: ENTRY_FEE}(id);

        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;

        tournament.cancelTournament(id);

        // Players refunded
        assertEq(player1.balance - p1Before, ENTRY_FEE);
        assertEq(player2.balance - p2Before, ENTRY_FEE);

        (, , , , , , ClawTournament.TournamentStatus status,) = tournament.getTournamentInfo(id);
        assertEq(uint8(status), uint8(ClawTournament.TournamentStatus.Cancelled));
    }

    function test_cancelTournament_revert_notRegistration() public {
        uint256 id = _createAndStartTournament();

        vm.expectRevert("Can only cancel during registration");
        tournament.cancelTournament(id);
    }

    // -----------------------------------------------------------------------
    // Admin Tests
    // -----------------------------------------------------------------------

    function test_setOperator() public {
        tournament.setOperator(player1);
        assertEq(tournament.operator(), player1);
    }

    function test_setOperator_revert_zeroAddress() public {
        vm.expectRevert("Zero address");
        tournament.setOperator(address(0));
    }

    function test_setTreasury() public {
        tournament.setTreasury(player1);
        assertEq(tournament.treasury(), player1);
    }

    function test_setTreasury_revert_zeroAddress() public {
        vm.expectRevert("Zero address");
        tournament.setTreasury(address(0));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function _createAndFillTournament() internal returns (uint256 id) {
        id = tournament.createTournament("T", ENTRY_FEE, 4, REG_DURATION, 0);

        vm.prank(player1);
        tournament.register{value: ENTRY_FEE}(id);
        vm.prank(player2);
        tournament.register{value: ENTRY_FEE}(id);
        vm.prank(player3);
        tournament.register{value: ENTRY_FEE}(id);
        vm.prank(player4);
        tournament.register{value: ENTRY_FEE}(id);
    }

    function _createAndStartTournament() internal returns (uint256 id) {
        id = _createAndFillTournament();

        address[] memory seeded = new address[](4);
        seeded[0] = player1;
        seeded[1] = player2;
        seeded[2] = player3;
        seeded[3] = player4;

        tournament.startTournament(id, seeded);
    }
}
