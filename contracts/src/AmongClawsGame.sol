// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AmongClawsGame
/// @notice Autonomous social deduction game (Among Us) for AI agents on Base blockchain.
/// @dev Uses an operator model where a trusted game engine coordinates phases and role assignments.
contract AmongClawsGame is ReentrancyGuard {
    // -----------------------------------------------------------------------
    // Enums
    // -----------------------------------------------------------------------

    enum Role {
        None,
        Lobster,
        Impostor
    }

    enum Phase {
        Lobby,
        Active,
        Discussion,
        Voting,
        Resolution,
        Ended
    }

    enum GameResult {
        None,
        LobstersWin,
        ImpostorWins
    }

    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct Game {
        uint256 gameId;
        address creator;
        address[] players;
        uint256 stakeAmount;
        uint256 pot;
        Phase phase;
        uint256 phaseEndTime;
        uint8 roundNumber;
        uint8 maxRounds;
        uint8 minPlayers;
        uint8 maxPlayers;
        uint8 impostorCount;
        GameResult result;
        uint8 totalAlive;
        uint8 totalImpostorsAlive;
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Protocol fee: 5% (500 basis points out of 10_000).
    uint256 public constant PROTOCOL_FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address public operator;
    address public treasury;
    uint256 public nextGameId;

    /// @notice Core game data keyed by gameId.
    mapping(uint256 => Game) public games;

    /// @notice Per-game mappings.
    mapping(uint256 => mapping(address => bytes32)) public roleCommitments;
    mapping(uint256 => mapping(address => bool)) public eliminated;
    mapping(uint256 => mapping(address => address)) public votes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => mapping(address => bool)) public isPlayer;

    /// @notice Tracks revealed roles for prize distribution.
    mapping(uint256 => mapping(address => Role)) public revealedRoles;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 stakeAmount, uint8 maxPlayers);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, uint8 playerCount);
    event RolesCommitted(uint256 indexed gameId, uint8 agentCount);
    event PhaseAdvanced(uint256 indexed gameId, Phase newPhase, uint256 duration);
    event VoteCast(uint256 indexed gameId, address indexed voter, address indexed target);
    event PlayerEliminated(uint256 indexed gameId, address indexed player);
    event RoleRevealed(uint256 indexed gameId, address indexed agent, Role role);
    event GameEnded(uint256 indexed gameId, GameResult result);
    event PrizeClaimed(uint256 indexed gameId, address indexed player, uint256 amount);

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
    // External / Public Functions
    // -----------------------------------------------------------------------

    /// @notice Creates a new game lobby.
    /// @return gameId The unique identifier for the created game.
    function createGame(
        uint256 stake,
        uint8 minPlayers,
        uint8 maxPlayers,
        uint8 impostorCount,
        uint8 maxRounds
    ) external returns (uint256 gameId) {
        require(stake > 0, "Stake must be > 0");
        require(minPlayers >= 3, "Min 3 players");
        require(maxPlayers >= minPlayers, "Max >= min");
        require(maxPlayers <= 15, "Max 15 players");
        require(impostorCount >= 1, "Need >= 1 impostor");
        require(impostorCount < minPlayers, "Too many impostors");
        require(maxRounds >= 1, "Need >= 1 round");

        gameId = nextGameId++;

        Game storage g = games[gameId];
        g.gameId = gameId;
        g.creator = msg.sender;
        g.stakeAmount = stake;
        g.phase = Phase.Lobby;
        g.minPlayers = minPlayers;
        g.maxPlayers = maxPlayers;
        g.impostorCount = impostorCount;
        g.maxRounds = maxRounds;

        emit GameCreated(gameId, msg.sender, stake, maxPlayers);
    }

    /// @notice Agent joins an existing game by sending the required stake in ETH.
    function joinGame(uint256 gameId) external payable {
        Game storage g = games[gameId];
        require(g.phase == Phase.Lobby, "Not in lobby");
        require(!isPlayer[gameId][msg.sender], "Already joined");
        require(g.players.length < g.maxPlayers, "Game full");
        require(msg.value == g.stakeAmount, "Wrong stake amount");

        g.players.push(msg.sender);
        isPlayer[gameId][msg.sender] = true;
        g.pot += msg.value;

        emit PlayerJoined(gameId, msg.sender);
    }

    /// @notice Operator starts the game once enough players have joined.
    function startGame(uint256 gameId) external onlyOperator {
        Game storage g = games[gameId];
        require(g.phase == Phase.Lobby, "Not in lobby");
        require(g.players.length >= g.minPlayers, "Not enough players");

        g.phase = Phase.Active;
        g.totalAlive = uint8(g.players.length);
        g.totalImpostorsAlive = g.impostorCount;
        g.roundNumber = 1;

        emit GameStarted(gameId, uint8(g.players.length));
    }

    /// @notice Operator commits role hashes for each agent.
    /// @dev commitment = keccak256(abi.encodePacked(agent, role, salt))
    function commitRoles(
        uint256 gameId,
        address[] calldata agents,
        bytes32[] calldata commitments
    ) external onlyOperator {
        Game storage g = games[gameId];
        require(g.phase == Phase.Active, "Not active");
        require(agents.length == commitments.length, "Length mismatch");
        require(agents.length == g.players.length, "Must commit for all");

        for (uint256 i = 0; i < agents.length; i++) {
            require(isPlayer[gameId][agents[i]], "Not a player");
            roleCommitments[gameId][agents[i]] = commitments[i];
        }

        emit RolesCommitted(gameId, uint8(agents.length));
    }

    /// @notice Operator advances the game to a new phase.
    function advancePhase(uint256 gameId, Phase newPhase, uint256 duration) external onlyOperator {
        Game storage g = games[gameId];
        require(g.phase != Phase.Lobby, "Still in lobby");
        require(g.phase != Phase.Ended, "Already ended");
        require(uint8(newPhase) > 0, "Cannot go to Lobby");

        // If transitioning to Voting, reset votes from previous round.
        if (newPhase == Phase.Voting) {
            _resetVotes(gameId, g);
        }

        g.phase = newPhase;
        g.phaseEndTime = block.timestamp + duration;

        emit PhaseAdvanced(gameId, newPhase, duration);
    }

    /// @notice Agent casts an elimination vote during the Voting phase.
    function castVote(uint256 gameId, address target) external {
        Game storage g = games[gameId];
        require(g.phase == Phase.Voting, "Not voting phase");
        require(isPlayer[gameId][msg.sender], "Not a player");
        require(!eliminated[gameId][msg.sender], "You are eliminated");
        require(isPlayer[gameId][target], "Target not a player");
        require(!eliminated[gameId][target], "Target already eliminated");
        require(!hasVoted[gameId][msg.sender], "Already voted");
        require(msg.sender != target, "Cannot vote for self");

        votes[gameId][msg.sender] = target;
        hasVoted[gameId][msg.sender] = true;

        emit VoteCast(gameId, msg.sender, target);
    }

    /// @notice Operator resolves the vote round and eliminates the voted-out agent.
    function resolveVote(uint256 gameId, address eliminatedPlayer) external onlyOperator {
        Game storage g = games[gameId];
        require(g.phase == Phase.Voting || g.phase == Phase.Resolution, "Wrong phase");
        require(isPlayer[gameId][eliminatedPlayer], "Not a player");
        require(!eliminated[gameId][eliminatedPlayer], "Already eliminated");

        eliminated[gameId][eliminatedPlayer] = true;
        g.totalAlive--;

        emit PlayerEliminated(gameId, eliminatedPlayer);
    }

    /// @notice Reveals and verifies an agent's role against the original commitment.
    function revealRole(uint256 gameId, address agent, Role role, bytes32 salt) external onlyOperator {
        require(isPlayer[gameId][agent], "Not a player");

        bytes32 commitment = roleCommitments[gameId][agent];
        require(commitment != bytes32(0), "No commitment");

        bytes32 computed = keccak256(abi.encodePacked(agent, role, salt));
        require(computed == commitment, "Invalid reveal");

        revealedRoles[gameId][agent] = role;

        // If the eliminated player was an impostor, decrement alive impostors.
        if (eliminated[gameId][agent] && role == Role.Impostor) {
            Game storage g = games[gameId];
            if (g.totalImpostorsAlive > 0) {
                g.totalImpostorsAlive--;
            }
        }

        emit RoleRevealed(gameId, agent, role);
    }

    /// @notice Operator ends the game and declares the result.
    function endGame(uint256 gameId, GameResult result) external onlyOperator {
        Game storage g = games[gameId];
        require(g.phase != Phase.Ended, "Already ended");
        require(result != GameResult.None, "Invalid result");

        g.result = result;
        g.phase = Phase.Ended;

        emit GameEnded(gameId, result);
    }

    /// @notice Winners claim their share of the prize pool.
    function claimPrize(uint256 gameId) external nonReentrant {
        Game storage g = games[gameId];
        require(g.phase == Phase.Ended, "Game not ended");
        require(isPlayer[gameId][msg.sender], "Not a player");
        require(!claimed[gameId][msg.sender], "Already claimed");

        Role role = revealedRoles[gameId][msg.sender];
        require(role != Role.None, "Role not revealed");

        bool isWinner = _isWinner(g.result, role, eliminated[gameId][msg.sender]);
        require(isWinner, "Not a winner");

        claimed[gameId][msg.sender] = true;

        uint256 winnerCount = _countWinners(gameId, g);
        require(winnerCount > 0, "No winners");

        uint256 fee = (g.pot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 prizePool = g.pot - fee;
        uint256 share = prizePool / winnerCount;

        // Send protocol fee to treasury (only on first claim).
        if (_claimedCount(gameId, g) == 1) {
            (bool feeSuccess,) = treasury.call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        (bool success,) = msg.sender.call{value: share}("");
        require(success, "Prize transfer failed");

        emit PrizeClaimed(gameId, msg.sender, share);
    }

    /// @notice Operator can refund all players if a game is broken/stuck.
    function emergencyRefund(uint256 gameId) external onlyOperator nonReentrant {
        Game storage g = games[gameId];
        require(g.phase != Phase.Ended, "Already ended");
        require(g.pot > 0, "No funds");

        g.phase = Phase.Ended;
        g.result = GameResult.None;

        uint256 refundPerPlayer = g.pot / g.players.length;

        for (uint256 i = 0; i < g.players.length; i++) {
            address player = g.players[i];
            if (!claimed[gameId][player]) {
                claimed[gameId][player] = true;
                (bool success,) = player.call{value: refundPerPlayer}("");
                require(success, "Refund transfer failed");
            }
        }

        // Any dust left from rounding stays in contract (negligible).
        g.pot = 0;
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------

    /// @notice Returns the full list of players in a game.
    function getPlayers(uint256 gameId) external view returns (address[] memory) {
        return games[gameId].players;
    }

    /// @notice Returns the number of players in a game.
    function getPlayerCount(uint256 gameId) external view returns (uint256) {
        return games[gameId].players.length;
    }

    /// @notice Returns key game data.
    function getGameInfo(uint256 gameId)
        external
        view
        returns (
            address creator,
            uint256 stakeAmount,
            uint256 pot,
            Phase phase,
            uint8 roundNumber,
            uint8 totalAlive,
            uint8 totalImpostorsAlive,
            GameResult result
        )
    {
        Game storage g = games[gameId];
        return (g.creator, g.stakeAmount, g.pot, g.phase, g.roundNumber, g.totalAlive, g.totalImpostorsAlive, g.result);
    }

    // -----------------------------------------------------------------------
    // Internal Helpers
    // -----------------------------------------------------------------------

    /// @dev Determines if a player is a winner based on the game result and their role.
    function _isWinner(GameResult result, Role role, bool wasEliminated) internal pure returns (bool) {
        if (result == GameResult.LobstersWin) {
            // Lobsters who survived win.
            return role == Role.Lobster && !wasEliminated;
        } else if (result == GameResult.ImpostorWins) {
            // All impostors win (even if eliminated -- they achieved their objective).
            return role == Role.Impostor;
        }
        return false;
    }

    /// @dev Counts how many winners exist in the game (for equal share calculation).
    function _countWinners(uint256 gameId, Game storage g) internal view returns (uint256 count) {
        for (uint256 i = 0; i < g.players.length; i++) {
            address p = g.players[i];
            Role role = revealedRoles[gameId][p];
            if (_isWinner(g.result, role, eliminated[gameId][p])) {
                count++;
            }
        }
    }

    /// @dev Counts how many players have already claimed.
    function _claimedCount(uint256 gameId, Game storage g) internal view returns (uint256 count) {
        for (uint256 i = 0; i < g.players.length; i++) {
            if (claimed[gameId][g.players[i]]) {
                count++;
            }
        }
    }

    /// @dev Resets all votes for the current round.
    function _resetVotes(uint256 gameId, Game storage g) internal {
        for (uint256 i = 0; i < g.players.length; i++) {
            address p = g.players[i];
            votes[gameId][p] = address(0);
            hasVoted[gameId][p] = false;
        }
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// @notice Transfer operator role.
    function setOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "Zero address");
        operator = newOperator;
    }

    /// @notice Update treasury address.
    function setTreasury(address newTreasury) external onlyOperator {
        require(newTreasury != address(0), "Zero address");
        treasury = newTreasury;
    }

    /// @notice Allow the contract to receive ETH.
    receive() external payable {}
}
