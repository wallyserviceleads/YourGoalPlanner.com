// netlify/functions/ghl-usage.js

// Pull env vars once at the top
const { GHL_TOKEN, GHL_LAST_USAGE_FIELD_ID, ALLOWED_ORIGINS } = process.env;

/**
 * Update the "Last Usage" custom field on a contact.
 * - Uses PUT /contacts/{id}
 * - Tries `customFields` first; if non-2xx, retries with `customFieldsData`
 * - Formats date as YYYY-MM-DD (typical for GHL Date fields)
 */
async function setLastUsageDate({ contactId, lastUsedAtISO }) {
  if (!GHL_LAST_USAGE_FIELD_ID) {
    console.warn("No GHL_LAST_USAGE_FIELD_ID set; skipping date update");
    return { skipped: true };
  }

  const dateOnly = new Date(lastUsedAtISO || Date.now()).toISOString().slice(0, 10);
  const url = `https://services.leadconnectorhq.com/contacts/${encodeURIComponent(contactId)}`;

  const baseHeaders = {
    Authorization: `Bearer ${GHL_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Version: "2021-07-28",
  };

  // Attempt #1 — customFields
  let resp = await fetch(url, {
    method: "PUT",
    headers: baseHeaders,
    body: JSON.stringify({
      customFields: [{ id: GHL_LAST_USAGE_FIELD_ID, value: dateOnly }],
    }),
  });
  let text = await resp.text();
  console.log("PUT customFields attempt:", resp.status, text);

  if (resp.ok) return { ok: true, variant: "customFields", status: resp.status, text };

  // Attempt #2 — customFieldsData
  resp = await fetch(url, {
    method: "PUT",
    headers: baseHeaders,
    body: JSON.stringify({
      customFieldsData: [{ id: GHL_LAST_USAGE_FIELD_ID, value: dateOnly }],
    }),
  });
  text = await resp.text();
  console.log("PUT customFieldsData attempt:", resp.status, text);

  if (!resp.ok) {
    throw new Error(`Last usage update failed (${resp.status}): ${text}`);
  }
  return { ok: true, variant: "customFieldsData", status: resp.status, text };
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

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors };
  }
  if (whitelist.length && requestOrigin && !whitelist.includes(requestOrigin)) {
    return { statusCode: 403, headers: cors, body: "Origin not allowed" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Use POST" };
  }

  try {
    // --- Parse body ---
    const body = JSON.parse(event.body || "{}");
    const { contactId, lastUsedAtISO, noteText } = body;
    if (!contactId) {
      return { statusCode: 400, headers: cors, body: "Missing contactId" };
    }

    const api = "https://services.leadconnectorhq.com";
    const headers = {
      Authorization: `Bearer ${GHL_TOKEN}`, // Private Integration or OAuth token
      Version: "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Log headers with redacted token to avoid leaking secrets
    const redacted = (headers.Authorization || "").slice(0, 20) + "…redacted";
    console.log("[HL request headers]", {
      Authorization: redacted,
      Version: headers.Version,
      Accept: headers.Accept,
      "Content-Type": headers["Content-Type"],
    });

    // --- 1) Add a Note (easy to verify in GHL) ---
    const text = noteText || `Calendar used at ${lastUsedAtISO || new Date().toISOString()}`;
    const noteRes = await fetch(`${api}/contacts/${encodeURIComponent(contactId)}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: text }),
    });
    const noteBody = await noteRes.text();
    console.log("[HL response - note]", noteRes.status, noteBody);

    // --- 2) Update Last Usage custom field ---
    try {
      const result = await setLastUsageDate({
        contactId,
        lastUsedAtISO: lastUsedAtISO || new Date().toISOString(),
      });
      if (result?.ok) {
        console.log(`[LastUsage] updated via ${result.variant}`, result.status);
      } else if (result?.skipped) {
        console.log("[LastUsage] skipped: field id not set");
      }
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
