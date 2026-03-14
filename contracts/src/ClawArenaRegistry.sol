// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ClawArenaRegistry
/// @notice Registry for arena types in the Claw Wars Colosseum. Enables a modular
///         framework where new game types can be registered and discovered.
contract ClawArenaRegistry {
    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct Arena {
        uint256 id;
        string name;
        string description;
        address creator;
        uint256 minPlayers;
        uint256 maxPlayers;
        uint256 defaultStake;
        bool active;
        uint256 gamesPlayed;
        uint256 totalVolume;
        uint256 createdAt;
    }

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address public operator;
    uint256 public nextArenaId;

    mapping(uint256 => Arena) public arenas;
    uint256[] public arenaIds;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event ArenaRegistered(uint256 indexed id, string name, address creator, uint256 minPlayers, uint256 maxPlayers);
    event ArenaUpdated(uint256 indexed id, bool active);
    event ArenaStatsUpdated(uint256 indexed id, uint256 gamesPlayed, uint256 totalVolume);

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
    // Arena Management
    // -----------------------------------------------------------------------

    function registerArena(
        string calldata name,
        string calldata description,
        uint256 minPlayers,
        uint256 maxPlayers,
        uint256 defaultStake
    ) external onlyOperator returns (uint256 id) {
        require(maxPlayers >= minPlayers, "Max >= min");
        require(minPlayers >= 2, "Min 2 players");

        id = nextArenaId++;

        arenas[id] = Arena({
            id: id,
            name: name,
            description: description,
            creator: msg.sender,
            minPlayers: minPlayers,
            maxPlayers: maxPlayers,
            defaultStake: defaultStake,
            active: true,
            gamesPlayed: 0,
            totalVolume: 0,
            createdAt: block.timestamp
        });

        arenaIds.push(id);

        emit ArenaRegistered(id, name, msg.sender, minPlayers, maxPlayers);
    }

    function setArenaActive(uint256 arenaId, bool active) external onlyOperator {
        arenas[arenaId].active = active;
        emit ArenaUpdated(arenaId, active);
    }

    function recordGamePlayed(uint256 arenaId, uint256 volume) external onlyOperator {
        Arena storage a = arenas[arenaId];
        a.gamesPlayed++;
        a.totalVolume += volume;

        emit ArenaStatsUpdated(arenaId, a.gamesPlayed, a.totalVolume);
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------

    function getArena(uint256 arenaId)
        external
        view
        returns (
            string memory name,
            string memory description,
            uint256 minPlayers,
            uint256 maxPlayers,
            uint256 defaultStake,
            bool active,
            uint256 gamesPlayed,
            uint256 totalVolume
        )
    {
        Arena storage a = arenas[arenaId];
        return (a.name, a.description, a.minPlayers, a.maxPlayers, a.defaultStake, a.active, a.gamesPlayed, a.totalVolume);
    }

    function getActiveArenas() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < arenaIds.length; i++) {
            if (arenas[arenaIds[i]].active) count++;
        }

        uint256[] memory active = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < arenaIds.length; i++) {
            if (arenas[arenaIds[i]].active) {
                active[idx++] = arenaIds[i];
            }
        }
        return active;
    }

    function getTotalArenas() external view returns (uint256) {
        return arenaIds.length;
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    function setOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "Zero address");
        operator = newOperator;
    }
}
