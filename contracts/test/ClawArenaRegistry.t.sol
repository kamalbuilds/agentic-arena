// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClawArenaRegistry.sol";

contract ClawArenaRegistryTest is Test {
    ClawArenaRegistry public registry;

    address public operator = address(this);

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    function setUp() public {
        registry = new ClawArenaRegistry(operator);
    }

    // -----------------------------------------------------------------------
    // Constructor Tests
    // -----------------------------------------------------------------------

    function test_constructor() public view {
        assertEq(registry.operator(), operator);
        assertEq(registry.nextArenaId(), 0);
        assertEq(registry.getTotalArenas(), 0);
    }

    function test_constructor_revert_zeroOperator() public {
        vm.expectRevert("Zero operator");
        new ClawArenaRegistry(address(0));
    }

    // -----------------------------------------------------------------------
    // Register Arena Tests
    // -----------------------------------------------------------------------

    function test_registerArena() public {
        uint256 id = registry.registerArena("Social Deduction", "Among Us style game", 3, 15, 1 ether);
        assertEq(id, 0);

        (
            string memory name,
            string memory description,
            uint256 minPlayers,
            uint256 maxPlayers,
            uint256 defaultStake,
            bool active,
            uint256 gamesPlayed,
            uint256 totalVolume
        ) = registry.getArena(id);

        assertEq(name, "Social Deduction");
        assertEq(description, "Among Us style game");
        assertEq(minPlayers, 3);
        assertEq(maxPlayers, 15);
        assertEq(defaultStake, 1 ether);
        assertTrue(active);
        assertEq(gamesPlayed, 0);
        assertEq(totalVolume, 0);
    }

    function test_registerArena_incrementsId() public {
        uint256 id1 = registry.registerArena("A1", "D1", 2, 10, 1 ether);
        uint256 id2 = registry.registerArena("A2", "D2", 3, 8, 0.5 ether);
        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(registry.getTotalArenas(), 2);
    }

    function test_registerArena_revert_maxLessThanMin() public {
        vm.expectRevert("Max >= min");
        registry.registerArena("A", "D", 10, 5, 1 ether);
    }

    function test_registerArena_revert_minLessThanTwo() public {
        vm.expectRevert("Min 2 players");
        registry.registerArena("A", "D", 1, 5, 1 ether);
    }

    function test_registerArena_revert_notOperator() public {
        vm.prank(user1);
        vm.expectRevert("Only operator");
        registry.registerArena("A", "D", 2, 5, 1 ether);
    }

    // -----------------------------------------------------------------------
    // Arena Active Status Tests
    // -----------------------------------------------------------------------

    function test_setArenaActive_deactivate() public {
        uint256 id = registry.registerArena("A", "D", 2, 10, 1 ether);

        registry.setArenaActive(id, false);

        (, , , , , bool active, ,) = registry.getArena(id);
        assertFalse(active);
    }

    function test_setArenaActive_reactivate() public {
        uint256 id = registry.registerArena("A", "D", 2, 10, 1 ether);

        registry.setArenaActive(id, false);
        registry.setArenaActive(id, true);

        (, , , , , bool active, ,) = registry.getArena(id);
        assertTrue(active);
    }

    function test_setArenaActive_revert_notOperator() public {
        uint256 id = registry.registerArena("A", "D", 2, 10, 1 ether);

        vm.prank(user1);
        vm.expectRevert("Only operator");
        registry.setArenaActive(id, false);
    }

    // -----------------------------------------------------------------------
    // Record Game Played Tests
    // -----------------------------------------------------------------------

    function test_recordGamePlayed() public {
        uint256 id = registry.registerArena("A", "D", 2, 10, 1 ether);

        registry.recordGamePlayed(id, 5 ether);

        (, , , , , , uint256 gamesPlayed, uint256 totalVolume) = registry.getArena(id);
        assertEq(gamesPlayed, 1);
        assertEq(totalVolume, 5 ether);
    }

    function test_recordGamePlayed_accumulates() public {
        uint256 id = registry.registerArena("A", "D", 2, 10, 1 ether);

        registry.recordGamePlayed(id, 3 ether);
        registry.recordGamePlayed(id, 7 ether);
        registry.recordGamePlayed(id, 2 ether);

        (, , , , , , uint256 gamesPlayed, uint256 totalVolume) = registry.getArena(id);
        assertEq(gamesPlayed, 3);
        assertEq(totalVolume, 12 ether);
    }

    function test_recordGamePlayed_revert_notOperator() public {
        uint256 id = registry.registerArena("A", "D", 2, 10, 1 ether);

        vm.prank(user1);
        vm.expectRevert("Only operator");
        registry.recordGamePlayed(id, 1 ether);
    }

    // -----------------------------------------------------------------------
    // View Functions Tests
    // -----------------------------------------------------------------------

    function test_getActiveArenas() public {
        uint256 id0 = registry.registerArena("A1", "D1", 2, 10, 1 ether);
        uint256 id1 = registry.registerArena("A2", "D2", 3, 8, 0.5 ether);
        uint256 id2 = registry.registerArena("A3", "D3", 4, 12, 2 ether);

        // Deactivate the second arena
        registry.setArenaActive(id1, false);

        uint256[] memory active = registry.getActiveArenas();
        assertEq(active.length, 2);
        assertEq(active[0], id0);
        assertEq(active[1], id2);
    }

    function test_getActiveArenas_empty() public view {
        uint256[] memory active = registry.getActiveArenas();
        assertEq(active.length, 0);
    }

    function test_getActiveArenas_allDeactivated() public {
        uint256 id0 = registry.registerArena("A1", "D1", 2, 10, 1 ether);
        uint256 id1 = registry.registerArena("A2", "D2", 3, 8, 0.5 ether);

        registry.setArenaActive(id0, false);
        registry.setArenaActive(id1, false);

        uint256[] memory active = registry.getActiveArenas();
        assertEq(active.length, 0);
    }

    function test_getTotalArenas() public {
        assertEq(registry.getTotalArenas(), 0);

        registry.registerArena("A1", "D1", 2, 10, 1 ether);
        assertEq(registry.getTotalArenas(), 1);

        registry.registerArena("A2", "D2", 3, 8, 0.5 ether);
        assertEq(registry.getTotalArenas(), 2);
    }

    // -----------------------------------------------------------------------
    // Admin Tests
    // -----------------------------------------------------------------------

    function test_setOperator() public {
        registry.setOperator(user1);
        assertEq(registry.operator(), user1);
    }

    function test_setOperator_revert_zeroAddress() public {
        vm.expectRevert("Zero address");
        registry.setOperator(address(0));
    }

    function test_setOperator_revert_notOperator() public {
        vm.prank(user1);
        vm.expectRevert("Only operator");
        registry.setOperator(user2);
    }
}
