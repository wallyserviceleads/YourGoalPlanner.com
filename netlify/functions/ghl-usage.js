// netlify/functions/ghl-usage.js

// Pull env vars once at the top
const { GHL_TOKEN, GHL_LAST_USAGE_FIELD_ID, ALLOWED_ORIGINS } = process.env;

async function setLastUsageDate({ contactId, lastUsedAtISO }) {
    if (!GHL_LAST_USAGE_FIELD_ID) {
    console.warn("No GHL_LAST_USAGE_FIELD_ID set; skipping date update");
    return;
  }
const dateOnly = new Date(lastUsedAtISO).toISOString().slice(0, 10);
  const payload = {
    customFields: [{ id: GHL_LAST_USAGE_FIELD_ID, value: dateOnly }]
    // If your account expects customFieldsData instead:
    // customFieldsData: [{ id: GHL_LAST_USAGE_FIELD_ID, value: dateOnly }]
  };
  const resp = await fetch(
    `https://services.leadconnectorhq.com/contacts/${encodeURIComponent(contactId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        "Content-Type": "application/json",
        Version: "2021-07-28"
      },
      body: JSON.stringify(payload)
    }
  );
 const text = await resp.text();
  if (!resp.ok) throw new Error(`Failed to update field: ${resp.status} ${text}`);
  return text;
}

export const handler = async (event) => {
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
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Use POST" };
  
  try {
    const body = JSON.parse(event.body || "{}");
    const { contactId, lastUsedAtISO, noteText } = body;
    if (!contactId) return { statusCode: 400, headers: cors, body: "Missing contactId" };

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
    
    // Add a Note (easy to verify in GHL)
    const text = noteText || `Calendar used at ${lastUsedAtISO || new Date().toISOString()}`;
    const noteRes = await fetch(`${api}/contacts/${contactId}/notes`, {
      method: "POST", headers, body: JSON.stringify({ body: text })
    });
    const noteBody = await noteRes.text();
    console.log("[HL response]", noteRes.status, noteBody);
    
    try {
      await setLastUsageDate({
        contactId: body.contactId,
        lastUsedAtISO: body.lastUsedAtISO || new Date().toISOString()
      });
    } catch (err) {
      console.error("last usage update error:", err);
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, noteStatus: noteRes.status })
    };
  } catch (e) {
      return { statusCode: 500, headers: cors, body: String(e) };
    }
  };
