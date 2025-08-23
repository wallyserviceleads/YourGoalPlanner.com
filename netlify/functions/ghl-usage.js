// netlify/functions/ghl-usage.js

export const handler = async (event) => {
  const requestOrigin = event.headers?.origin;
  const whitelist = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origin =
    !whitelist.length || (requestOrigin && whitelist.includes(requestOrigin))
      ? requestOrigin || "*"
      : "*";  const cors = {
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
    const { contactId, lastUsedAtISO, noteText } = JSON.parse(event.body || "{}");
    if (!contactId) return { statusCode: 400, headers: cors, body: "Missing contactId" };

    const token = process.env.GHL_TOKEN; // set in Netlify
    const api = "https://services.leadconnectorhq.com";
    const headers = {
      Authorization: `Bearer ${process.env.GHL_TOKEN}`, // Private Integration or OAuth token
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
    // Optional: update a custom field if you later add GHL_LAST_USAGE_FIELD_ID
    const fieldId = process.env.GHL_LAST_USAGE_FIELD_ID;
    let fieldStatus = null;
    if (fieldId && lastUsedAtISO) {
      const updRes = await fetch(`${api}/contacts/${contactId}`, {
        method: "PUT", headers,
        body: JSON.stringify({ customFields: [{ id: fieldId, value: lastUsedAtISO }] })
      });
      fieldStatus = updRes.status;
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, noteStatus: noteRes.status, fieldStatus }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: String(e) };
  }
  await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
  method: "POST",
  headers,
  body: JSON.stringify({ body: `Calendar used at ${new Date().toISOString()}` })
});
};
