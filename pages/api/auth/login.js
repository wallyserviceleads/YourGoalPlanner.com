// pages/api/auth/login.js
import { serialize } from "cookie";
// import your user DB / model logic
// import a function to verify password, e.g. bcrypt or your own

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;
  // look up user in your DB
  const user = await yourDbGetUserByEmail(email); 
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const isValid = await verifyPassword(password, user.hashedPassword);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // set a session cookie (simple example)
  const session = {
    userId: user.id,
    stripeCustomerId: user.stripeCustomerId,
  };
  const cookie = serialize("session", JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  res.setHeader("Set-Cookie", cookie);

  res.status(200).json({ success: true });
}
