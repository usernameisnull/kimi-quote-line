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

  const quotas = [];

  // Legacy format: { "usages": [{ "scope": "FEATURE_CODING", "detail": {...}, "limits": [...] }] }
  // This format contains TWO quotas: usages[0].detail (weekly) and usages[0].limits[0].detail (window)
  const usages = Array.isArray(payload.usages) ? payload.usages : [];
  const codingUsage = usages.find(u => u?.scope === "FEATURE_CODING");

  // Parse weekly quota from usages[0].detail
  if (codingUsage && codingUsage.detail && typeof codingUsage.detail === "object") {
    const weeklyQuota = parseUsageDetail(codingUsage.detail);
    if (weeklyQuota) {
      quotas.push(weeklyQuota);
    }
  }

  // Parse window quota from usages[0].limits[0].detail
  if (codingUsage && Array.isArray(codingUsage.limits) && codingUsage.limits.length > 0) {
    const windowLimit = codingUsage.limits[0];
    if (windowLimit && windowLimit.detail && typeof windowLimit.detail === "object") {
      const windowQuota = parseUsageDetail(windowLimit.detail);
      if (windowQuota) {
        quotas.push(windowQuota);
      }
    }
  }

  // Kimi Code platform format: { "usage": {...}, "limits": [...] }
  // Also try to extract from usage and limits at the root level
  if (quotas.length === 0) {
    // Parse weekly quota from usage object
    const usage = payload.usage;
    if (usage && typeof usage === "object") {
      const weeklyQuota = parseUsageDetail(usage);
      if (weeklyQuota) {
        quotas.push(weeklyQuota);
      }
    }

    // Parse window quota from limits array
    const limits = Array.isArray(payload.limits) ? payload.limits : [];
    if (limits.length > 0) {
      const windowLimit = limits[0];
      if (windowLimit && windowLimit.detail && typeof windowLimit.detail === "object") {
        const windowQuota = parseUsageDetail(windowLimit.detail);
        if (windowQuota) {
          quotas.push(windowQuota);
        }
      }
    }
  }

  if (quotas.length > 0) {
    return {
      kind: "success",
      level: "",
      display: "percent",
      quotas
    };
  }

  return { kind: "unavailable" };
}

function parseUsageDetail(detail) {
  // Support both snake_case and camelCase field names
  const limit = asFiniteNumber(detail.limit);
  const used = asFiniteNumber(detail.used);
  const remaining = asFiniteNumber(detail.remaining);

  // Support multiple reset time field names
  const nextResetTime = parseResetTime(
    detail.reset_at ||
    detail.resetAt ||
    detail.reset_time ||
    detail.resetTime
  );

  if (limit !== null && used !== null && remaining !== null && nextResetTime !== null) {
    const leftPercent = limit > 0 ? Math.round((remaining / limit) * 100) : null;
    const usedPercent = limit > 0 ? Math.round((used / limit) * 100) : null;

    return {
      leftPercent,
      usedPercent,
      nextResetTime
    };
  }

  return null;
}
