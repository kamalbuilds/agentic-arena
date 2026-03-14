// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClawTournament
/// @notice Tournament system for the Claw Wars Colosseum. Supports single-elimination brackets
///         with entry fees, prize pools, and automatic bracket progression.
contract ClawTournament is ReentrancyGuard {
    // -----------------------------------------------------------------------
    // Enums
    // -----------------------------------------------------------------------

    enum TournamentStatus {
        Registration,
        Active,
        Completed,
        Cancelled
    }

    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct Tournament {
        uint256 id;
        string name;
        address creator;
        uint256 entryFee;
        uint256 prizePool;
        uint8 maxParticipants; // must be power of 2: 4, 8, 16, 32
        uint8 currentRound;
        uint8 totalRounds;
        TournamentStatus status;
        uint256 registrationDeadline;
        uint256 arenaType; // 0 = social deduction, 1+ = future arenas
    }

    struct Match {
        uint256 tournamentId;
        uint8 round;
        uint8 matchIndex;
        address player1;
        address player2;
        address winner;
        uint256 gameId; // linked AmongClawsGame ID
        bool completed;
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    uint256 public constant PROTOCOL_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // Prize distribution: 1st = 60%, 2nd = 25%, 3rd/4th = 7.5% each
    uint256 public constant FIRST_PLACE_BPS = 6000;
    uint256 public constant SECOND_PLACE_BPS = 2500;
    uint256 public constant THIRD_PLACE_BPS = 750;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address public operator;
    address public treasury;
    uint256 public nextTournamentId;

    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => address[]) public participants;
    mapping(uint256 => mapping(address => bool)) public isRegistered;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    /// @notice Bracket matches: tournamentId => round => matchIndex => Match
    mapping(uint256 => mapping(uint8 => mapping(uint8 => Match))) public brackets;

    /// @notice Final placements: tournamentId => placement (1-4) => address
    mapping(uint256 => mapping(uint8 => address)) public placements;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event TournamentCreated(uint256 indexed id, string name, uint256 entryFee, uint8 maxParticipants, uint256 arenaType);
    event PlayerRegistered(uint256 indexed id, address indexed player);
    event TournamentStarted(uint256 indexed id, uint8 totalRounds);
    event MatchCreated(uint256 indexed id, uint8 round, uint8 matchIndex, address player1, address player2);
    event MatchCompleted(uint256 indexed id, uint8 round, uint8 matchIndex, address winner, uint256 gameId);
    event RoundAdvanced(uint256 indexed id, uint8 newRound);
    event TournamentCompleted(uint256 indexed id, address champion);
    event PrizeClaimed(uint256 indexed id, address indexed player, uint8 placement, uint256 amount);
    event TournamentCancelled(uint256 indexed id);

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
        _;
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor(address _operator, address _treasury) {
        require(_operator != address(0), "Zero operator");
        require(_treasury != address(0), "Zero treasury");
        operator = _operator;
        treasury = _treasury;
    }

    // -----------------------------------------------------------------------
    // Tournament Lifecycle
    // -----------------------------------------------------------------------

    /// @notice Create a new tournament.
    function createTournament(
        string calldata name,
        uint256 entryFee,
        uint8 maxParticipants,
        uint256 registrationDuration,
        uint256 arenaType
    ) external onlyOperator returns (uint256 id) {
        require(entryFee > 0, "Entry fee must be > 0");
        require(_isPowerOfTwo(maxParticipants) && maxParticipants >= 4 && maxParticipants <= 32, "Invalid participant count");

        id = nextTournamentId++;

        Tournament storage t = tournaments[id];
        t.id = id;
        t.name = name;
        t.creator = msg.sender;
        t.entryFee = entryFee;
        t.maxParticipants = maxParticipants;
        t.totalRounds = _log2(maxParticipants);
        t.status = TournamentStatus.Registration;
        t.registrationDeadline = block.timestamp + registrationDuration;
        t.arenaType = arenaType;

        emit TournamentCreated(id, name, entryFee, maxParticipants, arenaType);
    }

    /// @notice Register for a tournament by paying the entry fee.
    function register(uint256 tournamentId) external payable {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Registration, "Not in registration");
        require(block.timestamp <= t.registrationDeadline, "Registration closed");
        require(!isRegistered[tournamentId][msg.sender], "Already registered");
        require(participants[tournamentId].length < t.maxParticipants, "Tournament full");
        require(msg.value == t.entryFee, "Wrong entry fee");

        participants[tournamentId].push(msg.sender);
        isRegistered[tournamentId][msg.sender] = true;
        t.prizePool += msg.value;

        emit PlayerRegistered(tournamentId, msg.sender);
    }

    /// @notice Operator starts the tournament and seeds the bracket.
    /// @param tournamentId The tournament to start.
    /// @param seededPlayers Players in seeded order (shuffled off-chain for fairness).
    function startTournament(uint256 tournamentId, address[] calldata seededPlayers) external onlyOperator {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Registration, "Not in registration");

        uint256 playerCount = participants[tournamentId].length;
        require(playerCount == t.maxParticipants, "Not enough players");
        require(seededPlayers.length == playerCount, "Seed mismatch");

        // Verify all seeded players are registered
        for (uint256 i = 0; i < seededPlayers.length; i++) {
            require(isRegistered[tournamentId][seededPlayers[i]], "Player not registered");
        }

        t.status = TournamentStatus.Active;
        t.currentRound = 1;

        // Create first round matches
        uint8 matchCount = uint8(playerCount / 2);
        for (uint8 i = 0; i < matchCount; i++) {
            brackets[tournamentId][1][i] = Match({
                tournamentId: tournamentId,
                round: 1,
                matchIndex: i,
                player1: seededPlayers[i * 2],
                player2: seededPlayers[i * 2 + 1],
                winner: address(0),
                gameId: 0,
                completed: false
            });

            emit MatchCreated(tournamentId, 1, i, seededPlayers[i * 2], seededPlayers[i * 2 + 1]);
        }

        emit TournamentStarted(tournamentId, t.totalRounds);
    }

    /// @notice Operator reports match result and links it to a game.
    function reportMatchResult(
        uint256 tournamentId,
        uint8 round,
        uint8 matchIndex,
        address winner,
        uint256 gameId
    ) external onlyOperator {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Active, "Not active");
        require(round == t.currentRound, "Wrong round");

        Match storage m = brackets[tournamentId][round][matchIndex];
        require(!m.completed, "Match already completed");
        require(winner == m.player1 || winner == m.player2, "Winner not in match");

        m.winner = winner;
        m.gameId = gameId;
        m.completed = true;

        emit MatchCompleted(tournamentId, round, matchIndex, winner, gameId);

        // Check if all matches in current round are complete
        if (_isRoundComplete(tournamentId, round, t)) {
            if (round == t.totalRounds) {
                // Tournament is over
                _finalizeTournament(tournamentId, t, round);
            } else {
                // Advance to next round
                _advanceRound(tournamentId, t, round);
            }
        }
    }

    /// @notice Winner claims their prize.
    function claimPrize(uint256 tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Completed, "Not completed");
        require(isRegistered[tournamentId][msg.sender], "Not registered");
        require(!hasClaimed[tournamentId][msg.sender], "Already claimed");

        uint8 placement = _getPlacement(tournamentId, msg.sender);
        require(placement >= 1 && placement <= 4, "No prize");

        hasClaimed[tournamentId][msg.sender] = true;

        uint256 fee = (t.prizePool * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributable = t.prizePool - fee;

        uint256 prizeBps;
        if (placement == 1) prizeBps = FIRST_PLACE_BPS;
        else if (placement == 2) prizeBps = SECOND_PLACE_BPS;
        else prizeBps = THIRD_PLACE_BPS; // 3rd and 4th

        uint256 amount = (distributable * prizeBps) / BPS_DENOMINATOR;

        // Send protocol fee on first claim
        if (_claimedCount(tournamentId) == 1) {
            (bool feeOk,) = treasury.call{value: fee}("");
            require(feeOk, "Fee transfer failed");
        }

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Prize transfer failed");

        emit PrizeClaimed(tournamentId, msg.sender, placement, amount);
    }

    /// @notice Operator cancels a tournament (only during registration). Refunds all.
    function cancelTournament(uint256 tournamentId) external onlyOperator nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Registration, "Can only cancel during registration");

        t.status = TournamentStatus.Cancelled;

        address[] storage players = participants[tournamentId];
        for (uint256 i = 0; i < players.length; i++) {
            if (t.entryFee > 0) {
                (bool ok,) = players[i].call{value: t.entryFee}("");
                require(ok, "Refund failed");
            }
        }

        emit TournamentCancelled(tournamentId);
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------

    function getParticipants(uint256 tournamentId) external view returns (address[] memory) {
        return participants[tournamentId];
    }

    function getParticipantCount(uint256 tournamentId) external view returns (uint256) {
        return participants[tournamentId].length;
    }

    function getMatch(uint256 tournamentId, uint8 round, uint8 matchIndex)
        external
        view
        returns (address player1, address player2, address winner, uint256 gameId, bool completed)
    {
        Match storage m = brackets[tournamentId][round][matchIndex];
        return (m.player1, m.player2, m.winner, m.gameId, m.completed);
    }

    function getTournamentInfo(uint256 tournamentId)
        external
        view
        returns (
            string memory name,
            uint256 entryFee,
            uint256 prizePool,
            uint8 maxParticipants,
            uint8 currentRound,
            uint8 totalRounds,
            TournamentStatus status,
            uint256 arenaType
        )
    {
        Tournament storage t = tournaments[tournamentId];
        return (t.name, t.entryFee, t.prizePool, t.maxParticipants, t.currentRound, t.totalRounds, t.status, t.arenaType);
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _isRoundComplete(uint256 tournamentId, uint8 round, Tournament storage t) internal view returns (bool) {
        uint8 matchesInRound = uint8(t.maxParticipants / (2 ** round));
        for (uint8 i = 0; i < matchesInRound; i++) {
            if (!brackets[tournamentId][round][i].completed) {
                return false;
            }
        }
        return true;
    }

    function _advanceRound(uint256 tournamentId, Tournament storage t, uint8 completedRound) internal {
        uint8 nextRound = completedRound + 1;
        t.currentRound = nextRound;

        uint8 prevMatchCount = uint8(t.maxParticipants / (2 ** completedRound));
        uint8 newMatchCount = prevMatchCount / 2;

        for (uint8 i = 0; i < newMatchCount; i++) {
            address winner1 = brackets[tournamentId][completedRound][i * 2].winner;
            address winner2 = brackets[tournamentId][completedRound][i * 2 + 1].winner;

            brackets[tournamentId][nextRound][i] = Match({
                tournamentId: tournamentId,
                round: nextRound,
                matchIndex: i,
                player1: winner1,
                player2: winner2,
                winner: address(0),
                gameId: 0,
                completed: false
            });

            emit MatchCreated(tournamentId, nextRound, i, winner1, winner2);
        }

        emit RoundAdvanced(tournamentId, nextRound);
    }

    function _finalizeTournament(uint256 tournamentId, Tournament storage t, uint8 finalRound) internal {
        t.status = TournamentStatus.Completed;

        Match storage finalMatch = brackets[tournamentId][finalRound][0];
        address champion = finalMatch.winner;
        address runnerUp = finalMatch.winner == finalMatch.player1 ? finalMatch.player2 : finalMatch.player1;

        placements[tournamentId][1] = champion;
        placements[tournamentId][2] = runnerUp;

        // 3rd/4th from semifinal losers (if more than 1 round)
        if (finalRound > 1) {
            uint8 semiRound = finalRound - 1;
            Match storage semi1 = brackets[tournamentId][semiRound][0];
            Match storage semi2 = brackets[tournamentId][semiRound][1];

            address third = semi1.winner == finalMatch.player1 || semi1.winner == finalMatch.player2
                ? (semi1.winner == semi1.player1 ? semi1.player2 : semi1.player1)
                : (semi2.winner == semi2.player1 ? semi2.player2 : semi2.player1);

            address fourth = semi2.winner == finalMatch.player1 || semi2.winner == finalMatch.player2
                ? (semi2.winner == semi2.player1 ? semi2.player2 : semi2.player1)
                : (semi1.winner == semi1.player1 ? semi1.player2 : semi1.player1);

            placements[tournamentId][3] = third;
            placements[tournamentId][4] = fourth;
        }

        emit TournamentCompleted(tournamentId, champion);
    }

    function _getPlacement(uint256 tournamentId, address player) internal view returns (uint8) {
        for (uint8 i = 1; i <= 4; i++) {
            if (placements[tournamentId][i] == player) return i;
        }
        return 0;
    }

    function _claimedCount(uint256 tournamentId) internal view returns (uint256 count) {
        address[] storage players = participants[tournamentId];
        for (uint256 i = 0; i < players.length; i++) {
            if (hasClaimed[tournamentId][players[i]]) count++;
        }
    }

    function _isPowerOfTwo(uint8 n) internal pure returns (bool) {
        return n > 0 && (n & (n - 1)) == 0;
    }

    function _log2(uint8 n) internal pure returns (uint8) {
        uint8 result = 0;
        while (n > 1) {
            n >>= 1;
            result++;
        }
        return result;
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    function setOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "Zero address");
        operator = newOperator;
    }

    function setTreasury(address newTreasury) external onlyOperator {
        require(newTreasury != address(0), "Zero address");
        treasury = newTreasury;
    }

    receive() external payable {}
}
