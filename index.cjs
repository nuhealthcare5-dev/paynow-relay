const express = require("express");
const createPaynow = require("paynow");

const app = express();
app.use(express.json());

// ENV CHECK
console.log("ENV CHECK:", {
  PAYNOW_INTEGRATION_ID: !!process.env.PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY: !!process.env.PAYNOW_INTEGRATION_KEY
});

if (!process.env.PAYNOW_INTEGRATION_ID || !process.env.PAYNOW_INTEGRATION_KEY) {
  console.error("❌ PAYNOW ENV VARS MISSING");
  process.exit(1);
}

// ✅ CORRECT PAYNOW INITIALIZATION
const paynow = createPaynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

// ✅ HEALTH
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "paynow-relay",
    paynowReady: true,
    timestamp: new Date().toISOString()
  });
});

// 💳 CREATE PAYMENT
app.post("/create-payment", async (req, res) => {
  try {
    const { email, amount, reference } = req.body;

    if (!email || !amount || !reference) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const payment = paynow.createPayment(reference, email);
    payment.add(reference, amount);

    const response = await paynow.send(payment);

    if (!response.success()) {
      console.error("❌ PAYNOW REJECTED PAYMENT");
      return res.status(500).json({ error: "Paynow rejected payment" });
    }

    res.json({
      success: true,
      redirectUrl: response.redirectUrl(),
      pollUrl: response.pollUrl()
    });

  } catch (err) {
    console.error("❌ PAYMENT ERROR", err);
    res.status(500).json({ error: "Internal payment error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Paynow relay running on port ${PORT}`);
});
