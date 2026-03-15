// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClawSeason.sol";

contract ClawSeasonTest is Test {
    ClawSeason public season;

    address public operator = address(this);
    address public treasury = makeAddr("treasury");

    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public agent3 = makeAddr("agent3");

    function setUp() public {
        season = new ClawSeason(operator, treasury);

        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);
        vm.deal(agent3, 10 ether);
        vm.deal(address(this), 100 ether);
    }

    // -----------------------------------------------------------------------
    // Constructor Tests
    // -----------------------------------------------------------------------

    function test_constructor() public view {
        assertEq(season.operator(), operator);
        assertEq(season.treasury(), treasury);
        assertEq(season.nextSeasonId(), 0);
    }

    function test_constructor_revert_zeroOperator() public {
        vm.expectRevert("Zero operator");
        new ClawSeason(address(0), treasury);
    }

    function test_constructor_revert_zeroTreasury() public {
        vm.expectRevert("Zero treasury");
        new ClawSeason(operator, address(0));
    }

    // -----------------------------------------------------------------------
    // Season Lifecycle Tests
    // -----------------------------------------------------------------------

    function test_createSeason() public {
        uint256 start = block.timestamp + 1 days;
        uint256 end_ = start + 30 days;
        uint256 id = season.createSeason("Season 1", start, end_, 10);
        assertEq(id, 0);

        (
            uint256 sId,
            string memory name,
            uint256 startTime,
            uint256 endTime,
            ,
            ClawSeason.SeasonStatus status,
            uint8 topRewardSlots
        ) = season.seasons(id);

        assertEq(sId, 0);
        assertEq(name, "Season 1");
        assertEq(startTime, start);
        assertEq(endTime, end_);
        assertEq(uint8(status), uint8(ClawSeason.SeasonStatus.Upcoming));
        assertEq(topRewardSlots, 10);
    }

    function test_createSeason_incrementsId() public {
        uint256 id1 = season.createSeason("S1", block.timestamp + 1, block.timestamp + 100, 5);
        uint256 id2 = season.createSeason("S2", block.timestamp + 1, block.timestamp + 100, 5);
        assertEq(id1, 0);
        assertEq(id2, 1);
    }

    function test_createSeason_revert_invalidDuration() public {
        vm.expectRevert("Invalid duration");
        season.createSeason("S", block.timestamp + 100, block.timestamp + 50, 5);
    }

    function test_createSeason_revert_invalidRewardSlots() public {
        vm.expectRevert("Invalid reward slots");
        season.createSeason("S", block.timestamp + 1, block.timestamp + 100, 0);

        vm.expectRevert("Invalid reward slots");
        season.createSeason("S", block.timestamp + 1, block.timestamp + 100, 51);
    }

    function test_createSeason_revert_notOperator() public {
        vm.prank(agent1);
        vm.expectRevert("Only operator");
        season.createSeason("S", block.timestamp + 1, block.timestamp + 100, 5);
    }

    function test_startSeason() public {
        uint256 id = _createSeason();
        season.startSeason(id);

        (, , , , , ClawSeason.SeasonStatus status,) = season.seasons(id);
        assertEq(uint8(status), uint8(ClawSeason.SeasonStatus.Active));
        assertEq(season.currentSeasonId(), id);
    }

    function test_startSeason_revert_notUpcoming() public {
        uint256 id = _createAndStartSeason();

        vm.expectRevert("Not upcoming");
        season.startSeason(id);
    }

    function test_endSeason() public {
        uint256 id = _createAndStartSeason();
        season.endSeason(id);

        (, , , , , ClawSeason.SeasonStatus status,) = season.seasons(id);
        assertEq(uint8(status), uint8(ClawSeason.SeasonStatus.Ended));
    }

    function test_endSeason_revert_notActive() public {
        uint256 id = _createSeason();

        vm.expectRevert("Not active");
        season.endSeason(id);
    }

    // -----------------------------------------------------------------------
    // Fund Season Tests
    // -----------------------------------------------------------------------

    function test_fundSeason() public {
        uint256 id = _createSeason();

        season.fundSeason{value: 5 ether}(id);

        (, , , , uint256 rewardPool, ,) = season.seasons(id);
        assertEq(rewardPool, 5 ether);
    }

    function test_fundSeason_revert_zeroValue() public {
        uint256 id = _createSeason();

        vm.expectRevert("Must send ETH");
        season.fundSeason{value: 0}(id);
    }

    // -----------------------------------------------------------------------
    // Record Game/Tournament Results Tests
    // -----------------------------------------------------------------------

    function test_recordGame_win() public {
        uint256 id = _createAndStartSeason();

        season.recordGame(id, agent1, true);

        (uint256 gamesPlayed, uint256 gamesWon, , , uint256 seasonPoints) = season.getSeasonStats(id, agent1);
        assertEq(gamesPlayed, 1);
        assertEq(gamesWon, 1);
        // POINTS_PER_GAME (10) + POINTS_PER_WIN (25) = 35
        assertEq(seasonPoints, 35);
    }

    function test_recordGame_loss() public {
        uint256 id = _createAndStartSeason();

        season.recordGame(id, agent1, false);

        (uint256 gamesPlayed, uint256 gamesWon, , , uint256 seasonPoints) = season.getSeasonStats(id, agent1);
        assertEq(gamesPlayed, 1);
        assertEq(gamesWon, 0);
        // Only POINTS_PER_GAME (10)
        assertEq(seasonPoints, 10);
    }

    function test_recordGame_revert_notActive() public {
        uint256 id = _createSeason();

        vm.expectRevert("Season not active");
        season.recordGame(id, agent1, true);
    }

    function test_recordGame_revert_notOperator() public {
        uint256 id = _createAndStartSeason();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        season.recordGame(id, agent1, true);
    }

    function test_recordTournamentWin() public {
        uint256 id = _createAndStartSeason();

        season.recordTournamentWin(id, agent1);

        (, , uint256 tournamentsWon, , uint256 seasonPoints) = season.getSeasonStats(id, agent1);
        assertEq(tournamentsWon, 1);
        assertEq(seasonPoints, 100); // POINTS_PER_TOURNAMENT_WIN
    }

    function test_recordCorrectVote() public {
        uint256 id = _createAndStartSeason();

        // First must be a participant via a game record
        season.recordGame(id, agent1, false);
        season.recordCorrectVote(id, agent1);

        (, , , , uint256 seasonPoints) = season.getSeasonStats(id, agent1);
        // 10 (game) + 5 (correct vote) = 15
        assertEq(seasonPoints, 15);
    }

    function test_addBonusPoints() public {
        uint256 id = _createAndStartSeason();

        season.recordGame(id, agent1, false); // adds 10 points
        season.addBonusPoints(id, agent1, 50, "special_event");

        (, , , , uint256 seasonPoints) = season.getSeasonStats(id, agent1);
        assertEq(seasonPoints, 60); // 10 + 50
    }

    // -----------------------------------------------------------------------
    // Reward Distribution Tests
    // -----------------------------------------------------------------------

    function test_distributeRewards() public {
        uint256 id = _createAndStartSeason();

        season.fundSeason{value: 10 ether}(id);
        season.endSeason(id);

        uint8[] memory ranks = new uint8[](2);
        ranks[0] = 1;
        ranks[1] = 2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 6 ether;
        amounts[1] = 3 ether;

        season.distributeRewards(id, ranks, amounts);

        (, , , , , ClawSeason.SeasonStatus status,) = season.seasons(id);
        assertEq(uint8(status), uint8(ClawSeason.SeasonStatus.RewardsDistributed));

        assertEq(season.rewardByRank(id, 1), 6 ether);
        assertEq(season.rewardByRank(id, 2), 3 ether);
    }

    function test_distributeRewards_revert_exceedsPool() public {
        uint256 id = _createAndStartSeason();
        season.fundSeason{value: 5 ether}(id);
        season.endSeason(id);

        uint8[] memory ranks = new uint8[](1);
        ranks[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 6 ether; // exceeds 5 ether pool

        vm.expectRevert("Exceeds reward pool");
        season.distributeRewards(id, ranks, amounts);
    }

    function test_distributeRewards_revert_notEnded() public {
        uint256 id = _createAndStartSeason();

        uint8[] memory ranks = new uint8[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.expectRevert("Season not ended");
        season.distributeRewards(id, ranks, amounts);
    }

    // -----------------------------------------------------------------------
    // Claim Reward Tests
    // -----------------------------------------------------------------------

    function test_claimReward() public {
        uint256 id = _setupDistributedSeason();

        uint256 agent1Before = agent1.balance;
        season.claimReward(id, agent1, 1);

        assertEq(agent1.balance - agent1Before, 6 ether);
        assertTrue(season.hasClaimed(id, agent1));
    }

    function test_claimReward_revert_doubleClaim() public {
        uint256 id = _setupDistributedSeason();

        season.claimReward(id, agent1, 1);

        vm.expectRevert("Already claimed");
        season.claimReward(id, agent1, 1);
    }

    function test_claimReward_revert_notDistributed() public {
        uint256 id = _createAndStartSeason();

        vm.expectRevert("Not distributed");
        season.claimReward(id, agent1, 1);
    }

    // -----------------------------------------------------------------------
    // View Functions Tests
    // -----------------------------------------------------------------------

    function test_getTopAgents() public {
        uint256 id = _createAndStartSeason();

        // agent1: 2 wins = 2*(10+25) = 70 points
        season.recordGame(id, agent1, true);
        season.recordGame(id, agent1, true);

        // agent2: 1 win, 1 loss = (10+25) + 10 = 45 points
        season.recordGame(id, agent2, true);
        season.recordGame(id, agent2, false);

        // agent3: 1 loss = 10 points
        season.recordGame(id, agent3, false);

        (address[] memory topAgents, uint256[] memory topPoints) = season.getTopAgents(id, 2);

        assertEq(topAgents.length, 2);
        assertEq(topAgents[0], agent1); // highest
        assertEq(topAgents[1], agent2);
        assertEq(topPoints[0], 70);
        assertEq(topPoints[1], 45);
    }

    function test_getParticipants() public {
        uint256 id = _createAndStartSeason();

        season.recordGame(id, agent1, true);
        season.recordGame(id, agent2, false);

        address[] memory participants = season.getParticipants(id);
        assertEq(participants.length, 2);
        assertEq(season.getParticipantCount(id), 2);
    }

    // -----------------------------------------------------------------------
    // Admin Tests
    // -----------------------------------------------------------------------

    function test_setOperator() public {
        season.setOperator(agent1);
        assertEq(season.operator(), agent1);
    }

    function test_setOperator_revert_zeroAddress() public {
        vm.expectRevert("Zero address");
        season.setOperator(address(0));
    }

    function test_setTreasury() public {
        season.setTreasury(agent1);
        assertEq(season.treasury(), agent1);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function _createSeason() internal returns (uint256 id) {
        id = season.createSeason("Test Season", block.timestamp + 1, block.timestamp + 30 days, 10);
    }

    function _createAndStartSeason() internal returns (uint256 id) {
        id = _createSeason();
        season.startSeason(id);
    }

    function _setupDistributedSeason() internal returns (uint256 id) {
        id = _createAndStartSeason();

        season.fundSeason{value: 10 ether}(id);
        season.endSeason(id);

        uint8[] memory ranks = new uint8[](2);
        ranks[0] = 1;
        ranks[1] = 2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 6 ether;
        amounts[1] = 3 ether;

        season.distributeRewards(id, ranks, amounts);
    }
}
