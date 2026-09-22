// Cloud Function: submitOrder
//
// Runs server-side (with full admin access, bypassing Firestore rules) so
// it can safely check "has this household already hit its order limit?"
// even though customers' browsers are no longer allowed to read the
// orders collection directly. The client calls this function instead of
// writing to Firestore itself when placing a new order.
//
// It also sends an email notification to the family whenever a new order
// comes in, using your own Gmail account (see README → "Setting up order
// email notifications" for the one-time setup this requires).

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function formatMoney(n) {
  return "$" + Number(n || 0).toFixed(2);
}

async function sendOrderEmail(order) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAIL } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !NOTIFY_EMAIL) {
    // Email isn't set up yet — skip quietly rather than failing the order.
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const itemLines = order.items.map((i) => `  ${i.qty}\u00d7 ${i.name} \u2014 ${formatMoney(i.price * i.qty)}`).join("\n");

  const text = `New order from ${order.customerName}\n\n` +
    `Phone: ${order.phone}\n` +
    `Fulfillment: ${order.fulfillment}${order.address ? ` (${order.address})` : ""}\n` +
    `Payment: ${order.paymentTiming || "-"} / ${order.paymentMethod || "-"}\n` +
    (order.notes ? `Notes: ${order.notes}\n` : "") +
    `\nItems:\n${itemLines}\n\nTotal: ${formatMoney(order.total)}`;

  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: NOTIFY_EMAIL,
      subject: `New order from ${order.customerName} \u2014 ${formatMoney(order.total)}`,
      text,
    });
  } catch (err) {
    // Never let a failed email block or fail the actual order.
    console.error("Failed to send order notification email:", err);
  }
}

exports.submitOrder = functions.https.onCall(async (data) => {
  const { order, folderId } = data || {};

  if (!order || !order.phone || !Array.isArray(order.items) || order.items.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Order is missing required fields.");
  }

  // Look up the order limit for this specific menu from shop-config,
  // rather than trusting a limit value sent by the client.
  let orderLimit = 2;
  let limitEnabled = true;
  const configSnap = await db.collection("kv").doc("shop-config").get();
  if (configSnap.exists) {
    try {
      const cfg = JSON.parse(configSnap.data().value);
      const folder = (cfg.folders || []).find((f) => f.id === folderId);
      if (folder) {
        limitEnabled = folder.showOrderLimit !== false;
        orderLimit = folder.orderLimitPerHousehold || 2;
      }
    } catch {
      // If shop-config is missing/unparsable, fall back to the defaults above.
    }
  }

  const phoneKey = normalizePhone(order.phone);

  if (limitEnabled) {
    const existing = await db.collection("orders").where("phoneKey", "==", phoneKey).get();
    const activeCount = existing.docs.filter((d) => d.data().status !== "cancelled").length;
    if (activeCount >= orderLimit) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `You've reached the order limit for this round (max ${orderLimit} per household). Please reach out directly if you need more.`
      );
    }
  }

  const id = order.id || db.collection("orders").doc().id;
  await db.collection("orders").doc(id).set({ ...order, id, phoneKey });

  await sendOrderEmail({ ...order, id });

  return { id };
});
