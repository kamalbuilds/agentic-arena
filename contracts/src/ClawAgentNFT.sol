// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClawAgentNFT
/// @notice ERC-721 Agent NFTs for the Claw Wars Colosseum. Agents evolve based on
///         win history, tournament performance, and season achievements.
contract ClawAgentNFT is ERC721, ReentrancyGuard {
    // -----------------------------------------------------------------------
    // Enums
    // -----------------------------------------------------------------------

    enum Tier {
        Bronze,    // 0-9 wins
        Silver,    // 10-24 wins
        Gold,      // 25-49 wins
        Platinum,  // 50-99 wins
        Diamond,   // 100+ wins
        Champion   // Tournament champion
    }

    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct AgentProfile {
        address agentAddress;
        string name;
        Tier tier;
        uint256 totalWins;
        uint256 totalGames;
        uint256 tournamentWins;
        uint256 seasonTitles;
        uint256 mintedAt;
        uint256 lastEvolution;
        string arenaSpecialty; // best arena type
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    uint256 public constant MINT_FEE = 0.1 ether; // 0.1 ETH
    uint256 public constant ROYALTY_BPS = 500; // 5% royalty

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address public operator;
    address public treasury;
    uint256 public nextTokenId;

    /// @notice Token ID => agent profile
    mapping(uint256 => AgentProfile) public profiles;

    /// @notice Agent address => token ID (one NFT per agent)
    mapping(address => uint256) public agentToToken;

    /// @notice Agent address => has NFT
    mapping(address => bool) public hasNFT;

    /// @notice Base URI for metadata
    string public baseTokenURI;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event AgentMinted(uint256 indexed tokenId, address indexed agentAddress, string name);
    event AgentEvolved(uint256 indexed tokenId, Tier oldTier, Tier newTier);
    event StatsUpdated(uint256 indexed tokenId, uint256 totalWins, uint256 totalGames);
    event TournamentWinRecorded(uint256 indexed tokenId, uint256 totalTournamentWins);
    event SeasonTitleRecorded(uint256 indexed tokenId, uint256 totalSeasonTitles);

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

    constructor(address _operator, address _treasury) ERC721("Claw Agent", "CLAW-AGENT") {
        require(_operator != address(0), "Zero operator");
        require(_treasury != address(0), "Zero treasury");
        operator = _operator;
        treasury = _treasury;
    }

    // -----------------------------------------------------------------------
    // Minting
    // -----------------------------------------------------------------------

    /// @notice Mint an agent NFT. One per agent address.
    function mintAgent(string calldata name) external payable nonReentrant {
        require(!hasNFT[msg.sender], "Agent already has NFT");
        require(msg.value >= MINT_FEE, "Insufficient mint fee");
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Invalid name length");

        uint256 tokenId = nextTokenId++;

        _mint(msg.sender, tokenId);

        profiles[tokenId] = AgentProfile({
            agentAddress: msg.sender,
            name: name,
            tier: Tier.Bronze,
            totalWins: 0,
            totalGames: 0,
            tournamentWins: 0,
            seasonTitles: 0,
            mintedAt: block.timestamp,
            lastEvolution: block.timestamp,
            arenaSpecialty: ""
        });

        agentToToken[msg.sender] = tokenId;
        hasNFT[msg.sender] = true;

        // Send mint fee to treasury
        (bool ok,) = treasury.call{value: msg.value}("");
        require(ok, "Fee transfer failed");

        emit AgentMinted(tokenId, msg.sender, name);
    }

    // -----------------------------------------------------------------------
    // Stats & Evolution (Operator Only)
    // -----------------------------------------------------------------------

    /// @notice Update agent game stats and check for tier evolution.
    function updateGameStats(address agent, bool won) external onlyOperator {
        require(hasNFT[agent], "No NFT");

        uint256 tokenId = agentToToken[agent];
        AgentProfile storage p = profiles[tokenId];

        p.totalGames++;
        if (won) p.totalWins++;

        Tier oldTier = p.tier;
        Tier newTier = _calculateTier(p.totalWins, p.tournamentWins);

        if (newTier != oldTier) {
            p.tier = newTier;
            p.lastEvolution = block.timestamp;
            emit AgentEvolved(tokenId, oldTier, newTier);
        }

        emit StatsUpdated(tokenId, p.totalWins, p.totalGames);
    }

    function recordTournamentWin(address agent) external onlyOperator {
        require(hasNFT[agent], "No NFT");

        uint256 tokenId = agentToToken[agent];
        AgentProfile storage p = profiles[tokenId];
        p.tournamentWins++;

        Tier oldTier = p.tier;
        if (oldTier != Tier.Champion) {
            p.tier = Tier.Champion;
            p.lastEvolution = block.timestamp;
            emit AgentEvolved(tokenId, oldTier, Tier.Champion);
        }

        emit TournamentWinRecorded(tokenId, p.tournamentWins);
    }

    function recordSeasonTitle(address agent) external onlyOperator {
        require(hasNFT[agent], "No NFT");

        uint256 tokenId = agentToToken[agent];
        profiles[tokenId].seasonTitles++;

        emit SeasonTitleRecorded(tokenId, profiles[tokenId].seasonTitles);
    }

    function setArenaSpecialty(address agent, string calldata specialty) external onlyOperator {
        require(hasNFT[agent], "No NFT");
        uint256 tokenId = agentToToken[agent];
        profiles[tokenId].arenaSpecialty = specialty;
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------

    function getProfile(uint256 tokenId)
        external
        view
        returns (
            address agentAddress,
            string memory name,
            Tier tier,
            uint256 totalWins,
            uint256 totalGames,
            uint256 tournamentWins,
            uint256 seasonTitles,
            uint256 mintedAt,
            string memory arenaSpecialty
        )
    {
        AgentProfile storage p = profiles[tokenId];
        return (p.agentAddress, p.name, p.tier, p.totalWins, p.totalGames, p.tournamentWins, p.seasonTitles, p.mintedAt, p.arenaSpecialty);
    }

    function getAgentToken(address agent) external view returns (uint256) {
        require(hasNFT[agent], "No NFT");
        return agentToToken[agent];
    }

    function totalSupply() external view returns (uint256) {
        return nextTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(baseTokenURI, _toString(tokenId)));
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _calculateTier(uint256 wins, uint256 tournamentWins) internal pure returns (Tier) {
        if (tournamentWins > 0) return Tier.Champion;
        if (wins >= 100) return Tier.Diamond;
        if (wins >= 50) return Tier.Platinum;
        if (wins >= 25) return Tier.Gold;
        if (wins >= 10) return Tier.Silver;
        return Tier.Bronze;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    function setBaseURI(string calldata uri) external onlyOperator {
        baseTokenURI = uri;
    }

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
