// netlify/functions/ghl-usage.js
export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "https://calendar.yourgoalplanner.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors };

  const { contactId, lastUsedAtISO } = JSON.parse(event.body || "{}");
  if (!contactId) return { statusCode: 400, headers: cors, body: "No contactId" };

  const token = process.env.GHL_TOKEN; // safe on Netlify
  const base = "https://services.leadconnectorhq.com";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" };

  // add a simple Note (easy to automate from in HighLevel)
  await fetch(`${base}/contacts/${contactId}/notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body: `Calendar used at ${lastUsedAtISO || new Date().toISOString()}` })
  });

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
}
