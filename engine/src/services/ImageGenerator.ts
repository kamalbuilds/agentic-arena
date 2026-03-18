import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const imageLogger = logger.child("ImageGenerator");

const FALLBACK_API_KEY = process.env.GEMINI_API_KEY!;

function getApiKey(): string {
  return config.gemini.apiKey || FALLBACK_API_KEY;
}

function getGenAI(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(getApiKey());
}

// ---------- Imagen REST API helper ----------

interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}

async function generateImageWithImagen(
  prompt: string
): Promise<string | null> {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          safetyFilterLevel: "block_few",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      imageLogger.warn(
        `Imagen API returned ${response.status}: ${errText}`
      );
      return null;
    }

    const data = (await response.json()) as ImagenResponse;
    if (data.predictions && data.predictions.length > 0) {
      const base64 = data.predictions[0].bytesBase64Encoded;
      const mime = data.predictions[0].mimeType || "image/png";
      return `data:${mime};base64,${base64}`;
    }

    return null;
  } catch (err) {
    imageLogger.warn("Imagen request failed, will fallback to SVG", err);
    return null;
  }
}

// ---------- SVG fallback via Gemini text model ----------

async function generateSvgFallback(description: string): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = [
    "Generate a complete, valid SVG image (only the raw SVG markup, no markdown fences, no explanation).",
    "The SVG should be 512x512 pixels with a vibrant, cartoon style.",
    `Subject: ${description}`,
    "Use bold colours, clean shapes, and make it visually striking.",
    "Return ONLY the <svg>...</svg> markup.",
  ].join("\n");

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract the SVG tag even if the model wraps it in backticks
    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) {
      const svg = svgMatch[0];
      const base64 = Buffer.from(svg, "utf-8").toString("base64");
      return `data:image/svg+xml;base64,${base64}`;
    }

    imageLogger.warn("Gemini did not return valid SVG, using placeholder");
    return generatePlaceholderSvg(description);
  } catch (err) {
    imageLogger.error("SVG fallback generation failed", err);
    return generatePlaceholderSvg(description);
  }
}

function generatePlaceholderSvg(text: string): string {
  const hue = Math.abs(hashCode(text)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue},80%,40%)"/>
      <stop offset="100%" style="stop-color:hsl(${(hue + 60) % 360},80%,30%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" rx="32"/>
  <text x="256" y="200" text-anchor="middle" fill="white" font-size="100" font-family="Arial">🦞</text>
  <text x="256" y="340" text-anchor="middle" fill="white" font-size="28" font-family="Arial, sans-serif" font-weight="bold">${escapeXml(text.slice(0, 30))}</text>
  <text x="256" y="400" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="20" font-family="Arial, sans-serif">Claw Wars</text>
</svg>`;
  const base64 = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- Prompt builder via Gemini ----------

async function buildImagePrompt(baseDescription: string): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = [
    "You are a prompt engineer for an image generation model.",
    "Given the following description, produce a single, concise image-generation prompt (max 200 words) that will result in a high-quality, vibrant cartoon illustration.",
    "The art style should be whimsical, colourful, and suitable for a social-deduction game featuring lobster characters.",
    "Return ONLY the prompt text, nothing else.",
    "",
    `Description: ${baseDescription}`,
  ].join("\n");

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    imageLogger.warn("Prompt building failed, using base description", err);
    return baseDescription;
  }
}

// ---------- Public API ----------

export interface GeneratedImage {
  dataUri: string;
  prompt: string;
  source: "imagen" | "svg-gemini" | "svg-placeholder";
}

/**
 * Generate a unique lobster/impostor themed avatar for an agent.
 */
export async function generateAgentAvatar(
  agentName: string,
  role?: string
): Promise<GeneratedImage> {
  const roleHint = role ? ` playing as a ${role}` : "";
  const baseDesc = `A cartoon lobster character named "${agentName}"${roleHint} in the style of Among Us. The lobster is anthropomorphic with a colourful space suit, unique accessories, and expressive eyes. Vibrant background.`;

  imageLogger.info(`Generating avatar for ${agentName}`);

  const prompt = await buildImagePrompt(baseDesc);

  // Try Imagen first
  const imagenResult = await generateImageWithImagen(prompt);
  if (imagenResult) {
    imageLogger.info(`Avatar for ${agentName} generated via Imagen`);
    return { dataUri: imagenResult, prompt, source: "imagen" };
  }

  // Fallback to SVG via Gemini
  imageLogger.info(`Falling back to SVG generation for ${agentName}`);
  const svgResult = await generateSvgFallback(baseDesc);
  const source = svgResult.includes("<svg") ? "svg-placeholder" : "svg-gemini";
  return { dataUri: svgResult, prompt, source: source === "svg-placeholder" ? "svg-placeholder" : "svg-gemini" };
}

/**
 * Generate a banner image for a new game announcement on Moltbook.
 */
export async function generateGameBanner(
  gameId: string,
  playerCount: number,
  stake: string
): Promise<GeneratedImage> {
  const baseDesc = `A dramatic game announcement banner for "Claw Wars" - a social deduction game with lobster characters. ${playerCount} lobster players gather on a futuristic underwater space station. Stake: ${stake}. The mood is tense and exciting. Wide cinematic format.`;

  imageLogger.info(`Generating game banner for ${gameId}`);

  const prompt = await buildImagePrompt(baseDesc);

  const imagenResult = await generateImageWithImagen(prompt);
  if (imagenResult) {
    imageLogger.info(`Game banner for ${gameId} generated via Imagen`);
    return { dataUri: imagenResult, prompt, source: "imagen" };
  }

  imageLogger.info(`Falling back to SVG generation for game banner ${gameId}`);
  const svgResult = await generateSvgFallback(baseDesc);
  return {
    dataUri: svgResult,
    prompt,
    source: svgResult.includes("placeholder") ? "svg-placeholder" : "svg-gemini",
  };
}

/**
 * Generate a dramatic elimination reveal image.
 */
export async function generateEliminationImage(
  agentName: string,
  role: string,
  wasImpostor: boolean
): Promise<GeneratedImage> {
  const outcome = wasImpostor
    ? "revealed as a sinister impostor with glowing red eyes and dark tendrils"
    : "revealed as an innocent crewmate, wrongly accused, looking betrayed";

  const baseDesc = `A dramatic elimination scene: lobster character "${agentName}" is ${outcome}. Spotlight effect, dramatic shadows, the other lobster characters watching in shock. Social deduction game art style.`;

  imageLogger.info(`Generating elimination image for ${agentName}`);

  const prompt = await buildImagePrompt(baseDesc);

  const imagenResult = await generateImageWithImagen(prompt);
  if (imagenResult) {
    return { dataUri: imagenResult, prompt, source: "imagen" };
  }

  const svgResult = await generateSvgFallback(baseDesc);
  return {
    dataUri: svgResult,
    prompt,
    source: svgResult.includes("placeholder") ? "svg-placeholder" : "svg-gemini",
  };
}

/**
 * Generate a victory celebration image.
 */
export async function generateWinnerImage(
  winners: string[],
  result: string
): Promise<GeneratedImage> {
  const winnerList = winners.slice(0, 5).join(", ");
  const isImpostorWin = result.toLowerCase().includes("impostor");

  const baseDesc = isImpostorWin
    ? `A dark victory scene: the impostor lobster celebrates among defeated crewmates. Evil grin, dramatic red lighting, confetti of claw marks. Winners: ${winnerList}. Game over screen style.`
    : `A triumphant celebration: the crewmate lobsters cheer in victory, confetti and fireworks, bright joyful colours. Winners: ${winnerList}. The underwater space station is saved. Game over screen style.`;

  imageLogger.info(`Generating winner image for: ${result}`);

  const prompt = await buildImagePrompt(baseDesc);

  const imagenResult = await generateImageWithImagen(prompt);
  if (imagenResult) {
    return { dataUri: imagenResult, prompt, source: "imagen" };
  }

  const svgResult = await generateSvgFallback(baseDesc);
  return {
    dataUri: svgResult,
    prompt,
    source: svgResult.includes("placeholder") ? "svg-placeholder" : "svg-gemini",
  };
}

/**
 * Generate an image to accompany a Moltbook post.
 */
export async function generateMoltbookPostImage(
  content: string
): Promise<GeneratedImage> {
  // Truncate content to avoid overly long prompts
  const truncated = content.length > 300 ? content.slice(0, 300) + "..." : content;

  const baseDesc = `An illustration for a social media post about the "Claw Wars" lobster social-deduction game. The post says: "${truncated}". Create a fitting, eye-catching illustration with lobster characters.`;

  imageLogger.info("Generating Moltbook post image");

  const prompt = await buildImagePrompt(baseDesc);

  const imagenResult = await generateImageWithImagen(prompt);
  if (imagenResult) {
    return { dataUri: imagenResult, prompt, source: "imagen" };
  }

  const svgResult = await generateSvgFallback(baseDesc);
  return {
    dataUri: svgResult,
    prompt,
    source: svgResult.includes("placeholder") ? "svg-placeholder" : "svg-gemini",
  };
}
