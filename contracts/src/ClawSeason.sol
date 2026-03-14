// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClawSeason
/// @notice Season system for the Claw Wars Colosseum. Tracks seasonal rankings,
///         distributes rewards, and manages season lifecycle.
contract ClawSeason is ReentrancyGuard {
    // -----------------------------------------------------------------------
    // Enums
    // -----------------------------------------------------------------------

    enum SeasonStatus {
        Upcoming,
        Active,
        Ended,
        RewardsDistributed
    }

    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct Season {
        uint256 id;
        string name;
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPool;
        SeasonStatus status;
        uint8 topRewardSlots; // how many top players get rewards (e.g., 10)
    }

    struct SeasonStats {
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 tournamentsWon;
        uint256 totalEarnings;
        uint256 seasonPoints; // points earned this season
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Point rewards per activity
    uint256 public constant POINTS_PER_GAME = 10;
    uint256 public constant POINTS_PER_WIN = 25;
    uint256 public constant POINTS_PER_TOURNAMENT_WIN = 100;
    uint256 public constant POINTS_PER_CORRECT_VOTE = 5;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address public operator;
    address public treasury;
    uint256 public nextSeasonId;
    uint256 public currentSeasonId;

    mapping(uint256 => Season) public seasons;

    /// @notice Per-season agent stats: seasonId => agent => stats
    mapping(uint256 => mapping(address => SeasonStats)) public seasonStats;

    /// @notice All agents that participated in a season
    mapping(uint256 => address[]) public seasonParticipants;
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    /// @notice Season reward claims
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    /// @notice Reward distribution: seasonId => rank => amount
    mapping(uint256 => mapping(uint8 => uint256)) public rewardByRank;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event SeasonCreated(uint256 indexed id, string name, uint256 startTime, uint256 endTime);
    event SeasonStarted(uint256 indexed id);
    event SeasonEnded(uint256 indexed id);
    event PointsAwarded(uint256 indexed seasonId, address indexed agent, uint256 points, string reason);
    event GameRecorded(uint256 indexed seasonId, address indexed agent, bool won);
    event TournamentWinRecorded(uint256 indexed seasonId, address indexed agent);
    event RewardsDistributed(uint256 indexed seasonId, uint256 totalRewards);
    event RewardClaimed(uint256 indexed seasonId, address indexed agent, uint8 rank, uint256 amount);

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
    // Season Lifecycle
    // -----------------------------------------------------------------------

    function createSeason(
        string calldata name,
        uint256 startTime,
        uint256 endTime,
        uint8 topRewardSlots
    ) external onlyOperator returns (uint256 id) {
        require(endTime > startTime, "Invalid duration");
        require(topRewardSlots >= 1 && topRewardSlots <= 50, "Invalid reward slots");

        id = nextSeasonId++;

        Season storage s = seasons[id];
        s.id = id;
        s.name = name;
        s.startTime = startTime;
        s.endTime = endTime;
        s.status = SeasonStatus.Upcoming;
        s.topRewardSlots = topRewardSlots;

        emit SeasonCreated(id, name, startTime, endTime);
    }

    function startSeason(uint256 seasonId) external onlyOperator {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.Upcoming, "Not upcoming");

        s.status = SeasonStatus.Active;
        currentSeasonId = seasonId;

        emit SeasonStarted(seasonId);
    }

    function endSeason(uint256 seasonId) external onlyOperator {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.Active, "Not active");

        s.status = SeasonStatus.Ended;

        emit SeasonEnded(seasonId);
    }

    /// @notice Fund the season reward pool. Can be called multiple times.
    function fundSeason(uint256 seasonId) external payable {
        require(msg.value > 0, "Must send ETH");
        Season storage s = seasons[seasonId];
        require(s.status != SeasonStatus.RewardsDistributed, "Already distributed");

        s.rewardPool += msg.value;
    }

    // -----------------------------------------------------------------------
    // Recording Game/Tournament Results
    // -----------------------------------------------------------------------

    /// @notice Record a game result for an agent in the current season.
    function recordGame(uint256 seasonId, address agent, bool won) external onlyOperator {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.Active, "Season not active");

        _ensureParticipant(seasonId, agent);

        SeasonStats storage stats = seasonStats[seasonId][agent];
        stats.gamesPlayed++;
        stats.seasonPoints += POINTS_PER_GAME;

        if (won) {
            stats.gamesWon++;
            stats.seasonPoints += POINTS_PER_WIN;
        }

        emit GameRecorded(seasonId, agent, won);
    }

    function recordTournamentWin(uint256 seasonId, address agent) external onlyOperator {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.Active, "Season not active");

        _ensureParticipant(seasonId, agent);

        SeasonStats storage stats = seasonStats[seasonId][agent];
        stats.tournamentsWon++;
        stats.seasonPoints += POINTS_PER_TOURNAMENT_WIN;

        emit TournamentWinRecorded(seasonId, agent);
    }

    function recordCorrectVote(uint256 seasonId, address agent) external onlyOperator {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.Active, "Season not active");

        _ensureParticipant(seasonId, agent);
        seasonStats[seasonId][agent].seasonPoints += POINTS_PER_CORRECT_VOTE;

        emit PointsAwarded(seasonId, agent, POINTS_PER_CORRECT_VOTE, "correct_vote");
    }

    function addBonusPoints(uint256 seasonId, address agent, uint256 points, string calldata reason) external onlyOperator {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.Active, "Season not active");

        _ensureParticipant(seasonId, agent);
        seasonStats[seasonId][agent].seasonPoints += points;

        emit PointsAwarded(seasonId, agent, points, reason);
    }

    // -----------------------------------------------------------------------
    // Reward Distribution
    // -----------------------------------------------------------------------

    /// @notice Operator sets reward amounts per rank and marks season as distributed.
    /// @param ranks Array of ranks (1-indexed).
    /// @param amounts Array of ETH amounts for each rank.
    function distributeRewards(uint256 seasonId, uint8[] calldata ranks, uint256[] calldata amounts) external onlyOperator {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.Ended, "Season not ended");
        require(ranks.length == amounts.length, "Length mismatch");

        uint256 totalRewards = 0;
        for (uint256 i = 0; i < ranks.length; i++) {
            require(ranks[i] >= 1 && ranks[i] <= s.topRewardSlots, "Invalid rank");
            rewardByRank[seasonId][ranks[i]] = amounts[i];
            totalRewards += amounts[i];
        }
        require(totalRewards <= s.rewardPool, "Exceeds reward pool");

        s.status = SeasonStatus.RewardsDistributed;

        emit RewardsDistributed(seasonId, totalRewards);
    }

    /// @notice Claim season reward. Operator must call with the agent's rank.
    function claimReward(uint256 seasonId, address agent, uint8 rank) external onlyOperator nonReentrant {
        Season storage s = seasons[seasonId];
        require(s.status == SeasonStatus.RewardsDistributed, "Not distributed");
        require(!hasClaimed[seasonId][agent], "Already claimed");

        uint256 amount = rewardByRank[seasonId][rank];
        require(amount > 0, "No reward for rank");

        hasClaimed[seasonId][agent] = true;

        (bool ok,) = agent.call{value: amount}("");
        require(ok, "Transfer failed");

        emit RewardClaimed(seasonId, agent, rank, amount);
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------

    function getSeasonStats(uint256 seasonId, address agent)
        external
        view
        returns (uint256 gamesPlayed, uint256 gamesWon, uint256 tournamentsWon, uint256 totalEarnings, uint256 seasonPoints)
    {
        SeasonStats storage s = seasonStats[seasonId][agent];
        return (s.gamesPlayed, s.gamesWon, s.tournamentsWon, s.totalEarnings, s.seasonPoints);
    }

    function getParticipants(uint256 seasonId) external view returns (address[] memory) {
        return seasonParticipants[seasonId];
    }

    function getParticipantCount(uint256 seasonId) external view returns (uint256) {
        return seasonParticipants[seasonId].length;
    }

    /// @notice Returns top agents by season points (simple selection sort).
    function getTopAgents(uint256 seasonId, uint256 count) external view returns (address[] memory, uint256[] memory) {
        address[] memory agents = seasonParticipants[seasonId];
        uint256 total = agents.length;
        if (count > total) count = total;

        uint256[] memory points = new uint256[](total);
        address[] memory sorted = new address[](total);
        for (uint256 i = 0; i < total; i++) {
            sorted[i] = agents[i];
            points[i] = seasonStats[seasonId][agents[i]].seasonPoints;
        }

        for (uint256 i = 0; i < count; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < total; j++) {
                if (points[j] > points[maxIdx]) maxIdx = j;
            }
            if (maxIdx != i) {
                (sorted[i], sorted[maxIdx]) = (sorted[maxIdx], sorted[i]);
                (points[i], points[maxIdx]) = (points[maxIdx], points[i]);
            }
        }

        address[] memory topAgents = new address[](count);
        uint256[] memory topPoints = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            topAgents[i] = sorted[i];
            topPoints[i] = points[i];
        }

        return (topAgents, topPoints);
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _ensureParticipant(uint256 seasonId, address agent) internal {
        if (!isParticipant[seasonId][agent]) {
            isParticipant[seasonId][agent] = true;
            seasonParticipants[seasonId].push(agent);
        }
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
