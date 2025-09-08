// Netlify functions use Node 18+, so native fetch is available.
// Install 'jose' for JWT verification: `npm i jose`
// Your netlify.toml should have: [functions] node_bundler = "esbuild"

import { jwtVerify, createRemoteJWKSet } from "jose";

const domain = process.env.AUTH0_DOMAIN;                  // e.g. your-tenant.us.auth0.com
const audience = process.env.AUTH0_AUDIENCE;              // https://calendar.yourgoalplanner.com/api
const issuer = `https://${domain}/`;
const JWKS = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_LAST_LOGIN_FIELD_ID = process.env.GHL_LAST_LOGIN_FIELD_ID;

export const handler = async (event) => {
  try {
    const auth = event.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return { statusCode: 401, body: "Missing token" };

    // Verify the ACCESS token against your API audience
    const { payload } = await jwtVerify(token, JWKS, { audience, issuer });
    // Depending on your Auth0 action/permissions, email may be present:
    const email = payload.email || payload["https://schemas.example/email"]; // adjust if you used a custom claim
    const sub = payload.sub;

    // OPTIONAL: Upsert in GoHighLevel and set last login
    if (GHL_API_KEY && GHL_LOCATION_ID && (email || sub)) {
      const body = {
        locationId: GHL_LOCATION_ID,
        email,                                  // If you don’t have email yet, you can map sub to a custom field and fill email later.
        // You can include name/phone if available in your app:
        // firstName, lastName, phone
        customFields: [
          { id: GHL_LAST_LOGIN_FIELD_ID, value: new Date().toISOString() }
        ],
        source: "YourGoalPlanner"
      };

      await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: "2021-07-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 401, body: `Unauthorized: ${err.message}` };
  }
};
