function asFiniteNumber(value) {
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Number.isFinite(value) ? value : null;
}

function isAuthFailureMessage(value) {
  if (typeof value !== "string") {
    return false;
  }

  return /authorization|身份验证|鉴权|auth|令牌|token|过期|验证不正确|invalid|unauthorized/i.test(value);
}

function parseResetTime(resetTimeValue) {
  if (typeof resetTimeValue === "string") {
    const date = new Date(resetTimeValue);
    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
  }
  return asFiniteNumber(resetTimeValue);
}

export function parseQuotaResponse(response) {
  if (!response || response.kind !== "json") {
    return { kind: "unavailable" };
  }

  const payload = response.json;
  if (!payload || typeof payload !== "object") {
    return { kind: "unavailable" };
  }

  // Handle error response
  if (payload.error) {
    if (payload.error.code === "invalid_auth" ||
        payload.error.code === "unauthorized" ||
        isAuthFailureMessage(payload.error.message)) {
      return { kind: "auth_error" };
    }
    return { kind: "unavailable" };
  }

  // Handle Kimi error format: { code: "unauthenticated", details: [...] }
  if (payload.code === "unauthenticated" ||
      payload.code === "unauthorized" ||
      isAuthFailureMessage(payload.code)) {
    return { kind: "auth_error" };
  }

  // Handle Kimi GetUsages API response format
  // { "usages": [{ "scope": "FEATURE_CODING", "detail": { "limit", "used", "remaining", "resetTime" }, "limits": [...] }] }
  const usages = Array.isArray(payload.usages) ? payload.usages : [];
  const codingUsage = usages.find(u => u?.scope === "FEATURE_CODING");

  if (codingUsage && codingUsage.detail && typeof codingUsage.detail === "object") {
    const detail = codingUsage.detail;
    const limit = asFiniteNumber(detail.limit);
    const used = asFiniteNumber(detail.used);
    const remaining = asFiniteNumber(detail.remaining);
    const nextResetTime = parseResetTime(detail.resetTime);

    if (limit !== null && used !== null && remaining !== null && nextResetTime !== null) {
      const leftPercent = limit > 0 ? Math.round((remaining / limit) * 100) : null;
      const usedPercent = limit > 0 ? Math.round((used / limit) * 100) : null;

      if (leftPercent !== null && usedPercent !== null) {
        return {
          kind: "success",
          level: "",
          display: "percent",
          leftPercent,
          usedPercent,
          nextResetTime
        };
      }

      return {
        kind: "success",
        level: "",
        display: "absolute",
        remaining,
        total: limit,
        nextResetTime
      };
    }
  }

  // Fallback: try limits array if detail is not available
  if (codingUsage && Array.isArray(codingUsage.limits)) {
    const windowLimit = codingUsage.limits[0];
    if (windowLimit && windowLimit.detail && typeof windowLimit.detail === "object") {
      const detail = windowLimit.detail;
      const limit = asFiniteNumber(detail.limit);
      const used = asFiniteNumber(detail.used);
      const remaining = asFiniteNumber(detail.remaining);
      const nextResetTime = parseResetTime(detail.resetTime);

      if (limit !== null && remaining !== null && nextResetTime !== null) {
        return {
          kind: "success",
          level: "",
          display: "absolute",
          remaining,
          total: limit,
          nextResetTime
        };
      }
    }
  }

  return { kind: "unavailable" };
}
