import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const {
  PAYNOW_INTEGRATION_ID,
  PAYNOW_INTEGRATION_KEY,
  RELAY_SECRET,
  PORT = 3000
} = process.env;

/* ---------------- HEALTH ---------------- */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "paynow-relay",
    timestamp: new Date().toISOString()
  });
});

/* ------------- CREATE PAYMENT ----------- */
app.post("/create-payment", async (req, res) => {
  try {
    if (req.headers["x-relay-secret"] !== RELAY_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { email, amount, reference } = req.body;

    const response = await fetch("https://www.paynow.co.zw/interface/initiatetransaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: PAYNOW_INTEGRATION_ID,
        key: PAYNOW_INTEGRATION_KEY,
        reference,
        amount,
        email,
        returnurl: "https://your-site.com/payment-success",
        resulturl: "https://your-site.com/payment-webhook"
      })
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(text);
    }

    return res.json({
      success: true,
      redirectUrl: text
    });

  } catch (err) {
    console.error("PAYMENT ERROR:", err.message);
    return res.status(500).json({ error: "Internal payment error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Paynow relay running on ${PORT}`);
});
