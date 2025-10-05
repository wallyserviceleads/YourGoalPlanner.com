// netlify/functions/create-portal-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // You’ll need to authenticate the user (session, JWT, cookie, etc.)
  const user = /* your logic to get current user from event/context */;
  if (!user || !user.stripeCustomerId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Not authenticated or missing Stripe customer ID" })
    };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: "https://yourgoalplanner.com/?from=portal"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error("Stripe portal session error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unable to create portal session" })
    };
  }
};
