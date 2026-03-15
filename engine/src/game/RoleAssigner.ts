import crypto from "node:crypto";
import { encodePacked, keccak256 } from "viem";
import { logger } from "../utils/logger.js";

const roleLogger = logger.child("RoleAssigner");

export enum Role {
  Crewmate = 0,
  Impostor = 1,
}

export interface RoleAssignment {
  address: `0x${string}`;
  role: Role;
}

export interface RoleCommitment {
  address: `0x${string}`;
  commitment: `0x${string}`;
  salt: `0x${string}`;
  role: Role;
}

// Store salts privately per game for later reveal
const saltStore = new Map<string, Map<string, `0x${string}`>>();
const roleStore = new Map<string, Map<string, Role>>();

export function assignRoles(
  players: `0x${string}`[],
  impostorCount: number
): Map<`0x${string}`, Role> {
  if (impostorCount >= players.length) {
    throw new Error("Impostor count must be less than player count");
  }

  const assignments = new Map<`0x${string}`, Role>();

  // Shuffle players using Fisher-Yates with crypto.randomBytes
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomBytes = crypto.randomBytes(4);
    const j = randomBytes.readUInt32BE(0) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Assign impostors to first N shuffled players
  for (let i = 0; i < shuffled.length; i++) {
    const role = i < impostorCount ? Role.Impostor : Role.Crewmate;
    assignments.set(shuffled[i], role);
  }

  roleLogger.info(
    `Assigned ${impostorCount} impostor(s) among ${players.length} players`
  );

  return assignments;
}

export function generateCommitments(
  gameId: string,
  assignments: Map<`0x${string}`, Role>
): RoleCommitment[] {
  const commitments: RoleCommitment[] = [];
  const gameSalts = new Map<string, `0x${string}`>();
  const gameRoles = new Map<string, Role>();

  for (const [address, role] of assignments) {
    const salt = `0x${crypto.randomBytes(32).toString("hex")}` as `0x${string}`;

    // commitment = keccak256(abi.encodePacked(gameId, agent, role, salt))
    const commitment = keccak256(
      encodePacked(
        ["string", "address", "uint8", "bytes32"],
        [gameId, address, role, salt]
      )
    );

    commitments.push({ address, commitment, salt, role });
    gameSalts.set(address.toLowerCase(), salt);
    gameRoles.set(address.toLowerCase(), role);
  }

  saltStore.set(gameId, gameSalts);
  roleStore.set(gameId, gameRoles);

  roleLogger.info(
    `Generated ${commitments.length} role commitments for game ${gameId}`
  );

  return commitments;
}

export function getSalt(
  gameId: string,
  address: `0x${string}`
): `0x${string}` | null {
  const gameSalts = saltStore.get(gameId);
  if (!gameSalts) return null;
  return gameSalts.get(address.toLowerCase()) || null;
}

export function getStoredRole(
  gameId: string,
  address: `0x${string}`
): Role | null {
  const gameRoles = roleStore.get(gameId);
  if (!gameRoles) return null;
  const role = gameRoles.get(address.toLowerCase());
  return role !== undefined ? role : null;
}

export function cleanupGame(gameId: string): void {
  saltStore.delete(gameId);
  roleStore.delete(gameId);
}
