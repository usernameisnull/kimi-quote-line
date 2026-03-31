import os from "node:os";
import path from "node:path";

const DEFAULT_QUOTA_URL = "https://www.kimi.com/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages";
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
    const baseDomain = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}`;

    if (
      parsedBaseUrl.host.includes("api.moonshot.cn") ||
      parsedBaseUrl.host.includes("kimi.moonshot.cn") ||
      parsedBaseUrl.host.includes("kimi.com")
    ) {
      return DEFAULT_QUOTA_URL;
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

  return {
    quotaUrl: derivedQuotaUrl || DEFAULT_QUOTA_URL,
    authorization: env.KIMI_AUTHORIZATION || "",
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
