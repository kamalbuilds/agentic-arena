// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AmongClawsLeaderboard
/// @notice Tracks agent statistics and ELO ratings for Among Claws games.
contract AmongClawsLeaderboard {
    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct AgentStats {
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 timesImpostor;
        uint256 impostorWins;
        uint256 correctVotes;
        uint256 totalEarnings;
        uint256 eloRating;
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Starting ELO rating for new agents.
    uint256 public constant STARTING_ELO = 1000;

    /// @notice K-factor for ELO calculation.
    uint256 public constant K_FACTOR = 32;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address public operator;

    /// @notice Stats for each agent.
    mapping(address => AgentStats) public agentStats;

    /// @notice List of all agents that have played (for leaderboard iteration).
    address[] public allAgents;

    /// @notice Quick check if agent is already tracked.
    mapping(address => bool) public isTracked;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event StatsUpdated(address indexed agent, uint256 gamesPlayed, uint256 gamesWon, uint256 eloRating);
    event EloUpdated(address indexed winner, address indexed loser, uint256 winnerElo, uint256 loserElo);

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

    constructor(address _operator) {
        require(_operator != address(0), "Zero operator");
        operator = _operator;
    }

    // -----------------------------------------------------------------------
    // External Functions
    // -----------------------------------------------------------------------

    /// @notice Operator updates agent stats after a game concludes.
    function updateStats(address agent, bool won, bool wasImpostor, uint256 earned) external onlyOperator {
        require(agent != address(0), "Zero address");

        _ensureTracked(agent);

        AgentStats storage s = agentStats[agent];
        s.gamesPlayed++;
        if (won) {
            s.gamesWon++;
        }
        if (wasImpostor) {
            s.timesImpostor++;
            if (won) {
                s.impostorWins++;
            }
        }
        s.totalEarnings += earned;

        emit StatsUpdated(agent, s.gamesPlayed, s.gamesWon, s.eloRating);
    }

    /// @notice Operator records a correct vote for an agent.
    function recordCorrectVote(address agent) external onlyOperator {
        require(agent != address(0), "Zero address");
        _ensureTracked(agent);
        agentStats[agent].correctVotes++;
    }

    /// @notice Updates ELO ratings for a winner/loser pair.
    /// @param winner The winning agent.
    /// @param loser The losing agent.
    function updateElo(address winner, address loser, bool /*impostorWin*/) external onlyOperator {
        require(winner != address(0) && loser != address(0), "Zero address");

        _ensureTracked(winner);
        _ensureTracked(loser);

        AgentStats storage w = agentStats[winner];
        AgentStats storage l = agentStats[loser];

        uint256 winnerElo = w.eloRating;
        uint256 loserElo = l.eloRating;

        // Expected scores (scaled by 1000 for integer math).
        // E_winner = 1 / (1 + 10^((loserElo - winnerElo) / 400))
        // We approximate using the standard formula with integer math.

        (uint256 newWinnerElo, uint256 newLoserElo) = _calculateElo(winnerElo, loserElo);

        w.eloRating = newWinnerElo;
        l.eloRating = newLoserElo;

        emit EloUpdated(winner, loser, newWinnerElo, newLoserElo);
    }

    /// @notice Returns top agents sorted by ELO (simple iteration).
    /// @param count Maximum number of agents to return.
    function getTopAgents(uint256 count) external view returns (address[] memory, uint256[] memory) {
        uint256 total = allAgents.length;
        if (count > total) {
            count = total;
        }

        // Copy all agents and their ELO to memory for sorting.
        address[] memory agents = new address[](total);
        uint256[] memory elos = new uint256[](total);

        for (uint256 i = 0; i < total; i++) {
            agents[i] = allAgents[i];
            elos[i] = agentStats[agents[i]].eloRating;
        }

        // Simple selection sort for top `count` agents (fine for on-chain reads).
        for (uint256 i = 0; i < count; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < total; j++) {
                if (elos[j] > elos[maxIdx]) {
                    maxIdx = j;
                }
            }
            if (maxIdx != i) {
                // Swap.
                (agents[i], agents[maxIdx]) = (agents[maxIdx], agents[i]);
                (elos[i], elos[maxIdx]) = (elos[maxIdx], elos[i]);
            }
        }

        // Trim to requested count.
        address[] memory topAgents = new address[](count);
        uint256[] memory topElos = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            topAgents[i] = agents[i];
            topElos[i] = elos[i];
        }

        return (topAgents, topElos);
    }

    /// @notice Returns full stats for an agent.
    function getAgentStats(address agent)
        external
        view
        returns (
            uint256 gamesPlayed,
            uint256 gamesWon,
            uint256 timesImpostor,
            uint256 impostorWins,
            uint256 correctVotes,
            uint256 totalEarnings,
            uint256 eloRating
        )
    {
        AgentStats storage s = agentStats[agent];
        return (s.gamesPlayed, s.gamesWon, s.timesImpostor, s.impostorWins, s.correctVotes, s.totalEarnings, s.eloRating);
    }

    /// @notice Returns the total number of tracked agents.
    function getTotalAgents() external view returns (uint256) {
        return allAgents.length;
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _ensureTracked(address agent) internal {
        if (!isTracked[agent]) {
            isTracked[agent] = true;
            allAgents.push(agent);
            agentStats[agent].eloRating = STARTING_ELO;
        }
    }

    /// @notice Simplified ELO calculation using integer math.
    /// @dev Uses a linear approximation: when the rating difference is D,
    ///      the expected score is approximated as 0.5 + D/(2*800) = 0.5 + D/1600.
    ///      We scale by 1000 for precision.
    function _calculateElo(uint256 winnerElo, uint256 loserElo)
        internal
        pure
        returns (uint256 newWinnerElo, uint256 newLoserElo)
    {
        // Rating difference, capped at 400 to keep approximation reasonable.
        int256 diff = int256(winnerElo) - int256(loserElo);
        if (diff > 400) diff = 400;
        if (diff < -400) diff = -400;

        // Expected score for winner (scaled by 1000).
        // E_w = 500 + (diff * 1000) / 1600  (but diff is from winner's perspective).
        // When winner has higher elo, E_w > 500, meaning they were expected to win,
        // so they gain less ELO.
        int256 expectedWinner = 500 + (diff * 1000) / 1600;

        // Actual score for winner = 1.0 (scaled by 1000 = 1000).
        // Change = K * (actual - expected) / 1000
        int256 change = (int256(K_FACTOR) * (1000 - expectedWinner)) / 1000;

        // Ensure ELO doesn't go below 100.
        int256 newW = int256(winnerElo) + change;
        int256 newL = int256(loserElo) - change;

        if (newW < 100) newW = 100;
        if (newL < 100) newL = 100;

        newWinnerElo = uint256(newW);
        newLoserElo = uint256(newL);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    function setOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "Zero address");
        operator = newOperator;
    }
}
