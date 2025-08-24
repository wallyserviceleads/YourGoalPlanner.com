// netlify/functions/ghl-usage.js

const { GHL_TOKEN, GHL_LAST_USAGE_FIELD_ID, ALLOWED_ORIGINS } = process.env;

// --- Update Last Usage Field ---
async function setLastUsageDate({ contactId, lastUsedAtISO }) {
  if (!GHL_LAST_USAGE_FIELD_ID) {
    console.warn("No GHL_LAST_USAGE_FIELD_ID set; skipping date update");
    return { skipped: true };
  }

  // Use full ISO date string like "2025-08-24T00:00:00.000Z"
  const isoValue = new Date(lastUsedAtISO || Date.now()).toISOString();

  const url = `https://services.leadconnectorhq.com/contacts/${encodeURIComponent(contactId)}`;
  const headers = {
    Authorization: `Bearer ${GHL_TOKEN}`,
    Version: "2021-07-28",
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const payload = {
    customFields: [{ id: GHL_LAST_USAGE_FIELD_ID, value: isoValue }],
  };

  const resp = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  console.log("[LastUsage update attempt]", resp.status, text);

  if (!resp.ok) {
    throw new Error(`Failed to update Last Usage field (${resp.status}): ${text}`);
  }
  return { ok: true, status: resp.status, text };
}

export const handler = async (event) => {
  // --- CORS ---
  const requestOrigin = event.headers?.origin;
  const whitelist = (ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const origin =
    !whitelist.length || (requestOrigin && whitelist.includes(requestOrigin))
      ? requestOrigin || "*"
      : "*";

  const cors = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors };
  if (whitelist.length && requestOrigin && !whitelist.includes(requestOrigin)) {
    return { statusCode: 403, headers: cors, body: "Origin not allowed" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Use POST" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { contactId, lastUsedAtISO, noteText } = body;
    if (!contactId) {
      return { statusCode: 400, headers: cors, body: "Missing contactId" };
    }

    const api = "https://services.leadconnectorhq.com";
    const headers = {
      Authorization: `Bearer ${GHL_TOKEN}`,
      Version: "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // --- Add a Note ---
    const text = noteText || `Calendar used at ${lastUsedAtISO || new Date().toISOString()}`;
    const noteRes = await fetch(`${api}/contacts/${encodeURIComponent(contactId)}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: text }),
    });
    const noteBody = await noteRes.text();
    console.log("[HL response - note]", noteRes.status, noteBody);

    // --- Update Last Usage field ---
    try {
      const result = await setLastUsageDate({
        contactId,
        lastUsedAtISO: lastUsedAtISO || new Date().toISOString(),
      });
      console.log("[LastUsage] result:", result);
    } catch (err) {
      console.error("last usage update error:", err);
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, noteStatus: noteRes.status }),
    };
  } catch (e) {
    console.error("Function error:", e);
    return { statusCode: 500, headers: cors, body: String(e) };
  }
};
