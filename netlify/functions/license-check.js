// license-check.js
const { GHL_TOKEN } = process.env;

export const handler = async (event) => {
  const user = parseNetlifyIdentity(event.headers.authorization);
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  const email = user.email;
  const res = await fetch(`https://services.leadconnectorhq.com/contacts/?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: '2021-07-28' }
  });
  const data = await res.json();
  const contact = data.contacts?.[0];
  if (!contact) return { statusCode: 403, body: 'No contact' };

  const fields = indexCustomFields(contact);
  const status = fields.license_status || 'inactive';
  const tier = fields.license_tier || 'free';
  const expires = fields.license_expires_at;

  const active = status === 'active' && (!expires || new Date(expires) >= new Date());
  return {
    statusCode: 200,
    body: JSON.stringify({ active, tier, expires })
  };
};

function parseNetlifyIdentity(authHeader) { /* same as above */ }
function indexCustomFields(contact) {
  const out = {};
  const arr = contact.customFields || contact.customFieldsData || [];
  for (const cf of arr) out[slug(cf.name || cf.id)] = cf.value;
  return out;
}
function slug(s){return (s||'').toLowerCase().replace(/\s+/g,'_')}
