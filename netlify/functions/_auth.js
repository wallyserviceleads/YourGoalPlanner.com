// netlify/functions/_auth.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Set up JWKS client for Auth0
const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true
 });

// Retrieve signing key for token verification
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.publicKey || key.rsaPublicKey;
      callback(null, signingKey);
    }
  });
}

// Middleware-style wrapper to verify incoming JWTs
exports.verifyJwt = (handler) => async (event, context) => {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: 'Missing Authorization header' };
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: process.env.AUTH0_AUDIENCE,
          issuer: `https://${process.env.AUTH0_DOMAIN}/`,
          algorithms: ['RS256']
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    });

    event.user = decoded;
    return handler(event, context);
  } catch (err) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
};

// Usage: const { verifyJwt } = require('./_auth');
// exports.handler = verifyJwt(async (event, context) => { ... })

