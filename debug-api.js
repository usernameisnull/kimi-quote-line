#!/usr/bin/env node
// 调试脚本：查看 Kimi API 返回的原始数据

import { fetchQuota } from "./src/fetchQuota.js";
import { loadConfig } from "./src/config.js";
import { parseQuotaResponse } from "./src/parseQuota.js";

const config = loadConfig(process.env);

console.log("API URL:", config.quotaUrl);
console.log("API Key exists:", !!config.apiKey);

if (!config.apiKey) {
  console.log("\n错误: 未设置 API Key");
  process.exit(1);
}

const response = await fetchQuota(config);
console.log("\n--- 原始响应 ---");
console.log(JSON.stringify(response, null, 2));

if (response.kind === "json") {
  console.log("\n--- 解析结果 ---");
  const parsed = parseQuotaResponse(response);
  console.log(JSON.stringify(parsed, null, 2));
}
