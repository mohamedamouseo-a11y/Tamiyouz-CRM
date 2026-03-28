import axios from "axios";
import jwt from "jsonwebtoken";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";

const TAMARA_BASE_URL = process.env.TAMARA_BASE_URL || "https://api.tamara.co";

// ─── DB Connection ─────────────────────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  if (!_db) throw new Error("DB not initialized");
  return _db;
}

let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  if (!_pool) throw new Error("Pool not initialized");
  return _pool;
}

// ─── Tamara Settings Table (inline Drizzle schema) ─────────────────────────────
const tamaraSettings = mysqlTable("tamara_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// ─── Types ─────────────────────────────────────────────────────────────────────
export type TamaraSettings = {
  tamara_api_token: string;
  tamara_public_key: string;
  tamara_notification_token: string;
  tamara_merchant_id: string;
  tamara_enabled: boolean;
};

type TamaraCheckoutResponse = {
  order_id: string;
  checkout_id: string;
  checkout_url: string;
  status?: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function splitName(fullName?: string | null) {
  const clean = (fullName || "").trim().replace(/\s+/g, " ");
  if (!clean) {
    return { firstName: "Customer", lastName: "Name" };
  }

  const parts = clean.split(" ");
  const firstName = parts.shift() || "Customer";
  const lastName = parts.join(" ") || "Name";
  return { firstName, lastName };
}

function normalizeSaudiPhone(phone?: string | null) {
  const raw = (phone || "").replace(/[^\d+]/g, "");
  if (!raw) return "966500000000";

  const digitsOnly = raw.replace(/\D/g, "");

  if (digitsOnly.startsWith("966")) return digitsOnly;
  if (digitsOnly.startsWith("05")) return `966${digitsOnly.slice(1)}`;
  if (digitsOnly.startsWith("5") && digitsOnly.length === 9) return `966${digitsOnly}`;
  if (digitsOnly.startsWith("00966")) return digitsOnly.slice(2);

  return digitsOnly;
}

function countryCodeFromCountry(country?: string | null) {
  const value = (country || "").trim().toLowerCase();

  if (["sa", "ksa", "saudi", "saudi arabia", "السعودية", "المملكة العربية السعودية"].includes(value)) {
    return "SA";
  }
  if (["ae", "uae", "united arab emirates", "الإمارات"].includes(value)) {
    return "AE";
  }
  if (["kw", "kuwait", "الكويت"].includes(value)) {
    return "KW";
  }
  if (["bh", "bahrain", "البحرين"].includes(value)) {
    return "BH";
  }
  if (["om", "oman", "عمان"].includes(value)) {
    return "OM";
  }

  return "SA";
}

function parseOrderReference(orderReferenceId: string): { type: "deal" | "contract"; id: number } {
  const normalized = (orderReferenceId || "").trim();

  const contractMatch = normalized.match(/^CONTRACT_(\d+)$/i);
  if (contractMatch) return { type: "contract", id: Number(contractMatch[1]) };

  const dealMatch = normalized.match(/^DEAL_(\d+)$/i);
  if (dealMatch) return { type: "deal", id: Number(dealMatch[1]) };

  const numericMatch = normalized.match(/(\d+)/);
  if (numericMatch) return { type: "deal", id: Number(numericMatch[1]) };

  throw new Error(`Unable to parse order_reference_id: ${orderReferenceId}`);
}

// ─── Notification Helpers ──────────────────────────────────────────────────────
async function tryInsertInAppNotification(userId: number, title: string, message: string) {
  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO in_app_notifications (userId, type, title, body, isRead, createdAt)
       VALUES (?, 'system', ?, ?, 0, NOW())`,
      [userId, title, message],
    );
  } catch (err) {
    console.warn("[Tamara] Failed to insert in-app notification:", err);
  }
}

async function resolveResponsibleUserId(leadId?: number | null, dealId?: number | null) {
  const pool = getPool();

  if (leadId) {
    try {
      const [rows] = await pool.execute(
        "SELECT assignedTo FROM leads WHERE id = ? LIMIT 1",
        [Number(leadId)],
      ) as any;
      const userId = Number(rows?.[0]?.assignedTo || 0);
      if (userId > 0) return userId;
    } catch {}
  }

  return null;
}

async function sendPaymentSuccessNotification(params: { dealId: number; leadId?: number | null; orderId: string }) {
  const pool = getPool();

  // Get lead info for better notification
  let leadName = "Lead";
  let leadPhone = "";
  let dealValue = "";
  if (params.leadId) {
    try {
      const [leadRows] = await pool.execute("SELECT name, phone FROM leads WHERE id = ? LIMIT 1", [params.leadId]) as any;
      if (leadRows?.[0]) {
        leadName = leadRows[0].name || leadRows[0].phone || "Lead";
        leadPhone = leadRows[0].phone || "";
      }
    } catch {}
  }
  try {
    const [dealRows] = await pool.execute("SELECT valueSar, currency FROM deals WHERE id = ? LIMIT 1", [params.dealId]) as any;
    if (dealRows?.[0]) {
      dealValue = `${dealRows[0].valueSar || "0"} ${dealRows[0].currency || "SAR"}`;
    }
  } catch {}

  const title = `\u062a\u0645\u0627\u0631\u0627 | \u062f\u0641\u0639\u0629 \u0645\u0642\u0628\u0648\u0636\u0629 - ${leadName}`;
  const body = `Deal #${params.dealId} (${dealValue}) was paid via Tamara. Order: ${params.orderId}`;
  const bodyAr = `\u062a\u0645 \u062f\u0641\u0639\u0647\u0627 \u0639\u0628\u0631 \u062a\u0645\u0627\u0631\u0627 (${dealValue}) .\u0627\u0644\u0635\u0641\u0642\u0629 #${params.dealId} \u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: ${params.orderId}`;

  // Notify the responsible sales agent
  const salesUserId = await resolveResponsibleUserId(params.leadId, params.dealId);
  if (salesUserId) {
    await tryInsertInAppNotification(salesUserId, title, body);
  }

  // Notify all admins
  try {
    const [adminRows] = await pool.execute(
      "SELECT id FROM users WHERE role IN ('Admin', 'admin', 'SalesManager') AND isActive = 1 AND deletedAt IS NULL"
    ) as any;
    for (const admin of (adminRows || [])) {
      if (admin.id === salesUserId) continue; // skip if already notified
      await tryInsertInAppNotification(admin.id, title, body);
    }
  } catch (err) {
    console.warn("[Tamara] Failed to notify admins:", err);
  }

  // Create audit log entry
  try {
    await pool.execute(
      `INSERT INTO audit_logs (userId, userName, userRole, action, entityType, entityId, entityName, details, createdAt)
       VALUES (0, 'Tamara System', 'system', 'tamara_payment', 'deals', ?, ?, ?, NOW())`,
      [params.dealId, leadName, JSON.stringify({ orderId: params.orderId, dealValue, leadId: params.leadId, event: "payment_approved" })]
    );
  } catch (err) {
    console.warn("[Tamara] Failed to create audit log:", err);
  }
}

// ─── Contract Payment Notification (Account Management) ──────────────────────
async function sendContractPaymentNotification(params: { contractId: number; orderId: string }) {
  const pool = getPool();

  // Fetch contract
  let contractCharges = "";
  let clientId = 0;
  try {
    const [cRows] = await pool.execute("SELECT clientId, charges, currency, contractName FROM contracts WHERE id = ? LIMIT 1", [params.contractId]) as any;
    if (cRows?.[0]) {
      contractCharges = `${cRows[0].charges || "0"} ${cRows[0].currency || "SAR"}`;
      clientId = cRows[0].clientId;
    }
  } catch {}

  // Fetch client to get accountManagerId and name
  let clientName = "Client";
  let accountManagerId: number | null = null;
  if (clientId) {
    try {
      const [clRows] = await pool.execute("SELECT leadName, phone, accountManagerId FROM clients WHERE id = ? LIMIT 1", [clientId]) as any;
      if (clRows?.[0]) {
        clientName = clRows[0].leadName || clRows[0].phone || "Client";
        accountManagerId = clRows[0].accountManagerId ? Number(clRows[0].accountManagerId) : null;
      }
    } catch {}
  }

  const title = `\u062a\u0645\u0627\u0631\u0627 | \u062f\u0641\u0639\u0629 \u0639\u0642\u062f \u0645\u0642\u0628\u0648\u0636\u0629 - ${clientName}`;
  const body = `Contract #${params.contractId} (${contractCharges}) was paid via Tamara. Order: ${params.orderId}`;

  // Notify the Account Manager
  if (accountManagerId) {
    await tryInsertInAppNotification(accountManagerId, title, body);
  }

  // Notify all admins
  try {
    const [adminRows] = await pool.execute(
      "SELECT id FROM users WHERE role IN ('Admin', 'admin', 'SalesManager') AND isActive = 1 AND deletedAt IS NULL"
    ) as any;
    for (const admin of (adminRows || [])) {
      if (admin.id === accountManagerId) continue;
      await tryInsertInAppNotification(admin.id, title, body);
    }
  } catch (err) {
    console.warn("[Tamara] Failed to notify admins for contract payment:", err);
  }

  // Create audit log entry
  try {
    await pool.execute(
      `INSERT INTO audit_logs (userId, userName, userRole, action, entityType, entityId, entityName, details, createdAt)
       VALUES (0, 'Tamara System', 'system', 'tamara_contract_payment', 'contracts', ?, ?, ?, NOW())`,
      [params.contractId, clientName, JSON.stringify({ orderId: params.orderId, contractCharges, clientId, event: "contract_payment_approved" })]
    );
  } catch (err) {
    console.warn("[Tamara] Failed to create contract audit log:", err);
  }
}

// ─── Settings CRUD ─────────────────────────────────────────────────────────────
export async function getTamaraSettings(): Promise<TamaraSettings> {
  const db = getDb();
  const rows = await db.select().from(tamaraSettings);

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.settingKey, row.settingValue || "");
  }

  return {
    tamara_api_token: map.get("tamara_api_token") || "",
    tamara_public_key: map.get("tamara_public_key") || "",
    tamara_notification_token: map.get("tamara_notification_token") || "",
    tamara_merchant_id: map.get("tamara_merchant_id") || "",
    tamara_enabled: (map.get("tamara_enabled") || "false") === "true",
  };
}

export async function updateTamaraSettings(input: TamaraSettings) {
  const db = getDb();
  const pairs: Record<string, string> = {
    tamara_api_token: input.tamara_api_token || "",
    tamara_public_key: input.tamara_public_key || "",
    tamara_notification_token: input.tamara_notification_token || "",
    tamara_merchant_id: input.tamara_merchant_id || "",
    tamara_enabled: input.tamara_enabled ? "true" : "false",
  };

  for (const [settingKey, settingValue] of Object.entries(pairs)) {
    await db
      .insert(tamaraSettings)
      .values({ settingKey, settingValue })
      .onDuplicateKeyUpdate({
        set: {
          settingValue,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  return await getTamaraSettings();
}

// ─── Checkout Session ──────────────────────────────────────────────────────────
export async function createTamaraCheckoutSession(dealId: number): Promise<TamaraCheckoutResponse> {
  const settings = await getTamaraSettings();
  const pool = getPool();

  if (!settings.tamara_enabled) {
    throw new Error("Tamara is disabled from admin settings.");
  }

  if (!settings.tamara_api_token) {
    throw new Error("Tamara API token is missing.");
  }

  // Fetch deal
  const [dealRows] = await pool.execute(
    "SELECT * FROM deals WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [dealId],
  ) as any;
  const deal = dealRows?.[0];

  if (!deal) {
    throw new Error("Deal not found.");
  }

  if (deal.status !== "Pending") {
    throw new Error("Tamara checkout can only be created for pending deals.");
  }

  if (!deal.leadId) {
    throw new Error("This deal is not linked to a lead.");
  }

  // Fetch lead
  const [leadRows] = await pool.execute(
    "SELECT * FROM leads WHERE id = ? LIMIT 1",
    [deal.leadId],
  ) as any;
  const lead = leadRows?.[0];

  if (!lead) {
    throw new Error("Lead not found.");
  }

  const amount = Number(deal.valueSar || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Deal amount is invalid.");
  }

  const currency = deal.currency || "SAR";
  const { firstName, lastName } = splitName(lead.name);

  const payload = {
    total_amount: {
      amount,
      currency,
    },
    shipping_amount: {
      amount: 0,
      currency,
    },
    tax_amount: {
      amount: 0,
      currency,
    },
    order_reference_id: `DEAL_${deal.id}`,
    order_number: `DEAL_${deal.id}`,
    items: [
      {
        name: `CRM Deal #${deal.id}`,
        type: "Digital",
        reference_id: `DEAL_${deal.id}`,
        sku: `DEAL_${deal.id}`,
        quantity: 1,
        total_amount: {
          amount,
          currency,
        },
      },
    ],
    consumer: {
      first_name: firstName,
      last_name: lastName,
      phone_number: normalizeSaudiPhone(lead.phone),
      email: lead.email || "no-email@example.com",
    },
    country_code: countryCodeFromCountry(lead.country),
    description: `Payment for deal #${deal.id}`,
    merchant_url: {
      success: `https://sales.tamiyouzplaform.com/leads/${lead.id}?payment=success`,
      failure: `https://sales.tamiyouzplaform.com/leads/${lead.id}?payment=failure`,
      cancel: `https://sales.tamiyouzplaform.com/leads/${lead.id}?payment=cancel`,
      notification: `https://sales.tamiyouzplaform.com/api/tamara/webhook`,
    },
  };

  const response = await axios.post<TamaraCheckoutResponse>(`${TAMARA_BASE_URL}/checkout`, payload, {
    headers: {
      Authorization: `Bearer ${settings.tamara_api_token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

// ─── Authorise Order ───────────────────────────────────────────────────────────
export async function authoriseTamaraOrder(orderId: string) {
  const settings = await getTamaraSettings();

  if (!settings.tamara_api_token) {
    throw new Error("Tamara API token is missing.");
  }

  const response = await axios.post(
    `${TAMARA_BASE_URL}/orders/${orderId}/authorise`,
    {},
    {
      headers: {
        Authorization: `Bearer ${settings.tamara_api_token}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

// ─── Webhook Verification ──────────────────────────────────────────────────────
export async function verifyTamaraWebhookRequest(params: {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}) {
  const settings = await getTamaraSettings();

  if (!settings.tamara_notification_token) {
    throw new Error("Tamara notification token is missing.");
  }

  const authorizationHeader = params.headers.authorization || params.headers.Authorization;
  const headerToken = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader?.toString().replace(/^Bearer\s+/i, "").trim();

  const queryToken =
    typeof params.query?.tamaraToken === "string"
      ? params.query.tamaraToken
      : Array.isArray(params.query?.tamaraToken)
        ? String(params.query?.tamaraToken[0] || "")
        : "";

  const webhookJwt = headerToken || queryToken;

  if (!webhookJwt) {
    throw new Error("Tamara webhook token is missing.");
  }

  jwt.verify(webhookJwt, settings.tamara_notification_token, {
    algorithms: ["HS256"],
  });

  return true;
}

// ─── Webhook Handler ───────────────────────────────────────────────────────────
export async function handleTamaraWebhook(payload: any) {
  const pool = getPool();
  const status = payload?.status || payload?.order_status || payload?.data?.status;
  const orderId = payload?.order_id || payload?.data?.order_id;
  const orderReferenceId = payload?.order_reference_id || payload?.data?.order_reference_id;

  if (status !== "approved") {
    return {
      ok: true,
      ignored: true,
      reason: `Unhandled status: ${status || "unknown"}`,
    };
  }

  if (!orderId) {
    throw new Error("Tamara webhook payload does not include order_id.");
  }

  if (!orderReferenceId) {
    throw new Error("Tamara webhook payload does not include order_reference_id.");
  }

  const ref = parseOrderReference(orderReferenceId);

  // ─── CONTRACT payment ─────────────────────────────────────────────
  if (ref.type === "contract") {
    const contractId = ref.id;
    const [cRows] = await pool.execute(
      "SELECT * FROM contracts WHERE id = ? AND deletedAt IS NULL LIMIT 1",
      [contractId],
    ) as any;
    const contract = cRows?.[0];
    if (!contract) throw new Error(`Contract #${contractId} was not found.`);

    // Avoid double-processing
    if (contract.contractRenewalStatus === "Renewed") {
      return { ok: true, ignored: true, reason: "Contract already marked as Renewed." };
    }

    await authoriseTamaraOrder(orderId);

    // Update contract: status -> Active, renewalStatus -> Renewed
    await pool.execute(
      "UPDATE contracts SET status = 'Active', contractRenewalStatus = 'Renewed', updatedAt = NOW() WHERE id = ?",
      [contractId],
    );

    await sendContractPaymentNotification({ contractId, orderId });

    return { ok: true, contractId, orderId, newStatus: "Renewed" };
  }

  // ─── DEAL payment (existing flow) ─────────────────────────────────
  const dealId = ref.id;

  // Fetch deal
  const [dealRows] = await pool.execute(
    "SELECT * FROM deals WHERE id = ? LIMIT 1",
    [dealId],
  ) as any;
  const deal = dealRows?.[0];

  if (!deal) {
    throw new Error(`Deal #${dealId} was not found.`);
  }

  if (deal.status === "Won") {
    return {
      ok: true,
      ignored: true,
      reason: "Deal already marked as Won.",
    };
  }

  await authoriseTamaraOrder(orderId);

  // Update deal status to Won
  await pool.execute(
    "UPDATE deals SET status = 'Won', closedAt = NOW(), updatedAt = NOW() WHERE id = ?",
    [dealId],
  );

  await sendPaymentSuccessNotification({
    dealId,
    leadId: deal.leadId,
    orderId,
  });

  return {
    ok: true,
    dealId,
    orderId,
    newStatus: "Won",
  };
}


// ─── Contract Checkout (Account Management) ──────────────────────────────────
export async function createTamaraCheckoutForContract(contractId: number): Promise<TamaraCheckoutResponse> {
  const settings = await getTamaraSettings();
  const pool = getPool();

  if (!settings.tamara_enabled) {
    throw new Error("Tamara is disabled from admin settings.");
  }
  if (!settings.tamara_api_token) {
    throw new Error("Tamara API token is missing.");
  }

  // Fetch contract
  const [contractRows] = await pool.execute(
    "SELECT * FROM contracts WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [contractId],
  ) as any;
  const contract = contractRows?.[0];
  if (!contract) throw new Error("Contract not found.");

  const amount = Number(contract.charges || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Contract charges are invalid or zero.");
  }
  const currency = contract.currency || "SAR";

  // Fetch client
  const [clientRows] = await pool.execute(
    "SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [contract.clientId],
  ) as any;
  const client = clientRows?.[0];
  if (!client) throw new Error("Client not found.");

  // Resolve customer name: prefer clients.leadName, fallback to leads table
  let customerName = client.leadName || "";
  if (!customerName && client.leadId) {
    const [leadRows] = await pool.execute("SELECT name FROM leads WHERE id = ? LIMIT 1", [client.leadId]) as any;
    customerName = leadRows?.[0]?.name || "Customer";
  }
  if (!customerName) customerName = "Customer";

  const customerPhone = client.phone || client.contactPhone || "";
  const customerEmail = client.contactEmail || "no-email@example.com";

  const { firstName, lastName } = splitName(customerName);

  const payload = {
    total_amount: { amount, currency },
    shipping_amount: { amount: 0, currency },
    tax_amount: { amount: 0, currency },
    order_reference_id: `CONTRACT_${contractId}`,
    order_number: `CONTRACT_${contractId}`,
    items: [
      {
        name: contract.contractName || `Contract Renewal #${contractId}`,
        type: "Digital",
        reference_id: `CONTRACT_${contractId}`,
        sku: `CONTRACT_${contractId}`,
        quantity: 1,
        total_amount: { amount, currency },
      },
    ],
    consumer: {
      first_name: firstName,
      last_name: lastName,
      phone_number: normalizeSaudiPhone(customerPhone),
      email: customerEmail,
    },
    country_code: "SA",
    description: `Payment for contract renewal #${contractId}`,
    merchant_url: {
      success: `https://sales.tamiyouzplaform.com/clients/${contract.clientId}?payment=success`,
      failure: `https://sales.tamiyouzplaform.com/clients/${contract.clientId}?payment=failure`,
      cancel: `https://sales.tamiyouzplaform.com/clients/${contract.clientId}?payment=cancel`,
      notification: `https://sales.tamiyouzplaform.com/api/tamara/webhook`,
    },
  };

  const response = await axios.post<TamaraCheckoutResponse>(`${TAMARA_BASE_URL}/checkout`, payload, {
    headers: {
      Authorization: `Bearer ${settings.tamara_api_token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}
