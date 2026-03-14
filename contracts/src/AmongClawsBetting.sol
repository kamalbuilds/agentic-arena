// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AmongClawsBetting
/// @notice Side-betting contract for Among Claws games. Spectators can bet on outcomes.
contract AmongClawsBetting is ReentrancyGuard {
    // -----------------------------------------------------------------------
    // Enums (mirror the game contract)
    // -----------------------------------------------------------------------

    /// @notice Bet types.
    /// 0 = LobstersWin, 1 = ImpostorWins, 2 = SpecificAgentImpostor
    uint8 public constant BET_LOBSTERS_WIN = 0;
    uint8 public constant BET_IMPOSTOR_WINS = 1;
    uint8 public constant BET_SPECIFIC_AGENT_IMPOSTOR = 2;

    enum GameResult {
        None,
        LobstersWin,
        ImpostorWins
    }

    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct Bet {
        address bettor;
        uint8 betType;
        address predictedAgent; // only relevant for betType == 2
        uint256 amount;
        bool settled;
        bool won;
    }

    struct GameBettingPool {
        uint256 totalLobstersPool;
        uint256 totalImpostorPool;
        uint256 totalSpecificPool;
        bool settled;
        GameResult result;
        address revealedImpostor;
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice 3% fee on winnings (300 basis points).
    uint256 public constant BETTING_FEE_BPS = 300;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address public operator;
    address public treasury;

    /// @notice All bets for a game, indexed by gameId.
    mapping(uint256 => Bet[]) public gameBets;

    /// @notice Betting pool totals per game.
    mapping(uint256 => GameBettingPool) public pools;

    /// @notice Track total bet amount per bettor per game to prevent double-claiming.
    mapping(uint256 => mapping(address => uint256)) public bettorTotal;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event BetPlaced(uint256 indexed gameId, address indexed bettor, uint8 betType, address predictedAgent, uint256 amount);
    event BetsSettled(uint256 indexed gameId, GameResult result, address impostor);
    event BetClaimed(uint256 indexed gameId, address indexed bettor, uint256 payout);

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
    // External Functions
    // -----------------------------------------------------------------------

    /// @notice Place a bet on a game outcome.
    /// @param gameId The game to bet on.
    /// @param betType 0=LobstersWin, 1=ImpostorWins, 2=SpecificAgentImpostor.
    /// @param predictedAgent Only used when betType == 2.
    function placeBet(uint256 gameId, uint8 betType, address predictedAgent) external payable {
        require(msg.value > 0, "Bet must be > 0");
        require(betType <= 2, "Invalid bet type");
        require(!pools[gameId].settled, "Game already settled");

        if (betType == BET_SPECIFIC_AGENT_IMPOSTOR) {
            require(predictedAgent != address(0), "Must specify agent");
        }

        Bet memory b = Bet({
            bettor: msg.sender,
            betType: betType,
            predictedAgent: predictedAgent,
            amount: msg.value,
            settled: false,
            won: false
        });

        gameBets[gameId].push(b);

        // Update pool totals.
        if (betType == BET_LOBSTERS_WIN) {
            pools[gameId].totalLobstersPool += msg.value;
        } else if (betType == BET_IMPOSTOR_WINS) {
            pools[gameId].totalImpostorPool += msg.value;
        } else {
            pools[gameId].totalSpecificPool += msg.value;
        }

        bettorTotal[gameId][msg.sender] += msg.value;

        emit BetPlaced(gameId, msg.sender, betType, predictedAgent, msg.value);
    }

    /// @notice Operator settles all bets for a game after it ends.
    /// @param gameId The game ID.
    /// @param result The game result.
    /// @param impostor The revealed impostor address (for specific-agent bets).
    function settleBets(uint256 gameId, GameResult result, address impostor) external onlyOperator nonReentrant {
        GameBettingPool storage pool = pools[gameId];
        require(!pool.settled, "Already settled");
        require(result != GameResult.None, "Invalid result");

        pool.settled = true;
        pool.result = result;
        pool.revealedImpostor = impostor;

        uint256 totalPool = pool.totalLobstersPool + pool.totalImpostorPool + pool.totalSpecificPool;
        if (totalPool == 0) {
            emit BetsSettled(gameId, result, impostor);
            return;
        }

        // Calculate winning pool size.
        uint256 winningPool = 0;
        Bet[] storage bets = gameBets[gameId];

        for (uint256 i = 0; i < bets.length; i++) {
            bool won = _isBetWinner(bets[i], result, impostor);
            bets[i].settled = true;
            bets[i].won = won;
            if (won) {
                winningPool += bets[i].amount;
            }
        }

        // Distribute winnings proportionally.
        if (winningPool > 0) {
            uint256 fee = (totalPool * BETTING_FEE_BPS) / BPS_DENOMINATOR;
            uint256 distributable = totalPool - fee;

            // Send fee to treasury.
            (bool feeOk,) = treasury.call{value: fee}("");
            require(feeOk, "Fee transfer failed");

            for (uint256 i = 0; i < bets.length; i++) {
                if (bets[i].won) {
                    // Proportional share: (betAmount / winningPool) * distributable
                    uint256 payout = (bets[i].amount * distributable) / winningPool;
                    if (payout > 0) {
                        (bool ok,) = bets[i].bettor.call{value: payout}("");
                        require(ok, "Payout failed");
                        emit BetClaimed(gameId, bets[i].bettor, payout);
                    }
                }
            }
        } else {
            // No winners - refund everyone.
            for (uint256 i = 0; i < bets.length; i++) {
                (bool ok,) = bets[i].bettor.call{value: bets[i].amount}("");
                require(ok, "Refund failed");
            }
        }

        emit BetsSettled(gameId, result, impostor);
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------

    /// @notice Returns the number of bets for a game.
    function getBetCount(uint256 gameId) external view returns (uint256) {
        return gameBets[gameId].length;
    }

    /// @notice Returns pool sizes for a game.
    function getPoolSizes(uint256 gameId)
        external
        view
        returns (uint256 lobstersPool, uint256 impostorPool, uint256 specificPool)
    {
        GameBettingPool storage p = pools[gameId];
        return (p.totalLobstersPool, p.totalImpostorPool, p.totalSpecificPool);
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _isBetWinner(Bet memory b, GameResult result, address impostor) internal pure returns (bool) {
        if (b.betType == BET_LOBSTERS_WIN && result == GameResult.LobstersWin) {
            return true;
        }
        if (b.betType == BET_IMPOSTOR_WINS && result == GameResult.ImpostorWins) {
            return true;
        }
        if (b.betType == BET_SPECIFIC_AGENT_IMPOSTOR && b.predictedAgent == impostor && impostor != address(0)) {
            return true;
        }
        return false;
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
