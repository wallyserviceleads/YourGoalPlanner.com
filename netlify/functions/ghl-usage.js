// netlify/functions/ghl-login.js

const { GHL_TOKEN, ALLOWED_ORIGINS } = process.env;
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
    const { contactId, noteText } = body;
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

    
    const text = noteText || "last login";
    const noteRes = await fetch(`${api}/contacts/${encodeURIComponent(contactId)}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: text }),
    });
    const noteBody = await noteRes.text();
    console.log("[HL response - note]", noteRes.status, noteBody);

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
