// index.cjs
const express = require("express");
const cors = require("cors");
const Paynow = require("paynow");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   ENV CHECK
========================= */
const REQUIRED_ENVS = [
  "PAYNOW_INTEGRATION_ID",
  "PAYNOW_INTEGRATION_KEY",
  "RELAY_SECRET"
];

const missing = REQUIRED_ENVS.filter(v => !process.env[v]);
if (missing.length) {
  console.error("❌ Missing env vars:", missing);
  process.exit(1);
}

console.log("✅ ENV CHECK OK");

/* =========================
   PAYNOW CLIENT (CORRECT)
========================= */
const paynow = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

/* =========================
   PLAN-BASED PRICING
========================= */
const PLANS = {
  starter: { amount: 5, label: "Starter Plan" },
  pro: { amount: 15, label: "Pro Plan" },
  business: { amount: 30, label: "Business Plan" }
};

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "paynow-relay",
    paynowReady: true,
    timestamp: new Date().toISOString()
  });
});

/* =========================
   CREATE PAYMENT (IMPORTANT)
========================= */
app.post("/create-payment", async (req, res) => {
  try {
    /* ---- Security ---- */
    if (
      process.env.RELAY_SECRET &&
      req.headers["x-relay-secret"] !== process.env.RELAY_SECRET
    ) {
      return res.status(401).json({ error: "Unauthorized relay request" });
    }

    const { email, plan } = req.body;

    if (!email || !plan || !PLANS[plan]) {
      return res.status(400).json({ error: "Invalid plan or email" });
    }

    const { amount, label } = PLANS[plan];

    const reference = `PLAN_${plan.toUpperCase()}_${Date.now()}`;

    /* ---- Create Paynow payment ---- */
    const payment = paynow.createPayment(reference, email);
    payment.add(label, amount);

    const response = await paynow.send(payment);

    if (!response || response.success !== true) {
      console.error("❌ Paynow rejected:", response);
      return res.status(500).json({ error: "Paynow rejected payment" });
    }

    res.json({
      success: true,
      redirectUrl: response.redirectUrl,
      pollUrl: response.pollUrl,
      reference
    });

  } catch (err) {
    console.error("❌ Internal payment error:", err);
    res.status(500).json({ error: "Internal payment error" });
  }
});

/* =========================
   PAYNOW WEBHOOK
========================= */
app.post("/webhook/paynow", (req, res) => {
  console.log("🔔 Paynow webhook:", req.body);
  // TODO: verify pollUrl + mark subscription active
  res.sendStatus(200);
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Paynow relay running on port ${PORT}`);
});
