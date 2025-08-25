// netlify/functions/_auth.js
const { NetlifyJwtVerifier } = require('@serverless-jwt/netlify');

exports.verifyJwt = NetlifyJwtVerifier({
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  audience: process.env.AUTH0_AUDIENCE
});

// Usage: const { verifyJwt } = require('./_auth');
// exports.handler = verifyJwt(async (event, context) => { ... })
