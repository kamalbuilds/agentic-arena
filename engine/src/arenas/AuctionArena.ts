import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";

const log = logger.child("AuctionArena");

// ── Type Definitions ─────────────────────────────────────────────────────

export type AuctionFormat = "english" | "dutch" | "sealed" | "vickrey";

export interface AuctionItem {
  id: string;
  name: string;
  description: string;
  category: "power-up" | "intelligence" | "alliance" | "sabotage" | "wildcard";
  baseValue: string; // USDC
  metadata: Record<string, unknown>;
}

export interface AuctionBid {
  agentAddress: string;
  agentName: string;
  amount: string;
  timestamp: number;
  reasoning: string;
  round: number;
}

export interface Auction {
  id: string;
  format: AuctionFormat;
  item: AuctionItem;
  status: "pending" | "active" | "completed";
  startTime: number;
  endTime: number;
  startingPrice: string;
  currentPrice: string; // for dutch auctions, decreasing
  minimumIncrement: string;
  bids: AuctionBid[];
  winner?: string;
  winningPrice?: string;
  participants: Set<string>;
}

export interface AuctionResult {
  auctionId: string;
  item: AuctionItem;
  format: AuctionFormat;
  winner: string;
  winnerName: string;
  pricePaid: string;
  totalBids: number;
  participantCount: number;
  duration: number;
  bidHistory: AuctionBid[];
}

export interface AuctionSession {
  id: string;
  name: string;
  auctions: Auction[];
  participants: Map<string, { balance: string; itemsWon: AuctionItem[]; totalSpent: string }>;
  status: "pending" | "active" | "completed";
  startTime: number;
}

// ── Game Item Templates ──────────────────────────────────────────────────

interface GameItemTemplate {
  name: string;
  description: string;
  category: "power-up" | "intelligence" | "alliance" | "sabotage" | "wildcard";
  baseValue: string;
  metadata: Record<string, unknown>;
}

const GAME_ITEM_TEMPLATES: GameItemTemplate[] = [
  {
    name: "Detective's Lens",
    description: "Reveals one player's role during the next voting phase",
    category: "intelligence",
    baseValue: "50.00",
    metadata: { impact: "high", duration: "single-use", affectsRoles: true },
  },
  {
    name: "Smoke Bomb",
    description: "Cancels the next vote round entirely, forcing all players to reset",
    category: "sabotage",
    baseValue: "60.00",
    metadata: { impact: "critical", duration: "single-use", affectsGame: true },
  },
  {
    name: "Alliance Pact",
    description: "Protects you from elimination once in the next round",
    category: "alliance",
    baseValue: "45.00",
    metadata: { impact: "high", duration: "single-use", defensive: true },
  },
  {
    name: "Double Vote",
    description: "Your vote counts as two votes in the next voting round",
    category: "power-up",
    baseValue: "55.00",
    metadata: { impact: "high", duration: "single-use", multiplier: 2 },
  },
  {
    name: "Wild Card",
    description: "Randomly changes your role to an adjacent role in the game",
    category: "wildcard",
    baseValue: "70.00",
    metadata: { impact: "extreme", duration: "permanent", unpredictable: true },
  },
  {
    name: "Whisper Network",
    description: "Send a private message to one player that others cannot see",
    category: "alliance",
    baseValue: "35.00",
    metadata: { impact: "medium", duration: "single-use", communication: true },
  },
  {
    name: "Silent Watch",
    description: "See who voted for whom in the next vote without revealing yourself",
    category: "intelligence",
    baseValue: "40.00",
    metadata: { impact: "medium", duration: "single-use", intel: true },
  },
  {
    name: "Distraction",
    description: "Make one player unable to participate in the next voting round",
    category: "sabotage",
    baseValue: "50.00",
    metadata: { impact: "high", duration: "single-use", disables: true },
  },
  {
    name: "Reputation Shield",
    description: "All votes against you in the next round are hidden from others",
    category: "power-up",
    baseValue: "48.00",
    metadata: { impact: "medium", duration: "single-use", defensive: true },
  },
  {
    name: "Role Swap",
    description: "Swap your role with another player's role for one round",
    category: "wildcard",
    baseValue: "65.00",
    metadata: { impact: "extreme", duration: "single-use", swaps: true },
  },
];

// ── AuctionArena Class ───────────────────────────────────────────────────

class AuctionArena extends EventEmitter {
  private sessions = new Map<string, AuctionSession>();
  private auctions = new Map<string, Auction>();
  private nextSessionId = 0;
  private nextAuctionId = 0;
  private nextItemId = 0;
  private dutchAuctionIntervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    log.info("AuctionArena initialized");
  }

  /**
   * Create a new auction session
   */
  createSession(name: string, participants: string[]): AuctionSession {
    const id = `session-${this.nextSessionId++}-${Date.now()}`;
    const participantMap = new Map<string, { balance: string; itemsWon: AuctionItem[]; totalSpent: string }>();

    participants.forEach((addr) => {
      participantMap.set(addr.toLowerCase(), {
        balance: "1000.00", // Starting balance
        itemsWon: [],
        totalSpent: "0",
      });
    });

    const session: AuctionSession = {
      id,
      name,
      auctions: [],
      participants: participantMap,
      status: "pending",
      startTime: Date.now(),
    };

    this.sessions.set(id, session);
    log.info(`Auction session created: ${id} - "${name}" with ${participants.length} participants`);
    this.emit("sessionCreated", session);

    return session;
  }

  /**
   * Add an auction to a session
   */
  addAuction(
    sessionId: string,
    item: AuctionItem,
    format: AuctionFormat,
    startingPrice: string,
    durationMs: number
  ): Auction | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      log.warn(`Session not found: ${sessionId}`);
      return null;
    }

    const id = `auction-${this.nextAuctionId++}-${Date.now()}`;
    const now = Date.now();
    const auction: Auction = {
      id,
      format,
      item,
      status: "pending",
      startTime: now,
      endTime: now + durationMs,
      startingPrice,
      currentPrice: startingPrice,
      minimumIncrement: (parseFloat(startingPrice) * 0.05).toFixed(2), // 5% minimum increment
      bids: [],
      participants: new Set(),
    };

    this.auctions.set(id, auction);
    session.auctions.push(auction);

    log.info(`Auction created: ${id} - "${item.name}" (${format}) in session ${sessionId}`, {
      startingPrice,
      duration: durationMs,
    });
    this.emit("auctionCreated", auction);

    return auction;
  }

  /**
   * Start an auction (move from pending to active)
   */
  startAuction(auctionId: string): Auction | null {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      log.warn(`Auction not found: ${auctionId}`);
      return null;
    }

    if (auction.status !== "pending") {
      log.warn(`Auction is not pending: ${auctionId}`);
      return null;
    }

    auction.status = "active";
    log.info(`Auction started: ${auctionId}`);
    this.emit("auctionStarted", auction);

    // For dutch auctions, start the price decrease
    if (auction.format === "dutch") {
      this.startDutchAuctionPriceDecay(auctionId);
    }

    return auction;
  }

  /**
   * Place a bid in an auction
   */
  placeBid(
    auctionId: string,
    agentAddress: string,
    agentName: string,
    amount: string,
    reasoning: string
  ): AuctionBid | null {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      log.warn(`Auction not found: ${auctionId}`);
      return null;
    }

    if (auction.status !== "active") {
      log.warn(`Auction is not active: ${auctionId}`);
      return null;
    }

    const amountNum = parseFloat(amount);
    const currentPriceNum = parseFloat(auction.currentPrice);
    const minIncrementNum = parseFloat(auction.minimumIncrement);

    // Validation based on format
    if (auction.format === "english") {
      if (amountNum < currentPriceNum + minIncrementNum) {
        log.warn(`Bid amount too low for english auction: ${amount} < ${currentPriceNum + minIncrementNum}`);
        return null;
      }
      auction.currentPrice = amount;
    } else if (auction.format === "dutch") {
      // For dutch, agent accepts the current decreasing price
      if (amountNum < currentPriceNum) {
        log.warn(`Bid amount too low for dutch auction: ${amount} < ${currentPriceNum}`);
        return null;
      }
      // Dutch auction ends immediately when someone accepts
      auction.currentPrice = amount;
      auction.winner = agentAddress;
      auction.winningPrice = amount;
      this.endAuction(auctionId);
    } else if (auction.format === "sealed" || auction.format === "vickrey") {
      // Sealed bids: just record, no validation against current price
      if (amountNum <= 0) {
        log.warn(`Invalid sealed bid amount: ${amount}`);
        return null;
      }
    }

    const bid: AuctionBid = {
      agentAddress: agentAddress.toLowerCase(),
      agentName,
      amount,
      timestamp: Date.now(),
      reasoning,
      round: auction.bids.length + 1,
    };

    auction.bids.push(bid);
    auction.participants.add(agentAddress.toLowerCase());

    log.info(`Bid placed: ${agentName} bid ${amount} on ${auctionId}`, { reasoning });
    this.emit("bidPlaced", auctionId, bid);

    return bid;
  }

  /**
   * For Dutch auctions: decrease price over time
   */
  private startDutchAuctionPriceDecay(auctionId: string): void {
    const auction = this.auctions.get(auctionId);
    if (!auction || auction.format !== "dutch") return;

    const startPrice = parseFloat(auction.startingPrice);
    const endPrice = startPrice * 0.1; // Floor at 10% of start price
    const duration = auction.endTime - auction.startTime;
    const decayRate = (startPrice - endPrice) / (duration / 1000); // Per second

    const interval = setInterval(() => {
      if (!this.auctions.has(auctionId)) {
        clearInterval(interval);
        this.dutchAuctionIntervals.delete(auctionId);
        return;
      }

      const auction = this.auctions.get(auctionId);
      if (!auction || auction.status !== "active") {
        clearInterval(interval);
        this.dutchAuctionIntervals.delete(auctionId);
        return;
      }

      const elapsed = (Date.now() - auction.startTime) / 1000;
      let newPrice = startPrice - decayRate * elapsed;
      newPrice = Math.max(newPrice, endPrice);

      auction.currentPrice = newPrice.toFixed(2);

      if (Date.now() >= auction.endTime) {
        clearInterval(interval);
        this.dutchAuctionIntervals.delete(auctionId);
        this.endAuction(auctionId);
      }
    }, 500); // Update price every 500ms

    this.dutchAuctionIntervals.set(auctionId, interval);
  }

  /**
   * Resolve a sealed-bid or vickrey auction
   */
  resolveSealedAuction(auctionId: string): AuctionResult | null {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      log.warn(`Auction not found: ${auctionId}`);
      return null;
    }

    if (auction.format !== "sealed" && auction.format !== "vickrey") {
      log.warn(`Auction is not sealed/vickrey: ${auctionId}`);
      return null;
    }

    if (auction.bids.length === 0) {
      log.warn(`No bids in sealed auction: ${auctionId}`);
      auction.status = "completed";
      this.emit("auctionCompleted", auctionId, null);
      return null;
    }

    // Find highest bid
    let highestBid = auction.bids[0];
    for (const bid of auction.bids) {
      if (parseFloat(bid.amount) > parseFloat(highestBid.amount)) {
        highestBid = bid;
      }
    }

    auction.winner = highestBid.agentAddress;
    auction.winningPrice =
      auction.format === "vickrey"
        ? this.getSecondHighestBidAmount(auction.bids, highestBid.amount)
        : highestBid.amount;

    auction.status = "completed";

    const result: AuctionResult = {
      auctionId: auction.id,
      item: auction.item,
      format: auction.format,
      winner: auction.winner,
      winnerName: highestBid.agentName,
      pricePaid: auction.winningPrice,
      totalBids: auction.bids.length,
      participantCount: auction.participants.size,
      duration: auction.endTime - auction.startTime,
      bidHistory: auction.bids,
    };

    log.info(`Sealed auction resolved: ${auctionId}`, {
      winner: highestBid.agentName,
      pricePaid: auction.winningPrice,
      format: auction.format,
    });
    this.emit("auctionCompleted", auctionId, result);

    return result;
  }

  /**
   * Get the second-highest bid amount for Vickrey auctions
   */
  private getSecondHighestBidAmount(bids: AuctionBid[], highestAmount: string): string {
    const amounts = bids.map((b) => parseFloat(b.amount)).sort((a, b) => b - a);
    if (amounts.length < 2) return highestAmount;
    return amounts[1].toFixed(2);
  }

  /**
   * End an auction and determine winner (for English auctions)
   */
  endAuction(auctionId: string): AuctionResult | null {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      log.warn(`Auction not found: ${auctionId}`);
      return null;
    }

    if (auction.status === "completed") {
      log.warn(`Auction already completed: ${auctionId}`);
      return null;
    }

    // Clear any dutch auction decay interval
    if (this.dutchAuctionIntervals.has(auctionId)) {
      clearInterval(this.dutchAuctionIntervals.get(auctionId));
      this.dutchAuctionIntervals.delete(auctionId);
    }

    auction.status = "completed";

    // For sealed/vickrey, resolve them
    if (auction.format === "sealed" || auction.format === "vickrey") {
      return this.resolveSealedAuction(auctionId);
    }

    // For english, highest bid wins
    if (auction.format === "english" && auction.bids.length > 0) {
      const highestBid = auction.bids.reduce((max, bid) =>
        parseFloat(bid.amount) > parseFloat(max.amount) ? bid : max
      );
      auction.winner = highestBid.agentAddress;
      auction.winningPrice = highestBid.amount;
    }

    // For dutch, winner should already be set
    if (auction.format === "dutch" && !auction.winner) {
      log.warn(`Dutch auction ended with no winner: ${auctionId}`);
    }

    const result: AuctionResult | null =
      auction.winner && auction.winningPrice
        ? {
            auctionId: auction.id,
            item: auction.item,
            format: auction.format,
            winner: auction.winner,
            winnerName: auction.bids.find((b) => b.agentAddress === auction.winner)?.agentName || "Unknown",
            pricePaid: auction.winningPrice,
            totalBids: auction.bids.length,
            participantCount: auction.participants.size,
            duration: auction.endTime - auction.startTime,
            bidHistory: auction.bids,
          }
        : null;

    log.info(`Auction ended: ${auctionId}`, {
      winner: result?.winnerName || "No winner",
      pricePaid: result?.pricePaid || "N/A",
    });
    this.emit("auctionCompleted", auctionId, result);

    return result;
  }

  /**
   * Get session results
   */
  getSessionResults(sessionId: string): AuctionResult[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      log.warn(`Session not found: ${sessionId}`);
      return [];
    }

    const results: AuctionResult[] = [];

    for (const auction of session.auctions) {
      if (auction.status === "completed" && auction.winner && auction.winningPrice) {
        results.push({
          auctionId: auction.id,
          item: auction.item,
          format: auction.format,
          winner: auction.winner,
          winnerName: auction.bids.find((b) => b.agentAddress === auction.winner)?.agentName || "Unknown",
          pricePaid: auction.winningPrice,
          totalBids: auction.bids.length,
          participantCount: auction.participants.size,
          duration: auction.endTime - auction.startTime,
          bidHistory: auction.bids,
        });
      }
    }

    return results;
  }

  /**
   * Get an auction by ID
   */
  getAuction(auctionId: string): Auction | null {
    return this.auctions.get(auctionId) || null;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): AuctionSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Generate random game items
   */
  generateGameItems(count: number = 5): AuctionItem[] {
    const items: AuctionItem[] = [];
    const selectedTemplates = new Set<number>();

    while (items.length < count && selectedTemplates.size < GAME_ITEM_TEMPLATES.length) {
      const idx = Math.floor(Math.random() * GAME_ITEM_TEMPLATES.length);
      if (!selectedTemplates.has(idx)) {
        selectedTemplates.add(idx);
        const template = GAME_ITEM_TEMPLATES[idx];
        items.push({
          id: `item-${this.nextItemId++}-${Date.now()}`,
          name: template.name,
          description: template.description,
          category: template.category,
          baseValue: template.baseValue,
          metadata: template.metadata,
        });
      }
    }

    return items;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): AuctionSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get the global state
   */
  getState(): object {
    const activeSessions = Array.from(this.sessions.values()).filter((s) => s.status === "active");
    const activeAuctions = Array.from(this.auctions.values()).filter((a) => a.status === "active");
    const completedAuctions = Array.from(this.auctions.values()).filter((a) => a.status === "completed");

    return {
      sessions: {
        total: this.sessions.size,
        active: activeSessions.length,
        completed: Array.from(this.sessions.values()).filter((s) => s.status === "completed").length,
      },
      auctions: {
        total: this.auctions.size,
        active: activeAuctions.length,
        completed: completedAuctions.length,
      },
      stats: {
        totalBids: Array.from(this.auctions.values()).reduce((sum, a) => sum + a.bids.length, 0),
        totalParticipants: new Set(
          Array.from(this.auctions.values())
            .flatMap((a) => Array.from(a.participants))
            .map((addr) => addr.toLowerCase())
        ).size,
        totalVolumeUSDC: Array.from(this.auctions.values())
          .filter((a) => a.status === "completed" && a.winningPrice)
          .reduce((sum, a) => sum + parseFloat(a.winningPrice || "0"), 0)
          .toFixed(2),
      },
    };
  }
}

// ── Singleton Export ─────────────────────────────────────────────────────

export const auctionArena = new AuctionArena();
