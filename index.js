import express from "express";
import paynow from "paynow"; // ⚠️ IMPORTANT: lowercase import

const app = express();
app.use(express.json());

// =======================
// ENV CHECK (SAFE LOG)
// =======================
console.log("ENV CHECK:", {
  PAYNOW_INTEGRATION_ID: !!process.env.PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY: !!process.env.PAYNOW_INTEGRATION_KEY,
  RELAY_SECRET: !!process.env.RELAY_SECRET,
});

// =======================
// VALIDATE ENV VARS
// =======================
if (
  !process.env.PAYNOW_INTEGRATION_ID ||
  !process.env.PAYNOW_INTEGRATION_KEY
) {
  console.error("❌ Missing Paynow credentials");
  process.exit(1);
}

// =======================
// INIT PAYNOW (THIS IS THE FIX)
// =======================
const Paynow = paynow.Paynow;

const paynowClient = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

// =======================
// HEALTH CHECK
// =======================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "paynow-relay",
    timestamp: new Date().toISOString(),
  });
});

// =======================
// CREATE PAYMENT
// =======================
app.post("/create-payment", async (req, res) => {
  try {
    // 🔐 Optional relay secret protection
    if (
      process.env.RELAY_SECRET &&
      req.headers["x-relay-secret"] !== process.env.RELAY_SECRET
    ) {
      return res.status(401).json({ error: "Unauthorized relay request" });
    }

    const { email, amount, reference } = req.body;

    if (!email || !amount || !reference) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const payment = paynowClient.createPayment(reference, email);
    payment.add("Subscription", amount);

    const response = await paynowClient.send(payment);

    if (!response.success) {
      console.error("❌ Paynow rejected payment", response);
      return res.status(500).json({
        error: "Paynow payment failed",
      });
    }

    return res.json({
      success: true,
      redirectUrl: response.redirectUrl,
      pollUrl: response.pollUrl,
    });
  } catch (err) {
    console.error("❌ Internal payment error", err);
    res.status(500).json({
      error: "Internal payment error",
    });
  }
});

// =======================
// START SERVER (RAILWAY)
// =======================
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Paynow relay running on port ${PORT}`);
});
