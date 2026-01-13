const express = require("express");
const cors = require("cors");
const Paynow = require("paynow");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const {
  PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY,
  RELAY_SECRET
} = process.env;

/* ===== ENV CHECK ===== */
console.log("ENV CHECK:", {
  PAYNOW_INTEGRATION_ID: !!PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY: !!PAYNOW_INTEGRATION_KEY,
  RELAY_SECRET: !!RELAY_SECRET
});

if (!PAYNOW_INTEGRATION_ID || !PAYNOW_INTEGRATION_KEY || !RELAY_SECRET) {
  console.error("❌ ENV VARS MISSING");
  process.exit(1);
}

/* ===== PAYNOW INIT ===== */
let paynow;
try {
  paynow = new Paynow(
    PAYNOW_INTEGRATION_ID,
    PAYNOW_INTEGRATION_KEY
  );
  console.log("✅ Paynow initialized successfully");
} catch (err) {
  console.error("❌ PAYNOW INIT FAILED", err);
  process.exit(1);
}

/* ===== HEALTH CHECK ===== */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "paynow-relay",
    paynowReady: true,
    timestamp: new Date().toISOString()
  });
});

/* ===== CREATE PAYMENT ===== */
app.post("/create-payment", async (req, res) => {
  try {
    const { amount, email, reference, returnUrl, resultUrl } = req.body;

    if (!amount || !email || !reference) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const payment = paynow.createPayment(reference, email);
    payment.add("Subscription", amount);

    const response = await paynow.send(payment, returnUrl, resultUrl);

    if (!response.success) {
      return res.status(500).json({
        error: "Paynow request failed",
        details: response.errors
      });
    }

    res.json({
      success: true,
      redirectUrl: response.redirectUrl,
      pollUrl: response.pollUrl
    });

  } catch (err) {
    console.error("❌ PAYMENT ERROR", err);
    res.status(500).json({ error: "Payment failed" });
  }
});

/* ===== POLL PAYMENT ===== */
app.post("/poll", async (req, res) => {
  try {
    const { pollUrl } = req.body;
    if (!pollUrl) {
      return res.status(400).json({ error: "Missing pollUrl" });
    }

    const status = await paynow.poll(pollUrl);
    res.json(status);

  } catch (err) {
    console.error("❌ POLL ERROR", err);
    res.status(500).json({ error: "Polling failed" });
  }
});

/* ===== START SERVER ===== */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Paynow relay running on port ${PORT}`);
});
