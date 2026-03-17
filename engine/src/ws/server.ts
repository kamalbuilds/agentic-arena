import { WebSocketServer, WebSocket } from "ws";
import { type Server as HttpServer } from "node:http";
import { logger } from "../utils/logger.js";
import { gameManager } from "../game/GameManager.js";
import { GameRoom, type GameMessage, GameResult } from "../game/GameRoom.js";

const wsLogger = logger.child("WebSocket");

interface WSClient {
  ws: WebSocket;
  id: string;
  subscribedGames: Set<string>;
  isAlive: boolean;
}

let clientIdCounter = 0;
const clients = new Map<string, WSClient>();
const gameSubscribers = new Map<string, Set<string>>();

let wss: WebSocketServer;

export function createWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server });

  wsLogger.info("WebSocket server created");

  wss.on("connection", (ws: WebSocket) => {
    const clientId = `ws_${++clientIdCounter}_${Date.now()}`;
    const client: WSClient = {
      ws,
      id: clientId,
      subscribedGames: new Set(),
      isAlive: true,
    };

    clients.set(clientId, client);
    wsLogger.info(`Client connected: ${clientId}`);

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(client, message);
      } catch (err) {
        wsLogger.error(`Invalid message from ${clientId}`, err);
        sendToClient(client, {
          type: "error",
          message: "Invalid JSON message",
        });
      }
    });

    ws.on("close", () => {
      wsLogger.info(`Client disconnected: ${clientId}`);
      // Remove from all game subscriptions
      for (const gameId of client.subscribedGames) {
        const subs = gameSubscribers.get(gameId);
        if (subs) {
          subs.delete(clientId);
          if (subs.size === 0) {
            gameSubscribers.delete(gameId);
          }
        }
        // Remove spectator from game room
        const room = gameManager.getGame(gameId);
        if (room) {
          room.removeSpectator(clientId);
        }
      }
      clients.delete(clientId);
    });

    ws.on("pong", () => {
      client.isAlive = true;
    });

    // Send welcome message
    sendToClient(client, {
      type: "connected",
      clientId,
      message: "Welcome to Claw Wars",
    });
  });

  // Heartbeat to keep connections alive
  const heartbeatInterval = setInterval(() => {
    for (const [clientId, client] of clients) {
      if (!client.isAlive) {
        wsLogger.debug(`Terminating inactive client: ${clientId}`);
        client.ws.terminate();
        clients.delete(clientId);
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

function handleClientMessage(
  client: WSClient,
  message: { type: string; gameId?: string; [key: string]: unknown }
): void {
  switch (message.type) {
    case "subscribe": {
      if (!message.gameId) {
        sendToClient(client, {
          type: "error",
          message: "gameId required for subscribe",
        });
        return;
      }

      const gameId = message.gameId;
      client.subscribedGames.add(gameId);

      if (!gameSubscribers.has(gameId)) {
        gameSubscribers.set(gameId, new Set());
      }
      gameSubscribers.get(gameId)!.add(client.id);

      // Add spectator to game room
      const room = gameManager.getGame(gameId);
      if (room) {
        room.addSpectator(client.id);
        // Send current game state (wrapped in `data` for frontend)
        sendToClient(client, {
          type: "game_state",
          data: room.getState(),
        });
      }

      wsLogger.info(
        `Client ${client.id} subscribed to game ${gameId}`
      );

      sendToClient(client, {
        type: "subscribed",
        gameId,
      });
      break;
    }

    case "unsubscribe": {
      if (!message.gameId) return;

      const gameId = message.gameId;
      client.subscribedGames.delete(gameId);

      const subs = gameSubscribers.get(gameId);
      if (subs) {
        subs.delete(client.id);
        if (subs.size === 0) {
          gameSubscribers.delete(gameId);
        }
      }

      const unsubRoom = gameManager.getGame(gameId);
      if (unsubRoom) {
        unsubRoom.removeSpectator(client.id);
      }

      sendToClient(client, {
        type: "unsubscribed",
        gameId,
      });
      break;
    }

    case "ping": {
      sendToClient(client, { type: "pong" });
      break;
    }

    default: {
      sendToClient(client, {
        type: "error",
        message: `Unknown message type: ${message.type}`,
      });
    }
  }
}

function sendToClient(client: WSClient, data: unknown): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

export function broadcastToGame(gameId: string, event: unknown): void {
  const subs = gameSubscribers.get(gameId);
  if (!subs || subs.size === 0) return;

  const payload = JSON.stringify(event);

  for (const clientId of subs) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

export function wireGameEvents(room: GameRoom): void {
  const gameId = room.gameId;

  room.on("phaseChange", (_gId: string, phase: string, duration: number, round: number) => {
    broadcastToGame(gameId, {
      type: "phase_change",
      data: { phase, timeRemaining: duration, duration, round },
    });
  });

  room.on("message", (_gId: string, message: GameMessage) => {
    broadcastToGame(gameId, {
      type: "message",
      data: {
        id: message.id,
        sender: message.sender,
        senderName: message.senderName,
        content: message.content,
        timestamp: message.timestamp,
        round: message.round,
      },
    });
  });

  room.on(
    "voteCast",
    (
      _gId: string,
      voterAddress: `0x${string}`,
      voterName: string,
      targetAddress: `0x${string}`,
      targetName: string
    ) => {
      broadcastToGame(gameId, {
        type: "vote",
        data: {
          voter: voterAddress,
          voterName,
          target: targetAddress,
          targetName,
        },
      });
    }
  );

  room.on(
    "elimination",
    (
      _gId: string,
      address: `0x${string}`,
      name: string,
      role: string,
      round: number
    ) => {
      broadcastToGame(gameId, {
        type: "elimination",
        data: { player: address, name, role, round },
      });
    }
  );

  room.on("noElimination", (_gId: string, round: number) => {
    broadcastToGame(gameId, {
      type: "no_elimination",
      data: { round },
    });
  });

  room.on(
    "gameEnd",
    (_gId: string, result: GameResult, winners: `0x${string}`[]) => {
      broadcastToGame(gameId, {
        type: "game_end",
        data: {
          winner:
            result === GameResult.CrewmatesWin
              ? "lobsters"
              : "impostor",
          winners,
        },
      });
    }
  );

  room.on(
    "playerJoined",
    (_gId: string, address: `0x${string}`, name: string) => {
      broadcastToGame(gameId, {
        type: "player_joined",
        data: {
          player: { address, name },
          playerCount: room.getPlayerCount(),
        },
      });
    }
  );

  room.on(
    "investigation",
    (
      _gId: string,
      data: {
        scanner: `0x${string}`;
        scannerName: string;
        target: `0x${string}`;
        targetName: string;
        result: string;
      }
    ) => {
      broadcastToGame(gameId, {
        type: "investigation",
        data,
      });
    }
  );
}

export function getConnectedClients(): number {
  return clients.size;
}

export function getGameSubscriberCount(gameId: string): number {
  return gameSubscribers.get(gameId)?.size || 0;
}
