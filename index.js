import express from "express";
import Paynow from "paynow";

const app = express();
app.use(express.json());

const paynow = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

// 🔐 Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "paynow-relay",
    paynowReady: true,
    timestamp: new Date().toISOString()
  });
});

// 💳 Create payment
app.post("/create-payment", async (req, res) => {
  try {
    const { email, amount, reference } = req.body;

    if (!email || !amount || !reference) {
      return res.status(400).json({ error: "Missing payment fields" });
    }

    const payment = paynow.createPayment(reference, email);
    payment.add(reference, amount);

    const response = await paynow.send(payment);

    // ✅ CORRECT Paynow check
    if (!response.success()) {
      return res.status(500).json({
        error: "Paynow rejected payment",
      });
    }

    return res.json({
      success: true,
      redirectUrl: response.redirectUrl(),
      pollUrl: response.pollUrl()
    });

  } catch (err) {
    console.error("❌ PAYMENT ERROR", err);
    return res.status(500).json({
      error: "Internal payment error"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Paynow relay running on ${PORT}`);
});
