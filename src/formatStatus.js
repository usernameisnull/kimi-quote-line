function padTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function formatLevel(level) {
  if (!level) {
    return "Kimi";
  }

  return `Kimi ${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}

function formatCompactLabel() {
  return "Kimi";
}

function formatResetTime(timestampMs) {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`;
}

function formatResetTimeWithDate(timestampMs) {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = padTwoDigits(date.getHours());
  const minutes = padTwoDigits(date.getMinutes());
  return `${month}/${day} ${hours}:${minutes}`;
}

function normalizeDisplayMode(displayMode) {
  return displayMode === "used" || displayMode === "both" ? displayMode : "left";
}

function normalizeStyle(style) {
  return style === "compact" || style === "bar" ? style : "text";
}

function normalizeBarWidth(barWidth) {
  if (!Number.isFinite(barWidth)) {
    return 10;
  }

  return Math.min(20, Math.max(5, Math.round(barWidth)));
}

function buildBar(usedPercent, barWidth) {
  const safePercent = Math.min(100, Math.max(0, usedPercent));
  const width = normalizeBarWidth(barWidth);
  let filled;
  if (safePercent <= 0) {
    filled = 0;
  } else if (safePercent >= 100) {
    filled = width;
  } else {
    filled = Math.min(width - 1, Math.max(1, Math.floor((safePercent / 100) * width)));
  }
  return `${"■".repeat(filled)}${"□".repeat(width - filled)}`;
}

function formatPercentStatus(result, resetTime, displayMode) {
  const mode = normalizeDisplayMode(displayMode);

  if (mode === "used" && Number.isFinite(result.usedPercent)) {
    return `${formatLevel(result.level)} | ${result.usedPercent}% used | reset ${resetTime}`;
  }

  if (
    mode === "both" &&
    Number.isFinite(result.leftPercent) &&
    Number.isFinite(result.usedPercent)
  ) {
    return `${formatLevel(result.level)} | ${result.leftPercent}% left ${result.usedPercent}% used | reset ${resetTime}`;
  }

  if (Number.isFinite(result.leftPercent)) {
    return `${formatLevel(result.level)} | ${result.leftPercent}% left | reset ${resetTime}`;
  }

  return "Kimi | quota unavailable";
}

function formatAbsoluteStatus(result, resetTime, displayMode, style, barWidth) {
  const mode = normalizeDisplayMode(displayMode);
  const usedValue =
    Number.isFinite(result.total) && Number.isFinite(result.remaining)
      ? result.total - result.remaining
      : null;
  const leftPercent =
    Number.isFinite(result.total) && result.total > 0 && Number.isFinite(result.remaining)
      ? Math.round((result.remaining / result.total) * 100)
      : null;
  const usedPercent =
    Number.isFinite(leftPercent) ? Math.max(0, Math.min(100, 100 - leftPercent)) : null;

  if (style === "compact" && Number.isFinite(leftPercent)) {
    return `${formatCompactLabel()} ${leftPercent}% | ${resetTime}`;
  }

  if (style === "bar" && Number.isFinite(leftPercent) && Number.isFinite(usedPercent)) {
    return `${formatLevel(result.level)} ${buildBar(usedPercent, barWidth)} ${leftPercent}% | ${resetTime}`;
  }

  if (mode === "used" && Number.isFinite(usedValue) && Number.isFinite(result.total)) {
    return `${formatLevel(result.level)} | used ${usedValue}/${result.total} | reset ${resetTime}`;
  }

  if (
    mode === "both" &&
    Number.isFinite(result.remaining) &&
    Number.isFinite(result.total) &&
    Number.isFinite(usedValue)
  ) {
    return `${formatLevel(result.level)} | left ${result.remaining}/${result.total} used ${usedValue}/${result.total} | reset ${resetTime}`;
  }

  if (Number.isFinite(result.remaining) && Number.isFinite(result.total)) {
    return `${formatLevel(result.level)} | left ${result.remaining}/${result.total} | reset ${resetTime}`;
  }

  return "Kimi | quota unavailable";
}

function formatMultiQuotaStatus(quotas, options, style) {
  const barWidth = normalizeBarWidth(options.barWidth);

  if (style === "bar") {
    const parts = quotas.map(quota => {
      const resetTime = formatResetTimeWithDate(quota.nextResetTime);
      if (!resetTime || !Number.isFinite(quota.leftPercent) || !Number.isFinite(quota.usedPercent)) {
        return null;
      }
      return `${buildBar(quota.usedPercent, barWidth)} ${quota.leftPercent}% ${resetTime}`;
    }).filter(Boolean);

    if (parts.length === 0) {
      return "Kimi | quota unavailable";
    }

    return `Kimi ${parts.join(" || ")}`;
  }

  if (style === "compact") {
    const parts = quotas.map(quota => {
      const resetTime = formatResetTime(quota.nextResetTime);
      if (!resetTime || !Number.isFinite(quota.leftPercent)) {
        return null;
      }
      return `${quota.leftPercent}% ${resetTime}`;
    }).filter(Boolean);

    if (parts.length === 0) {
      return "Kimi | quota unavailable";
    }

    return `Kimi ${parts.join(" | ")}`;
  }

  // text style
  const parts = quotas.map(quota => {
    const resetTime = formatResetTimeWithDate(quota.nextResetTime);
    if (!resetTime || !Number.isFinite(quota.leftPercent)) {
      return null;
    }
    return `${quota.leftPercent}% left ${resetTime}`;
  }).filter(Boolean);

  if (parts.length === 0) {
    return "Kimi | quota unavailable";
  }

  return `Kimi | ${parts.join(" || ")}`;
}

export function formatStatus(result, options = {}) {
  if (!result || typeof result !== "object") {
    return "Kimi | quota unavailable";
  }

  if (result.kind === "auth_error") {
    return "Kimi | auth expired";
  }

  if (result.kind !== "success") {
    return "Kimi | quota unavailable";
  }

  const style = normalizeStyle(options.style);

  // Handle new multi-quota format
  if (result.quotas && Array.isArray(result.quotas)) {
    return formatMultiQuotaStatus(result.quotas, options, style);
  }

  // Handle legacy single-quota format
  // Use date format for consistency with new format
  const resetTimeWithDate = formatResetTimeWithDate(result.nextResetTime);
  const resetTimeOnly = formatResetTime(result.nextResetTime);
  if (!resetTimeWithDate) {
    return "Kimi | quota unavailable";
  }

  if (result.display === "percent") {
    if (style === "compact" && Number.isFinite(result.leftPercent)) {
      return `${formatCompactLabel()} ${result.leftPercent}% ${resetTimeOnly}`;
    }

    if (style === "bar" && Number.isFinite(result.leftPercent) && Number.isFinite(result.usedPercent)) {
      return `${formatLevel(result.level)} ${buildBar(result.usedPercent, options.barWidth)} ${result.leftPercent}% ${resetTimeWithDate}`;
    }

    return `${formatLevel(result.level)} | ${result.leftPercent}% left ${resetTimeWithDate}`;
  }

  if (result.display === "absolute") {
    return formatAbsoluteStatus(result, resetTime, options.displayMode, style, options.barWidth);
  }

  return "Kimi | quota unavailable";
}
