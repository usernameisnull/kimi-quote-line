import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { Readable } from "node:stream";

import { loadConfig } from "../src/config.js";
import { formatStatus } from "../src/formatStatus.js";
import { parseArgs } from "../src/parseArgs.js";
import { getSessionId, readStatusLineInput } from "../src/readStatusLineInput.js";
import { runQuotaLine } from "../src/runQuotaLine.js";
import {
  buildInstalledStatusLineCommand,
  installClaudeStatusLine,
  readToolConfig,
  setToolConfigValue,
  uninstallClaudeStatusLine
} from "../src/userConfig.js";

// Kimi Code platform response format
// Using a fixed timestamp that works across timezones for testing
const TEST_RESET_TIME_MS = 1774939627716; // Fixed timestamp for consistent testing
const TEST_RESET_ISO = new Date(TEST_RESET_TIME_MS).toISOString();
const SUCCESS_BODY = {
  usage: {
    limit: 1000,
    used: 90,
    remaining: 910,
    reset_at: TEST_RESET_ISO
  },
  limits: [
    {
      detail: {
        limit: 1000,
        used: 90,
        remaining: 910,
        reset_at: TEST_RESET_ISO
      },
      window: {
        duration: 60,
        timeUnit: "MINUTE"
      }
    }
  ]
};

function createConfig(cacheFilePath, apiKey = "token", threadId = "thread-1") {
  return {
    quotaUrl: "https://api.kimi.com/coding/v1/usages",
    apiKey,
    timeoutMs: 5000,
    cacheTtlMs: 300_000,
    cacheFilePath,
    threadId
  };
}

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glm-quota-line-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function makeJsonResponse(body, status = 200) {
  return {
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("formats a successful response and writes cache", async () => {
  await withTempDir(async (dir) => {
    const cacheFilePath = path.join(dir, "cache.json");
    let fetchCalls = 0;

    const result = await runQuotaLine(createConfig(cacheFilePath), {
      now: 1774936504000,
      fetchImpl: async () => {
        fetchCalls += 1;
        return makeJsonResponse(SUCCESS_BODY);
      }
    });

    const expectedResetTime = new Date(TEST_RESET_TIME_MS).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

    assert.equal(fetchCalls, 1);
    assert.equal(result.kind, "success");
    assert.equal(result.display, "percent");
    assert.equal(formatStatus(result), `Kimi | 91% left | reset ${expectedResetTime}`);
    assert.equal(formatStatus(result, { displayMode: "used" }), `Kimi | 9% used | reset ${expectedResetTime}`);
    assert.equal(formatStatus(result, { style: "compact" }), `Kimi 91% | ${expectedResetTime}`);
    assert.equal(formatStatus(result, { style: "bar", barWidth: 10 }), `Kimi ■□□□□□□□□□ 91% | ${expectedResetTime}`);

    const cached = JSON.parse(await fs.readFile(cacheFilePath, "utf8"));
    assert.equal(cached.result.kind, "success");
    assert.equal(cached.result.leftPercent, 91);
    assert.equal(cached.threadId, "thread-1");
  });
});

test("returns auth expired without fetching when API key is missing", async () => {
  await withTempDir(async (dir) => {
    let fetchCalls = 0;

    const result = await runQuotaLine(createConfig(path.join(dir, "cache.json"), ""), {
      fetchImpl: async () => {
        fetchCalls += 1;
        return makeJsonResponse(SUCCESS_BODY);
      }
    });

    assert.equal(fetchCalls, 0);
    assert.equal(formatStatus(result), "Kimi | auth expired");
  });
});

test("returns fresh cached value without hitting the network", async () => {
  await withTempDir(async (dir) => {
    const cacheFilePath = path.join(dir, "cache.json");
    await fs.writeFile(
      cacheFilePath,
      JSON.stringify(
        {
          savedAt: 1774936504000,
          threadId: "thread-1",
          result: {
            kind: "success",
            level: "",
            display: "percent",
            leftPercent: 88,
            nextResetTime: 1774939627716
          }
        },
        null,
        2
      )
    );

    let fetchCalls = 0;
    const result = await runQuotaLine(createConfig(cacheFilePath), {
      now: 1774936505000,
      fetchImpl: async () => {
        fetchCalls += 1;
        return makeJsonResponse(SUCCESS_BODY);
      }
    });

    assert.equal(fetchCalls, 0);
    assert.equal(formatStatus(result), "Kimi | 88% left | reset 14:47");
  });
});

test("falls back to stale cache on unavailable responses", async () => {
  await withTempDir(async (dir) => {
    const cacheFilePath = path.join(dir, "cache.json");
    await fs.writeFile(
      cacheFilePath,
      JSON.stringify(
        {
          savedAt: 1774930000000,
          threadId: "thread-1",
          result: {
            kind: "success",
            level: "",
            display: "percent",
            leftPercent: 77,
            nextResetTime: 1774939627716
          }
        },
        null,
        2
      )
    );

    const result = await runQuotaLine(createConfig(cacheFilePath), {
      now: 1774936505000,
      fetchImpl: async () => ({
        status: 200,
        async text() {
          return "not-json";
        }
      })
    });

    assert.equal(formatStatus(result), "Kimi | 77% left | reset 14:47");
  });
});

test("auth failures do not reuse stale cache", async () => {
  await withTempDir(async (dir) => {
    const cacheFilePath = path.join(dir, "cache.json");
    await fs.writeFile(
      cacheFilePath,
      JSON.stringify(
        {
          savedAt: 1774930000000,
          threadId: "thread-1",
          result: {
            kind: "success",
            level: "",
            display: "percent",
            leftPercent: 77,
            nextResetTime: 1774939627716
          }
        },
        null,
        2
      )
    );

    const result = await runQuotaLine(createConfig(cacheFilePath), {
      now: 1774936505000,
      fetchImpl: async () =>
        makeJsonResponse({
          error: {
            code: "unauthorized",
            message: "Invalid API key"
          }
        })
    });

    assert.equal(formatStatus(result), "Kimi | auth expired");
  });
});

test("invalid tokens are treated as auth failures", async () => {
  await withTempDir(async (dir) => {
    const result = await runQuotaLine(createConfig(path.join(dir, "cache.json")), {
      fetchImpl: async () =>
        makeJsonResponse({
          code: "unauthenticated",
          message: "Invalid API key"
        })
    });

    assert.equal(formatStatus(result), "Kimi | auth expired");
  });
});

test("returns quota unavailable when no cache exists and the response is malformed", async () => {
  await withTempDir(async (dir) => {
    const result = await runQuotaLine(createConfig(path.join(dir, "cache.json")), {
      fetchImpl: async () => makeJsonResponse({ limits: [] })
    });

    assert.equal(formatStatus(result), "Kimi | quota unavailable");
  });
});

test("falls back to limits array when usage object is missing", async () => {
  await withTempDir(async (dir) => {
    const resetTimeMs = 1775022600000;
    const resetIso = new Date(resetTimeMs).toISOString();
    const result = await runQuotaLine(createConfig(path.join(dir, "cache.json")), {
      fetchImpl: async () =>
        makeJsonResponse({
          limits: [
            {
              detail: {
                limit: 100,
                used: 10,
                remaining: 90,
                reset_at: resetIso
              },
              window: {
                duration: 24,
                timeUnit: "HOUR"
              }
            }
          ]
        })
    });

    const expectedResetTime = new Date(resetTimeMs).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

    assert.equal(result.display, "percent");
    assert.equal(formatStatus(result), `Kimi | 90% left | reset ${expectedResetTime}`);
    assert.equal(
      formatStatus(result, { displayMode: "used" }),
      `Kimi | 10% used | reset ${expectedResetTime}`
    );
    assert.equal(formatStatus(result, { style: "compact" }), `Kimi 90% | ${expectedResetTime}`);
    assert.equal(formatStatus(result, { style: "bar", barWidth: 10 }), `Kimi ■□□□□□□□□□ 90% | ${expectedResetTime}`);
  });
});

test("parses CLI args for style and display", () => {
  const options = parseArgs(["--force", "--style", "bar", "--display=used"]);

  assert.deepEqual(options, {
    force: true,
    style: "bar",
    displayMode: "used",
    positionals: []
  });
});

test("official environment variables take priority and derive the quota URL", () => {
  const config = loadConfig({
    ANTHROPIC_AUTH_TOKEN: "sk-test-key",
    ANTHROPIC_BASE_URL: "https://api.kimi.com/coding/v1",
    CODEX_THREAD_ID: "thread-9"
  });

  assert.equal(config.apiKey, "sk-test-key");
  assert.equal(config.quotaUrl, "https://api.kimi.com/coding/v1/usages");
  assert.equal(config.cacheTtlMs, 300_000);
  assert.equal(config.threadId, "thread-9");
});

test("same thread and fresh cache do not trigger a network request", async () => {
  await withTempDir(async (dir) => {
    const cacheFilePath = path.join(dir, "cache.json");
    await fs.writeFile(
      cacheFilePath,
      JSON.stringify(
        {
          savedAt: 1774936504000,
          threadId: "thread-1",
          result: {
            kind: "success",
            level: "",
            display: "percent",
            leftPercent: 88,
            usedPercent: 12,
            nextResetTime: 1774939627716
          }
        },
        null,
        2
      )
    );

    let fetchCalls = 0;
    const result = await runQuotaLine(createConfig(cacheFilePath), {
      now: 1774936505000,
      fetchImpl: async () => {
        fetchCalls += 1;
        return makeJsonResponse(SUCCESS_BODY);
      }
    });

    assert.equal(fetchCalls, 0);
    assert.equal(formatStatus(result), "Kimi | 88% left | reset 14:47");
  });
});

test("a different thread id forces a refresh even when cache is fresh", async () => {
  await withTempDir(async (dir) => {
    const cacheFilePath = path.join(dir, "cache.json");
    await fs.writeFile(
      cacheFilePath,
      JSON.stringify(
        {
          savedAt: 1774936504000,
          threadId: "thread-old",
          result: {
            kind: "success",
            level: "",
            display: "percent",
            leftPercent: 88,
            usedPercent: 12,
            nextResetTime: TEST_RESET_TIME_MS
          }
        },
        null,
        2
      )
    );

    let fetchCalls = 0;
    const result = await runQuotaLine(createConfig(cacheFilePath, "token", "thread-new"), {
      now: 1774936505000,
      fetchImpl: async () => {
        fetchCalls += 1;
        return makeJsonResponse(SUCCESS_BODY);
      }
    });

    const expectedResetTime = new Date(TEST_RESET_TIME_MS).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

    assert.equal(fetchCalls, 1);
    assert.equal(formatStatus(result), `Kimi | 91% left | reset ${expectedResetTime}`);
  });
});

test("reads Claude status line input JSON from stdin", async () => {
  const stream = Readable.from([
    JSON.stringify({
      session_id: "claude-session-1",
      workspace: { current_dir: "D:/Code/claude-glm-quota-bar" }
    })
  ]);
  stream.isTTY = false;

  const input = await readStatusLineInput(stream);
  assert.equal(input.session_id, "claude-session-1");
});

test("prefers Claude session_id over CODEX_THREAD_ID", () => {
  const sessionId = getSessionId(
    { session_id: "claude-session-2" },
    { CODEX_THREAD_ID: "codex-thread-1" }
  );

  assert.equal(sessionId, "claude-session-2");
});

test("falls back to CODEX_THREAD_ID when Claude session metadata is absent", () => {
  const sessionId = getSessionId(null, { CODEX_THREAD_ID: "codex-thread-2" });
  assert.equal(sessionId, "codex-thread-2");
});

test("bar style uses filled cells for used percentage and spaces for unused percentage", () => {
  const result = {
    kind: "success",
    level: "",
    display: "percent",
    leftPercent: 97,
    usedPercent: 3,
    nextResetTime: 1774939627716
  };

  // 3% used with barWidth 10 = 1 filled cell (3% of 10 = 0.3, min 1)
  assert.equal(formatStatus(result, { style: "bar", barWidth: 10 }), "Kimi ■□□□□□□□□□ 97% | 14:47");
});

test("bar style fills completely only when used percentage reaches 100", () => {
  const result = {
    kind: "success",
    level: "",
    display: "percent",
    leftPercent: 0,
    usedPercent: 100,
    nextResetTime: 1774939627716
  };

  assert.equal(formatStatus(result, { style: "bar", barWidth: 10 }), "Kimi ■■■■■■■■■■ 0% | 14:47");
});

test("writes tool config values for style and display", async () => {
  await withTempDir(async (dir) => {
    const configPath = path.join(dir, "glm-quota-line.json");

    await setToolConfigValue("style", "bar", configPath);
    await setToolConfigValue("displayMode", "used", configPath);

    const config = await readToolConfig(configPath);
    assert.deepEqual(config, {
      schemaVersion: 1,
      managedBy: "glm-quota-line",
      style: "bar",
      displayMode: "used",
      install: {}
    });
  });
});

test("installClaudeStatusLine writes a managed statusLine command", async () => {
  await withTempDir(async (dir) => {
    const settingsPath = path.join(dir, "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          theme: "dark"
        },
        null,
        2
      )
    );

    const command = buildInstalledStatusLineCommand("C:\\Program Files\\nodejs\\node.exe");
    const configPath = path.join(dir, "glm-quota-line.json");
    const result = await installClaudeStatusLine(command, settingsPath, configPath);
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    const toolConfig = await readToolConfig(configPath);

    assert.equal(result.installed, true);
    assert.equal(result.command, command);
    assert.equal(settings.theme, "dark");
    assert.deepEqual(settings.statusLine, {
      type: "command",
      command
    });
    assert.deepEqual(toolConfig.install, {
      settingsPath,
      command,
      installed: true
    });
  });
});

test("installClaudeStatusLine does not overwrite unmanaged statusLine without force", async () => {
  await withTempDir(async (dir) => {
    const settingsPath = path.join(dir, "settings.json");
    const command = buildInstalledStatusLineCommand("C:\\Program Files\\nodejs\\node.exe");
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          statusLine: {
            type: "command",
            command: "echo custom"
          },
          theme: "dark"
        },
        null,
        2
      )
    );

    const configPath = path.join(dir, "glm-quota-line.json");
    const result = await installClaudeStatusLine(command, settingsPath, configPath);
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    const toolConfig = await readToolConfig(configPath);

    assert.equal(result.installed, false);
    assert.equal(result.reason, "unmanaged_exists");
    assert.equal(settings.statusLine.command, "echo custom");
    assert.deepEqual(toolConfig.install, {});
  });
});

test("installClaudeStatusLine with force backs up existing unmanaged statusLine", async () => {
  await withTempDir(async (dir) => {
    const settingsPath = path.join(dir, "settings.json");
    const command = buildInstalledStatusLineCommand("C:\\Program Files\\nodejs\\node.exe");
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          statusLine: {
            type: "command",
            command: "echo custom"
          },
          theme: "dark"
        },
        null,
        2
      )
    );

    const configPath = path.join(dir, "glm-quota-line.json");
    const result = await installClaudeStatusLine(command, settingsPath, configPath, {
      force: true
    });
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    const toolConfig = await readToolConfig(configPath);

    assert.equal(result.installed, true);
    assert.equal(settings.statusLine.command, command);
    assert.deepEqual(toolConfig.install.previousStatusLine, {
      type: "command",
      command: "echo custom"
    });
  });
});

test("uninstallClaudeStatusLine restores previously backed up statusLine", async () => {
  await withTempDir(async (dir) => {
    const settingsPath = path.join(dir, "settings.json");
    const configPath = path.join(dir, "glm-quota-line.json");
    const command = buildInstalledStatusLineCommand("C:\\Program Files\\nodejs\\node.exe");

    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          statusLine: {
            type: "command",
            command
          }
        },
        null,
        2
      )
    );

    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          managedBy: "glm-quota-line",
          install: {
            previousStatusLine: {
              type: "command",
              command: "echo previous"
            }
          }
        },
        null,
        2
      )
    );

    const result = await uninstallClaudeStatusLine(settingsPath, configPath);
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    const toolConfig = await readToolConfig(configPath);

    assert.equal(result.removed, true);
    assert.equal(settings.statusLine.command, "echo previous");
    assert.deepEqual(toolConfig.install, {});
  });
});

test("uninstallClaudeStatusLine removes only managed statusLine entries when no backup exists", async () => {
  await withTempDir(async (dir) => {
    const settingsPath = path.join(dir, "settings.json");
    const configPath = path.join(dir, "glm-quota-line.json");
    const command = buildInstalledStatusLineCommand("C:\\Program Files\\nodejs\\node.exe");
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          statusLine: {
            type: "command",
            command
          },
          theme: "dark"
        },
        null,
        2
      )
    );

    const removed = await uninstallClaudeStatusLine(settingsPath, configPath);
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));

    assert.equal(removed.removed, true);
    assert.equal(settings.theme, "dark");
    assert.equal("statusLine" in settings, false);
  });
});

test("uninstallClaudeStatusLine leaves unrelated statusLine entries untouched", async () => {
  await withTempDir(async (dir) => {
    const settingsPath = path.join(dir, "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          statusLine: {
            type: "command",
            command: "echo custom"
          }
        },
        null,
        2
      )
    );

    const result = await uninstallClaudeStatusLine(settingsPath, path.join(dir, "glm-quota-line.json"));
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));

    assert.equal(result.removed, false);
    assert.equal(result.reason, "unmanaged");
    assert.equal(settings.statusLine.command, "echo custom");
  });
});
