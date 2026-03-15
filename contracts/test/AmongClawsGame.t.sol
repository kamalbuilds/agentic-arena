// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AmongClawsGame.sol";
import "../src/AmongClawsBetting.sol";
import "../src/AmongClawsLeaderboard.sol";

contract AmongClawsGameTest is Test {
    AmongClawsGame public game;
    AmongClawsBetting public betting;
    AmongClawsLeaderboard public leaderboard;

    address public operator = address(this);
    address public treasury = makeAddr("treasury");

    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public agent3 = makeAddr("agent3");
    address public agent4 = makeAddr("agent4");
    address public agent5 = makeAddr("agent5");

    uint256 public constant STAKE = 1 ether;

    function setUp() public {
        game = new AmongClawsGame(operator, treasury);
        betting = new AmongClawsBetting(operator, treasury);
        leaderboard = new AmongClawsLeaderboard(operator);

        // Fund agents.
        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);
        vm.deal(agent3, 10 ether);
        vm.deal(agent4, 10 ether);
        vm.deal(agent5, 10 ether);
    }

    // -----------------------------------------------------------------------
    // Game Creation Tests
    // -----------------------------------------------------------------------

    function test_createGame() public {
        uint256 gameId = game.createGame(STAKE, 3, 5, 1, 3);
        assertEq(gameId, 0);

        (address creator, uint256 stakeAmount, uint256 pot, AmongClawsGame.Phase phase,,,,) = game.getGameInfo(gameId);
        assertEq(creator, address(this));
        assertEq(stakeAmount, STAKE);
        assertEq(pot, 0);
        assertEq(uint8(phase), uint8(AmongClawsGame.Phase.Lobby));
    }

    function test_createGame_incrementsId() public {
        uint256 id1 = game.createGame(STAKE, 3, 5, 1, 3);
        uint256 id2 = game.createGame(STAKE, 3, 5, 1, 3);
        assertEq(id1, 0);
        assertEq(id2, 1);
    }

    function test_createGame_revert_zeroStake() public {
        vm.expectRevert("Stake must be > 0");
        game.createGame(0, 3, 5, 1, 3);
    }

    function test_createGame_revert_tooFewPlayers() public {
        vm.expectRevert("Min 3 players");
        game.createGame(STAKE, 2, 5, 1, 3);
    }

    function test_createGame_revert_maxLessThanMin() public {
        vm.expectRevert("Max >= min");
        game.createGame(STAKE, 5, 3, 1, 3);
    }

    function test_createGame_revert_tooManyPlayers() public {
        vm.expectRevert("Max 15 players");
        game.createGame(STAKE, 3, 16, 1, 3);
    }

    function test_createGame_revert_tooManyImpostors() public {
        vm.expectRevert("Too many impostors");
        game.createGame(STAKE, 3, 5, 3, 3);
    }

    function test_createGame_revert_zeroRounds() public {
        vm.expectRevert("Need >= 1 round");
        game.createGame(STAKE, 3, 5, 1, 0);
    }

    // -----------------------------------------------------------------------
    // Join Game Tests
    // -----------------------------------------------------------------------

    function test_joinGame() public {
        uint256 gameId = game.createGame(STAKE, 3, 5, 1, 3);

        vm.prank(agent1);
        game.joinGame{value: STAKE}(gameId);

        assertEq(game.getPlayerCount(gameId), 1);
        assertTrue(game.isPlayer(gameId, agent1));

        (, , uint256 pot, , , , ,) = game.getGameInfo(gameId);
        assertEq(pot, STAKE);
    }

    function test_joinGame_multipleAgents() public {
        uint256 gameId = game.createGame(STAKE, 3, 5, 1, 3);

        vm.prank(agent1);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent2);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent3);
        game.joinGame{value: STAKE}(gameId);

        assertEq(game.getPlayerCount(gameId), 3);
        (, , uint256 pot, , , , ,) = game.getGameInfo(gameId);
        assertEq(pot, STAKE * 3);
    }

    function test_joinGame_revert_wrongStake() public {
        uint256 gameId = game.createGame(STAKE, 3, 5, 1, 3);

        vm.prank(agent1);
        vm.expectRevert("Wrong stake amount");
        game.joinGame{value: 0.5 ether}(gameId);
    }

    function test_joinGame_revert_alreadyJoined() public {
        uint256 gameId = game.createGame(STAKE, 3, 5, 1, 3);

        vm.prank(agent1);
        game.joinGame{value: STAKE}(gameId);

        vm.prank(agent1);
        vm.expectRevert("Already joined");
        game.joinGame{value: STAKE}(gameId);
    }

    function test_joinGame_revert_gameFull() public {
        uint256 gameId = game.createGame(STAKE, 3, 3, 1, 3); // max 3

        vm.prank(agent1);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent2);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent3);
        game.joinGame{value: STAKE}(gameId);

        vm.prank(agent4);
        vm.expectRevert("Game full");
        game.joinGame{value: STAKE}(gameId);
    }

    // -----------------------------------------------------------------------
    // Start Game Tests
    // -----------------------------------------------------------------------

    function test_startGame() public {
        uint256 gameId = _createAndFillGame();

        game.startGame(gameId);

        (, , , AmongClawsGame.Phase phase, uint8 roundNumber, uint8 totalAlive, uint8 totalImpostorsAlive,) =
            game.getGameInfo(gameId);
        assertEq(uint8(phase), uint8(AmongClawsGame.Phase.Active));
        assertEq(roundNumber, 1);
        assertEq(totalAlive, 4);
        assertEq(totalImpostorsAlive, 1);
    }

    function test_startGame_revert_notOperator() public {
        uint256 gameId = _createAndFillGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.startGame(gameId);
    }

    function test_startGame_revert_notEnoughPlayers() public {
        uint256 gameId = game.createGame(STAKE, 3, 5, 1, 3);

        vm.prank(agent1);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent2);
        game.joinGame{value: STAKE}(gameId);
        // Only 2 players, need 3 minimum.

        vm.expectRevert("Not enough players");
        game.startGame(gameId);
    }

    // -----------------------------------------------------------------------
    // Commit Roles Tests
    // -----------------------------------------------------------------------

    function test_commitRoles() public {
        uint256 gameId = _createAndStartGame();

        address[] memory agents = new address[](4);
        agents[0] = agent1;
        agents[1] = agent2;
        agents[2] = agent3;
        agents[3] = agent4;

        bytes32[] memory commitments = new bytes32[](4);
        bytes32 salt = keccak256("secret_salt");
        commitments[0] = keccak256(abi.encodePacked(agent1, AmongClawsGame.Role.Lobster, salt));
        commitments[1] = keccak256(abi.encodePacked(agent2, AmongClawsGame.Role.Lobster, salt));
        commitments[2] = keccak256(abi.encodePacked(agent3, AmongClawsGame.Role.Lobster, salt));
        commitments[3] = keccak256(abi.encodePacked(agent4, AmongClawsGame.Role.Impostor, salt));

        game.commitRoles(gameId, agents, commitments);

        assertEq(game.roleCommitments(gameId, agent1), commitments[0]);
        assertEq(game.roleCommitments(gameId, agent4), commitments[3]);
    }

    function test_commitRoles_revert_notOperator() public {
        uint256 gameId = _createAndStartGame();

        address[] memory agents = new address[](0);
        bytes32[] memory commitments = new bytes32[](0);

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.commitRoles(gameId, agents, commitments);
    }

    function test_commitRoles_revert_lengthMismatch() public {
        uint256 gameId = _createAndStartGame();

        address[] memory agents = new address[](2);
        bytes32[] memory commitments = new bytes32[](1);

        vm.expectRevert("Length mismatch");
        game.commitRoles(gameId, agents, commitments);
    }

    // -----------------------------------------------------------------------
    // Voting Flow Tests
    // -----------------------------------------------------------------------

    function test_votingFlow() public {
        uint256 gameId = _createAndStartGame();
        _commitAllRoles(gameId);

        // Advance to Voting phase.
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);

        // Agents cast votes.
        vm.prank(agent1);
        game.castVote(gameId, agent4);
        vm.prank(agent2);
        game.castVote(gameId, agent4);
        vm.prank(agent3);
        game.castVote(gameId, agent4);

        // Verify votes recorded.
        assertEq(game.votes(gameId, agent1), agent4);
        assertTrue(game.hasVoted(gameId, agent1));

        // Resolve: eliminate agent4.
        game.resolveVote(gameId, agent4);
        assertTrue(game.eliminated(gameId, agent4));

        (, , , , , uint8 totalAlive, ,) = game.getGameInfo(gameId);
        assertEq(totalAlive, 3);
    }

    function test_castVote_revert_notVotingPhase() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Not voting phase");
        game.castVote(gameId, agent4);
    }

    function test_castVote_revert_notPlayer() public {
        uint256 gameId = _createAndStartGame();
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);

        address nonPlayer = makeAddr("nonPlayer");
        vm.prank(nonPlayer);
        vm.expectRevert("Not a player");
        game.castVote(gameId, agent4);
    }

    function test_castVote_revert_voteSelf() public {
        uint256 gameId = _createAndStartGame();
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);

        vm.prank(agent1);
        vm.expectRevert("Cannot vote for self");
        game.castVote(gameId, agent1);
    }

    function test_castVote_revert_doubleVote() public {
        uint256 gameId = _createAndStartGame();
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);

        vm.prank(agent1);
        game.castVote(gameId, agent4);

        vm.prank(agent1);
        vm.expectRevert("Already voted");
        game.castVote(gameId, agent4);
    }

    function test_castVote_revert_eliminatedVoter() public {
        uint256 gameId = _createAndStartGame();
        _commitAllRoles(gameId);
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);

        // Eliminate agent1 first.
        game.resolveVote(gameId, agent1);

        vm.prank(agent1);
        vm.expectRevert("You are eliminated");
        game.castVote(gameId, agent4);
    }

    function test_castVote_revert_eliminatedTarget() public {
        uint256 gameId = _createAndStartGame();
        _commitAllRoles(gameId);
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);

        // Eliminate agent4 first.
        game.resolveVote(gameId, agent4);

        vm.prank(agent1);
        vm.expectRevert("Target already eliminated");
        game.castVote(gameId, agent4);
    }

    // -----------------------------------------------------------------------
    // Role Reveal Tests
    // -----------------------------------------------------------------------

    function test_revealRole() public {
        uint256 gameId = _createAndStartGame();
        bytes32 salt = keccak256("secret_salt");
        _commitAllRoles(gameId);

        // Reveal agent4 as impostor.
        game.revealRole(gameId, agent4, AmongClawsGame.Role.Impostor, salt);
        assertEq(uint8(game.revealedRoles(gameId, agent4)), uint8(AmongClawsGame.Role.Impostor));
    }

    function test_revealRole_revert_invalidReveal() public {
        uint256 gameId = _createAndStartGame();
        bytes32 salt = keccak256("secret_salt");
        _commitAllRoles(gameId);

        // Try to reveal agent1 as Impostor (but committed as Lobster).
        vm.expectRevert("Invalid reveal");
        game.revealRole(gameId, agent1, AmongClawsGame.Role.Impostor, salt);
    }

    // -----------------------------------------------------------------------
    // Prize Claiming Tests
    // -----------------------------------------------------------------------

    function test_claimPrize_lobstersWin() public {
        uint256 gameId = _setupCompletedGame_LobstersWin();

        uint256 pot = STAKE * 4; // 4 ether
        uint256 fee = (pot * 500) / 10_000; // 0.2 ether
        uint256 prizePool = pot - fee; // 3.8 ether
        // 3 surviving lobsters win.
        uint256 sharePerWinner = prizePool / 3;

        uint256 agent1BalBefore = agent1.balance;
        uint256 treasuryBalBefore = treasury.balance;

        // First winner claims (triggers fee transfer).
        vm.prank(agent1);
        game.claimPrize(gameId);

        assertEq(treasury.balance - treasuryBalBefore, fee);
        assertEq(agent1.balance - agent1BalBefore, sharePerWinner);

        // Second winner claims.
        uint256 agent2BalBefore = agent2.balance;
        vm.prank(agent2);
        game.claimPrize(gameId);
        assertEq(agent2.balance - agent2BalBefore, sharePerWinner);

        // Third winner claims.
        uint256 agent3BalBefore = agent3.balance;
        vm.prank(agent3);
        game.claimPrize(gameId);
        assertEq(agent3.balance - agent3BalBefore, sharePerWinner);
    }

    function test_claimPrize_revert_notWinner() public {
        uint256 gameId = _setupCompletedGame_LobstersWin();

        // agent4 was the impostor - not a winner when lobsters win.
        vm.prank(agent4);
        vm.expectRevert("Not a winner");
        game.claimPrize(gameId);
    }

    function test_claimPrize_revert_doubleClaim() public {
        uint256 gameId = _setupCompletedGame_LobstersWin();

        vm.prank(agent1);
        game.claimPrize(gameId);

        vm.prank(agent1);
        vm.expectRevert("Already claimed");
        game.claimPrize(gameId);
    }

    function test_claimPrize_revert_gameNotEnded() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Game not ended");
        game.claimPrize(gameId);
    }

    // -----------------------------------------------------------------------
    // Protocol Fee Tests
    // -----------------------------------------------------------------------

    function test_protocolFee() public {
        uint256 gameId = _setupCompletedGame_LobstersWin();

        uint256 pot = STAKE * 4;
        uint256 expectedFee = (pot * 500) / 10_000; // 5% = 0.2 ether

        uint256 treasuryBefore = treasury.balance;

        vm.prank(agent1);
        game.claimPrize(gameId);

        assertEq(treasury.balance - treasuryBefore, expectedFee);
    }

    function test_protocolFee_onlyOnFirstClaim() public {
        uint256 gameId = _setupCompletedGame_LobstersWin();

        uint256 treasuryBefore = treasury.balance;

        vm.prank(agent1);
        game.claimPrize(gameId);

        uint256 treasuryAfterFirst = treasury.balance;
        assertTrue(treasuryAfterFirst > treasuryBefore);

        vm.prank(agent2);
        game.claimPrize(gameId);

        // Treasury balance should not change on second claim.
        assertEq(treasury.balance, treasuryAfterFirst);
    }

    // -----------------------------------------------------------------------
    // Emergency Refund Tests
    // -----------------------------------------------------------------------

    function test_emergencyRefund() public {
        uint256 gameId = _createAndFillGame();
        game.startGame(gameId);

        uint256 agent1Before = agent1.balance;
        uint256 agent2Before = agent2.balance;
        uint256 agent3Before = agent3.balance;
        uint256 agent4Before = agent4.balance;

        game.emergencyRefund(gameId);

        uint256 refundPer = STAKE; // 4 ether / 4 players = 1 ether each
        assertEq(agent1.balance - agent1Before, refundPer);
        assertEq(agent2.balance - agent2Before, refundPer);
        assertEq(agent3.balance - agent3Before, refundPer);
        assertEq(agent4.balance - agent4Before, refundPer);

        // Game should be ended.
        (, , , AmongClawsGame.Phase phase, , , ,) = game.getGameInfo(gameId);
        assertEq(uint8(phase), uint8(AmongClawsGame.Phase.Ended));
    }

    function test_emergencyRefund_revert_notOperator() public {
        uint256 gameId = _createAndFillGame();
        game.startGame(gameId);

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.emergencyRefund(gameId);
    }

    function test_emergencyRefund_revert_alreadyEnded() public {
        uint256 gameId = _setupCompletedGame_LobstersWin();

        vm.expectRevert("Already ended");
        game.emergencyRefund(gameId);
    }

    // -----------------------------------------------------------------------
    // Access Control Tests
    // -----------------------------------------------------------------------

    function test_onlyOperator_startGame() public {
        uint256 gameId = _createAndFillGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.startGame(gameId);
    }

    function test_onlyOperator_commitRoles() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.commitRoles(gameId, new address[](0), new bytes32[](0));
    }

    function test_onlyOperator_advancePhase() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);
    }

    function test_onlyOperator_resolveVote() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.resolveVote(gameId, agent4);
    }

    function test_onlyOperator_revealRole() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.revealRole(gameId, agent4, AmongClawsGame.Role.Impostor, bytes32(0));
    }

    function test_onlyOperator_endGame() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.endGame(gameId, AmongClawsGame.GameResult.LobstersWin);
    }

    function test_onlyOperator_emergencyRefund() public {
        uint256 gameId = _createAndStartGame();

        vm.prank(agent1);
        vm.expectRevert("Only operator");
        game.emergencyRefund(gameId);
    }

    // -----------------------------------------------------------------------
    // Phase Transition Tests
    // -----------------------------------------------------------------------

    function test_advancePhase() public {
        uint256 gameId = _createAndStartGame();

        game.advancePhase(gameId, AmongClawsGame.Phase.Discussion, 120);
        (, , , AmongClawsGame.Phase phase, , , ,) = game.getGameInfo(gameId);
        assertEq(uint8(phase), uint8(AmongClawsGame.Phase.Discussion));

        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);
        (, , , phase, , , ,) = game.getGameInfo(gameId);
        assertEq(uint8(phase), uint8(AmongClawsGame.Phase.Voting));
    }

    function test_advancePhase_revert_fromLobby() public {
        uint256 gameId = game.createGame(STAKE, 3, 5, 1, 3);

        vm.expectRevert("Still in lobby");
        game.advancePhase(gameId, AmongClawsGame.Phase.Active, 60);
    }

    function test_advancePhase_revert_alreadyEnded() public {
        uint256 gameId = _setupCompletedGame_LobstersWin();

        vm.expectRevert("Already ended");
        game.advancePhase(gameId, AmongClawsGame.Phase.Active, 60);
    }

    // -----------------------------------------------------------------------
    // End Game Tests
    // -----------------------------------------------------------------------

    function test_endGame() public {
        uint256 gameId = _createAndStartGame();

        game.endGame(gameId, AmongClawsGame.GameResult.LobstersWin);

        (, , , AmongClawsGame.Phase phase, , , , AmongClawsGame.GameResult result) = game.getGameInfo(gameId);
        assertEq(uint8(phase), uint8(AmongClawsGame.Phase.Ended));
        assertEq(uint8(result), uint8(AmongClawsGame.GameResult.LobstersWin));
    }

    function test_endGame_revert_invalidResult() public {
        uint256 gameId = _createAndStartGame();

        vm.expectRevert("Invalid result");
        game.endGame(gameId, AmongClawsGame.GameResult.None);
    }

    // -----------------------------------------------------------------------
    // Impostor Wins Prize Test
    // -----------------------------------------------------------------------

    function test_claimPrize_impostorWins() public {
        uint256 gameId = _setupCompletedGame_ImpostorWins();

        // agent4 is the impostor and should be the winner.
        uint256 pot = STAKE * 4;
        uint256 fee = (pot * 500) / 10_000;
        uint256 prizePool = pot - fee;
        // 1 impostor wins.
        uint256 share = prizePool / 1;

        uint256 agent4BalBefore = agent4.balance;

        vm.prank(agent4);
        game.claimPrize(gameId);

        assertEq(agent4.balance - agent4BalBefore, share);

        // Lobsters should not be able to claim.
        vm.prank(agent1);
        vm.expectRevert("Not a winner");
        game.claimPrize(gameId);
    }

    // -----------------------------------------------------------------------
    // Betting Contract Tests
    // -----------------------------------------------------------------------

    function test_placeBet() public {
        vm.prank(agent1);
        betting.placeBet{value: 0.5 ether}(0, 0, address(0));

        assertEq(betting.getBetCount(0), 1);
        (uint256 lp, uint256 ip, uint256 sp) = betting.getPoolSizes(0);
        assertEq(lp, 0.5 ether);
        assertEq(ip, 0);
        assertEq(sp, 0);
    }

    function test_placeBet_multipleBettors() public {
        vm.prank(agent1);
        betting.placeBet{value: 0.5 ether}(0, 0, address(0)); // LobstersWin
        vm.prank(agent2);
        betting.placeBet{value: 1 ether}(0, 1, address(0)); // ImpostorWins
        vm.prank(agent3);
        betting.placeBet{value: 0.3 ether}(0, 2, agent4); // SpecificAgent

        assertEq(betting.getBetCount(0), 3);
        (uint256 lp, uint256 ip, uint256 sp) = betting.getPoolSizes(0);
        assertEq(lp, 0.5 ether);
        assertEq(ip, 1 ether);
        assertEq(sp, 0.3 ether);
    }

    function test_settleBets_lobstersWin() public {
        vm.prank(agent1);
        betting.placeBet{value: 1 ether}(0, 0, address(0)); // LobstersWin - winner
        vm.prank(agent2);
        betting.placeBet{value: 1 ether}(0, 1, address(0)); // ImpostorWins - loser

        uint256 agent1Before = agent1.balance;
        uint256 treasuryBefore = treasury.balance;

        betting.settleBets(0, AmongClawsBetting.GameResult.LobstersWin, address(0));

        // Total pool = 2 ether. Fee = 3% = 0.06 ether. Distributable = 1.94 ether.
        // agent1 is sole winner, gets entire distributable.
        uint256 totalPool = 2 ether;
        uint256 fee = (totalPool * 300) / 10_000;
        uint256 distributable = totalPool - fee;

        assertEq(agent1.balance - agent1Before, distributable);
        assertEq(treasury.balance - treasuryBefore, fee);
    }

    function test_settleBets_revert_notOperator() public {
        vm.prank(agent1);
        vm.expectRevert("Only operator");
        betting.settleBets(0, AmongClawsBetting.GameResult.LobstersWin, address(0));
    }

    // -----------------------------------------------------------------------
    // Leaderboard Tests
    // -----------------------------------------------------------------------

    function test_updateStats() public {
        leaderboard.updateStats(agent1, true, false, 1 ether);

        (uint256 gp, uint256 gw, , , , uint256 earnings, uint256 elo) = leaderboard.getAgentStats(agent1);
        assertEq(gp, 1);
        assertEq(gw, 1);
        assertEq(earnings, 1 ether);
        assertEq(elo, 1000); // Starting ELO.
    }

    function test_updateElo() public {
        // First ensure both agents are tracked.
        leaderboard.updateStats(agent1, true, false, 0);
        leaderboard.updateStats(agent2, false, false, 0);

        leaderboard.updateElo(agent1, agent2, false);

        (, , , , , , uint256 winnerElo) = leaderboard.getAgentStats(agent1);
        (, , , , , , uint256 loserElo) = leaderboard.getAgentStats(agent2);

        // Both start at 1000. Equal ELO means expected = 0.5.
        // Winner gains K/2 = 16, loser loses 16.
        assertEq(winnerElo, 1016);
        assertEq(loserElo, 984);
    }

    function test_getTopAgents() public {
        leaderboard.updateStats(agent1, true, false, 0);
        leaderboard.updateStats(agent2, true, false, 0);
        leaderboard.updateStats(agent3, true, false, 0);

        // Give agent2 highest ELO.
        leaderboard.updateElo(agent2, agent1, false);
        leaderboard.updateElo(agent2, agent3, false);

        (address[] memory topAddrs, uint256[] memory topElos) = leaderboard.getTopAgents(2);

        assertEq(topAddrs.length, 2);
        assertEq(topAddrs[0], agent2); // Highest ELO.
        assertTrue(topElos[0] > topElos[1]);
    }

    function test_leaderboard_onlyOperator() public {
        vm.prank(agent1);
        vm.expectRevert("Only operator");
        leaderboard.updateStats(agent1, true, false, 0);
    }

    // -----------------------------------------------------------------------
    // Admin Tests
    // -----------------------------------------------------------------------

    function test_setOperator() public {
        game.setOperator(agent1);
        assertEq(game.operator(), agent1);
    }

    function test_setOperator_revert_zeroAddress() public {
        vm.expectRevert("Zero address");
        game.setOperator(address(0));
    }

    function test_setTreasury() public {
        game.setTreasury(agent1);
        assertEq(game.treasury(), agent1);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function _createAndFillGame() internal returns (uint256 gameId) {
        gameId = game.createGame(STAKE, 3, 5, 1, 3);
        vm.prank(agent1);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent2);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent3);
        game.joinGame{value: STAKE}(gameId);
        vm.prank(agent4);
        game.joinGame{value: STAKE}(gameId);
    }

    function _createAndStartGame() internal returns (uint256 gameId) {
        gameId = _createAndFillGame();
        game.startGame(gameId);
    }

    function _commitAllRoles(uint256 gameId) internal {
        bytes32 salt = keccak256("secret_salt");

        address[] memory agents = new address[](4);
        agents[0] = agent1;
        agents[1] = agent2;
        agents[2] = agent3;
        agents[3] = agent4;

        bytes32[] memory commitments = new bytes32[](4);
        commitments[0] = keccak256(abi.encodePacked(agent1, AmongClawsGame.Role.Lobster, salt));
        commitments[1] = keccak256(abi.encodePacked(agent2, AmongClawsGame.Role.Lobster, salt));
        commitments[2] = keccak256(abi.encodePacked(agent3, AmongClawsGame.Role.Lobster, salt));
        commitments[3] = keccak256(abi.encodePacked(agent4, AmongClawsGame.Role.Impostor, salt));

        game.commitRoles(gameId, agents, commitments);
    }

    /// @dev Sets up a completed game where lobsters win.
    ///      agent1, agent2, agent3 = Lobsters (alive), agent4 = Impostor (eliminated).
    function _setupCompletedGame_LobstersWin() internal returns (uint256 gameId) {
        gameId = _createAndStartGame();
        bytes32 salt = keccak256("secret_salt");
        _commitAllRoles(gameId);

        // Vote out impostor.
        game.advancePhase(gameId, AmongClawsGame.Phase.Voting, 60);
        vm.prank(agent1);
        game.castVote(gameId, agent4);
        vm.prank(agent2);
        game.castVote(gameId, agent4);
        vm.prank(agent3);
        game.castVote(gameId, agent4);

        game.resolveVote(gameId, agent4);

        // Reveal all roles.
        game.revealRole(gameId, agent1, AmongClawsGame.Role.Lobster, salt);
        game.revealRole(gameId, agent2, AmongClawsGame.Role.Lobster, salt);
        game.revealRole(gameId, agent3, AmongClawsGame.Role.Lobster, salt);
        game.revealRole(gameId, agent4, AmongClawsGame.Role.Impostor, salt);

        // End game.
        game.endGame(gameId, AmongClawsGame.GameResult.LobstersWin);
    }

    /// @dev Sets up a completed game where impostor wins.
    ///      agent4 = Impostor (wins), agent1, agent2, agent3 = Lobsters.
    function _setupCompletedGame_ImpostorWins() internal returns (uint256 gameId) {
        gameId = _createAndStartGame();
        bytes32 salt = keccak256("secret_salt");
        _commitAllRoles(gameId);

        // Reveal all roles.
        game.revealRole(gameId, agent1, AmongClawsGame.Role.Lobster, salt);
        game.revealRole(gameId, agent2, AmongClawsGame.Role.Lobster, salt);
        game.revealRole(gameId, agent3, AmongClawsGame.Role.Lobster, salt);
        game.revealRole(gameId, agent4, AmongClawsGame.Role.Impostor, salt);

        // End game - impostor wins.
        game.endGame(gameId, AmongClawsGame.GameResult.ImpostorWins);
    }
}
