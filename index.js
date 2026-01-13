import express from "express";
import cors from "cors";
import { Paynow } from "paynow";

const app = express();
app.use(cors());
app.use(express.json());

const {
  PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY,
  RELAY_SECRET,
  PORT = 3000,
} = process.env;

console.log("ENV CHECK:", {
  PAYNOW_INTEGRATION_ID: !!PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY: !!PAYNOW_INTEGRATION_KEY,
  RELAY_SECRET: !!RELAY_SECRET,
});

if (!PAYNOW_INTEGRATION_ID || !PAYNOW_INTEGRATION_KEY || !RELAY_SECRET) {
  console.error("❌ ENV VARS MISSING");
  process.exit(1);
}

/* ✅ CORRECT PAYNOW INITIALIZATION */
const paynow = new Paynow(
  PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY
);

console.log("✅ Paynow initialized successfully");

/* ---------- HEALTH CHECK ---------- */
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "paynow-relay",
    paynowReady: true,
    timestamp: new Date().toISOString(),
  });
});

/* ---------- CREATE PAYMENT ---------- */
app.post("/create-payment", async (req, res) => {
  try {
    const { amount, email, reference } = req.body;

    if (!amount || !email || !reference) {
      return res.status(400).json({ error: "Missing payment fields" });
    }

    const payment = paynow.createPayment(reference, email);
    payment.add("Payment", amount);

    const response = await paynow.send(payment);

    if (!response.success) {
      return res.status(500).json({ error: "Paynow initiation failed" });
    }

    res.json({
      redirectUrl: response.redirectUrl,
      pollUrl: response.pollUrl,
    });
  } catch (err) {
    console.error("❌ PAYMENT ERROR", err);
    res.status(500).json({ error: "Internal payment error" });
  }
});

/* ---------- START SERVER ---------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Paynow relay running on port ${PORT}`);
});
