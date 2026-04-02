import os from "node:os";
import path from "node:path";

const DEFAULT_QUOTA_URL = "https://api.kimi.com/coding/v1/usages";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_MS = 300_000;
const DEFAULT_DISPLAY_MODE = "left";
const DEFAULT_STYLE = "text";
const DEFAULT_BAR_WIDTH = 10;

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getCacheRoot() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches");
  }

  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  }

  return process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
}

function deriveQuotaUrl(baseUrl) {
  if (!baseUrl) {
    return "";
  }

  try {
    const parsedBaseUrl = new URL(baseUrl);

    // Kimi Code platform
    if (parsedBaseUrl.host.includes("api.kimi.com")) {
      return `${baseUrl.replace(/\/$/, "")}/usages`;
    }
  } catch {
    return "";
  }

  return "";
}

export function loadConfig(env = process.env) {
  const cacheRoot = getCacheRoot();
  const anthropicBaseUrl = env.ANTHROPIC_BASE_URL || "";
  const derivedQuotaUrl = deriveQuotaUrl(anthropicBaseUrl);
  
  // Use ANTHROPIC_AUTH_TOKEN (Claude Code official) as Kimi API Key
  const apiKey = env.ANTHROPIC_AUTH_TOKEN || env.KIMI_API_KEY || env.KIMI_AUTHORIZATION || "";

  return {
    quotaUrl: derivedQuotaUrl || DEFAULT_QUOTA_URL,
    apiKey,
    anthropicBaseUrl,
    timeoutMs: parsePositiveInt(env.KIMI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    cacheTtlMs: parsePositiveInt(env.KIMI_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS),
    displayMode: env.KIMI_DISPLAY_MODE || DEFAULT_DISPLAY_MODE,
    style: env.KIMI_STYLE || DEFAULT_STYLE,
    barWidth: parsePositiveInt(env.KIMI_BAR_WIDTH, DEFAULT_BAR_WIDTH),
    cacheFilePath: path.join(cacheRoot, "kimi-quota-line", "cache.json"),
    threadId: env.CODEX_THREAD_ID || ""
  };
}
