import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pg from "pg";
import { Rcon } from "rcon-client";
import { PRODUCTS } from "./catalog.js";

const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
const PORT = Number(process.env.PORT || 3000);

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: (process.env.FRONTEND_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean) }));
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }));

function adminOnly(req, res, next) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return res.status(401).json({ error: "Unauthorized" });
  next();
}
function validUsername(name) { return typeof name === "string" && /^[A-Za-z0-9_]{3,16}$/.test(name); }
function makeOrderId() { return "MM-" + crypto.randomBytes(6).toString("hex").toUpperCase(); }
function pesoToCentavos(pesos) { return pesos * 100; }

async function executeReward(order) {
  const host = process.env.RCON_HOST;
  const password = process.env.RCON_PASSWORD;
  if (!host || !password) throw new Error("Minecraft RCON is not configured.");
  const rcon = await Rcon.connect({ host, port: Number(process.env.RCON_PORT || 25575), password });
  try {
    const items = order.items;
    for (const item of items) {
      const product = PRODUCTS[item.id];
      if (!product) throw new Error("Unknown product in order.");
      const template = product.reward.type === "rank" ? process.env.RANK_COMMAND_TEMPLATE : process.env.KEY_COMMAND_TEMPLATE;
      if (!template) throw new Error(product.reward.type === "rank" ? "Rank command template is missing." : "Key command template is missing.");
      const command = template
        .replaceAll("{player}", order.username)
        .replaceAll("{rank}", product.reward.value)
        .replaceAll("{key}", product.reward.value)
        .replaceAll("{quantity}", String(item.quantity));
      if (/[\r\n;]/.test(command)) throw new Error("Unsafe command template.");
      await rcon.send(command);
    }
  } finally { rcon.end(); }
}

async function deliverOrder(orderId) {
  const client = await pool.connect();
  let order;
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [orderId]);
    order = result.rows[0];
    if (!order || order.payment_status !== "paid" || order.delivery_status === "delivered" || order.delivery_status === "delivering") {
      await client.query("COMMIT"); return;
    }
    await client.query("UPDATE orders SET delivery_status='delivering', delivery_error=NULL WHERE id=$1", [orderId]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
  try {
    await executeReward({ ...order, items: order.items });
    await pool.query("UPDATE orders SET delivery_status='delivered', delivered_at=NOW(), delivery_error=NULL WHERE id=$1", [orderId]);
  } catch (e) {
    await pool.query("UPDATE orders SET delivery_status='failed', delivery_error=$2 WHERE id=$1", [orderId, String(e.message).slice(0, 500)]);
    throw e;
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "manilamc-store-api" }));
app.get("/api/products", (_req, res) => res.json(Object.entries(PRODUCTS).map(([id, p]) => ({ id, ...p }))));

app.post("/api/orders", express.json({ limit: "32kb" }), async (req, res) => {
  try {
    const { username, items, paymentMethod } = req.body || {};
    if (!validUsername(username)) return res.status(400).json({ error: "Enter a valid Minecraft username." });
    if (!Array.isArray(items) || !items.length || items.length > 20) return res.status(400).json({ error: "Cart is empty or too large." });
    if (!["gcash", "paymaya", "manual-gcash", "manual-maya"].includes(paymentMethod)) return res.status(400).json({ error: "Choose a supported payment method." });
    const cleanItems = [];
    let total = 0;
    for (const item of items) {
      const product = PRODUCTS[item?.id];
      const quantity = Number(item?.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 25) return res.status(400).json({ error: "Invalid cart item." });
      cleanItems.push({ id: item.id, name: product.name, quantity, unitPrice: product.price });
      total += product.price * quantity;
    }
    const id = makeOrderId();
    const manual = paymentMethod.startsWith("manual-");
    const method = paymentMethod.endsWith("gcash") ? "GCash" : "Maya";
    await pool.query(
      "INSERT INTO orders (id,username,items,total_php,payment_method,payment_status) VALUES ($1,$2,$3,$4,$5,'pending')",
      [id, username, JSON.stringify(cleanItems), total, manual ? "Manual " + method : method]
    );
    if (manual) return res.status(201).json({ orderId: id, totalPHP: total, paymentStatus: "pending", manualPayment: true, message: "Order created. Submit your transaction reference to staff for verification." });

    const secret = process.env.PAYMONGO_SECRET_KEY;
    if (!secret) return res.status(503).json({ error: "Online payment is not configured yet.", orderId: id });
    const response = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"), "Content-Type": "application/json" },
      body: JSON.stringify({ data: { attributes: {
        line_items: cleanItems.map(i => ({ name: i.name, amount: pesoToCentavos(i.unitPrice), currency: "PHP", quantity: i.quantity })),
        payment_method_types: [paymentMethod === "gcash" ? "gcash" : "paymaya"],
        success_url: process.env.PAYMONGO_SUCCESS_URL,
        cancel_url: process.env.PAYMONGO_CANCEL_URL,
        reference_number: id,
        metadata: { order_id: id, minecraft_username: username }
      } } })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.errors?.[0]?.detail || "Payment provider rejected checkout.");
    const session = payload.data;
    await pool.query("UPDATE orders SET paymongo_session_id=$2 WHERE id=$1", [id, session.id]);
    res.status(201).json({ orderId: id, checkoutUrl: session.attributes.checkout_url, totalPHP: total, paymentStatus: "pending" });
  } catch (e) {
    console.error("Order creation failed:", e);
    res.status(500).json({ error: "Could not create order. Please try again." });
  }
});

app.post("/api/orders/:id/manual-reference", express.json({ limit: "8kb" }), async (req, res) => {
  const reference = String(req.body?.reference || "").trim();
  if (!/^[A-Za-z0-9\- ]{5,80}$/.test(reference)) return res.status(400).json({ error: "Enter a valid transaction reference." });
  const result = await pool.query("UPDATE orders SET payment_reference=$2 WHERE id=$1 AND payment_status='pending' AND payment_method LIKE 'Manual %' RETURNING id", [req.params.id, reference]);
  if (!result.rowCount) return res.status(404).json({ error: "Pending manual order not found." });
  res.json({ ok: true, message: "Reference submitted. Staff must verify the payment before rewards are delivered." });
});

function verifyPayMongo(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map(p => p.trim().split("=")));
  if (!parts.t || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const digest = crypto.createHmac("sha256", secret).update(parts.t + "." + rawBody).digest("hex");
  const candidate = parts.li || parts.te || "";
  const a = Buffer.from(digest), b = Buffer.from(candidate);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/webhooks/paymongo", express.raw({ type: "application/json" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  if (!verifyPayMongo(raw, req.get("paymongo-signature"), process.env.PAYMONGO_WEBHOOK_SECRET)) return res.sendStatus(401);
  let event;
  try { event = JSON.parse(raw); } catch { return res.sendStatus(400); }
  const eventId = event?.data?.id;
  const eventType = event?.data?.attributes?.type;
  if (!eventId) return res.sendStatus(400);
  try {
    const inserted = await pool.query("INSERT INTO processed_webhooks(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id", [eventId]);
    if (!inserted.rowCount) return res.sendStatus(200);
    if (eventType === "checkout_session.payment.paid") {
      const session = event.data.attributes.data;
      const orderId = session?.attributes?.reference_number || session?.attributes?.metadata?.order_id;
      if (orderId) {
        const updated = await pool.query("UPDATE orders SET payment_status='paid', paid_at=COALESCE(paid_at,NOW()) WHERE id=$1 AND paymongo_session_id=$2 RETURNING id", [orderId, session.id]);
        if (updated.rowCount) await deliverOrder(orderId);
      }
    }
    return res.sendStatus(200);
  } catch (e) {
    console.error("Webhook processing failed:", e);
    return res.sendStatus(500);
  }
});

app.get("/admin/orders", adminOnly, async (req, res) => {
  const status = String(req.query.status || "");
  const result = await pool.query(
    "SELECT id,username,items,total_php,payment_method,payment_status,delivery_status,payment_reference,created_at,delivery_error FROM orders WHERE ($1='' OR payment_status=$1) ORDER BY created_at DESC LIMIT 100",
    [status]
  );
  res.json(result.rows);
});
app.post("/admin/orders/:id/approve", adminOnly, express.json(), async (req, res) => {
  const result = await pool.query("UPDATE orders SET payment_status='paid', paid_at=COALESCE(paid_at,NOW()) WHERE id=$1 AND payment_status='pending' AND payment_method LIKE 'Manual %' AND payment_reference IS NOT NULL RETURNING id", [req.params.id]);
  if (!result.rowCount) return res.status(409).json({ error: "Order is not awaiting manual verification or has no transaction reference." });
  try { await deliverOrder(req.params.id); res.json({ ok: true, message: "Payment approved and rewards delivered." }); }
  catch (e) { res.status(502).json({ error: "Payment approved, but reward delivery failed. Retry delivery from the admin endpoint.", detail: e.message }); }
});
app.post("/admin/orders/:id/retry-delivery", adminOnly, async (req, res) => {
  try { await deliverOrder(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, async () => {
  try { await pool.query("SELECT 1"); console.log("ManilaMC Store API listening on " + PORT); }
  catch (e) { console.error("Database connection failed:", e.message); process.exit(1); }
});
