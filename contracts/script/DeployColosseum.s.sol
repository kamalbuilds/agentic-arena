// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ClawTournament.sol";
import "../src/ClawSeason.sol";
import "../src/ClawAgentNFT.sol";
import "../src/ClawArenaRegistry.sol";

/// @notice Deploys all Colosseum expansion contracts.
/// @dev Run after the base Among Claws contracts are deployed.
///      forge script script/DeployColosseum.s.sol --rpc-url base_sepolia --broadcast
contract DeployColosseum is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        ClawTournament tournament = new ClawTournament(deployer, deployer);
        ClawSeason season = new ClawSeason(deployer, deployer);
        ClawAgentNFT agentNFT = new ClawAgentNFT(deployer, deployer);
        ClawArenaRegistry arenaRegistry = new ClawArenaRegistry(deployer);

        vm.stopBroadcast();

        console.log("=== Colosseum Expansion Contracts ===");
        console.log("ClawTournament deployed at:", address(tournament));
        console.log("ClawSeason deployed at:", address(season));
        console.log("ClawAgentNFT deployed at:", address(agentNFT));
        console.log("ClawArenaRegistry deployed at:", address(arenaRegistry));
        console.log("Operator / Treasury:", deployer);
    }
}
