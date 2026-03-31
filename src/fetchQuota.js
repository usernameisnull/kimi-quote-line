export async function fetchQuota(config, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    return { kind: "unavailable" };
  }

  try {
    const response = await fetchImpl(config.quotaUrl, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "content-type": "application/json",
        authorization: config.authorization
      },
      body: JSON.stringify({ scope: ["FEATURE_CODING"] }),
      signal: AbortSignal.timeout(config.timeoutMs)
    });

    const text = await response.text();
    let json;

    try {
      json = JSON.parse(text);
    } catch {
      return { kind: "unavailable" };
    }

    return { kind: "json", status: response.status, json };
  } catch {
    return { kind: "unavailable" };
  }
}
