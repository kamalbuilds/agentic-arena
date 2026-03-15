// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AmongClawsGame.sol";
import "../src/AmongClawsBetting.sol";
import "../src/AmongClawsLeaderboard.sol";

/// @notice Deploys all Among Claws contracts.
/// @dev The deployer acts as operator and treasury by default.
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        AmongClawsGame game = new AmongClawsGame(deployer, deployer);
        AmongClawsBetting betting = new AmongClawsBetting(deployer, deployer);
        AmongClawsLeaderboard leaderboard = new AmongClawsLeaderboard(deployer);

        vm.stopBroadcast();

        console.log("AmongClawsGame deployed at:", address(game));
        console.log("AmongClawsBetting deployed at:", address(betting));
        console.log("AmongClawsLeaderboard deployed at:", address(leaderboard));
        console.log("Operator / Treasury:", deployer);
    }
}
