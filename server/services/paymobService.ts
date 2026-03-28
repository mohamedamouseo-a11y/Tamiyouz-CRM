import axios from "axios";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";

const PAYMOB_BASE_URL = process.env.PAYMOB_BASE_URL || "https://accept.paymob.com";

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

// ─── Paymob Settings Table (inline Drizzle schema) ────────────────────────────
const paymobSettings = mysqlTable("paymob_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// ─── Types ─────────────────────────────────────────────────────────────────────
export type PaymobSettings = {
  paymob_api_key: string;
  paymob_hmac_secret: string;
  paymob_integration_id_card_eg: string;
  paymob_integration_id_card_sa: string;
  paymob_integration_id_wallet_eg: string;
  paymob_iframe_id: string;
  paymob_enabled: boolean;
};

export type PaymobPaymentMethod = "card" | "wallet";

export type PaymobCheckoutResponse = {
  order_id: number;
  payment_token: string;
  iframe_url: string;
  merchant_order_id: string;
  payment_method: PaymobPaymentMethod;
  redirect_url?: string;
};

type PaymentContext = {
  merchantOrderId: string;
  amountCents: number;
  currency: "EGP" | "SAR";
  customerName: string;
  email: string;
  phone: string;
  countryCode: "EG" | "SA";
  itemName: string;
};

type PaymobTransactionLike = {
  amount_cents?: string | number;
  created_at?: string;
  currency?: string;
  error_occured?: boolean | string;
  has_parent_transaction?: boolean | string;
  id?: string | number;
  integration_id?: string | number;
  is_3d_secure?: boolean | string;
  is_auth?: boolean | string;
  is_capture?: boolean | string;
  is_refunded?: boolean | string;
  is_standalone_payment?: boolean | string;
  is_voided?: boolean | string;
  owner?: string | number;
  pending?: boolean | string;
  success?: boolean | string;
  merchant_order_id?: string;
  order?: {
    id?: string | number;
    merchant_order_id?: string;
  } | string | number;
  source_data?: {
    pan?: string;
    sub_type?: string;
    type?: string;
  };
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function splitName(fullName?: string | null) {
  const clean = (fullName || "").trim().replace(/\s+/g, " ");
  if (!clean) return { firstName: "Customer", lastName: "Name" };
  const parts = clean.split(" ");
  const firstName = parts.shift() || "Customer";
  const lastName = parts.join(" ") || "Name";
  return { firstName, lastName };
}

function normalizeDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function normalizePhone(phone: string | null | undefined, countryCode: "EG" | "SA") {
  const digits = normalizeDigits(phone);
  if (!digits) return countryCode === "EG" ? "201000000000" : "966500000000";

  if (countryCode === "EG") {
    if (digits.startsWith("20")) return digits;
    if (digits.startsWith("0020")) return digits.slice(2);
    if (digits.startsWith("01")) return `20${digits.slice(1)}`;
    if (digits.startsWith("1") && digits.length === 10) return `20${digits}`;
    return digits;
  }

  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("00966")) return digits.slice(2);
  if (digits.startsWith("05")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `966${digits}`;
  return digits;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  return false;
}

function stringifyHmacValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function amountToCents(amount: number | string | null | undefined) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Amount is invalid.");
  return Math.round(value * 100);
}

function currencyToCountry(currency: string | null | undefined): "EG" | "SA" {
  const upper = (currency || "SAR").toUpperCase();
  return upper === "EGP" ? "EG" : "SA";
}

function ensureSupportedCurrency(currency: string | null | undefined): "EGP" | "SAR" {
  const upper = (currency || "SAR").toUpperCase();
  if (upper !== "EGP" && upper !== "SAR") {
    throw new Error(`Unsupported currency for Paymob: ${upper}`);
  }
  return upper;
}

function buildIframeUrl(iframeId: string, paymentToken: string) {
  return `${PAYMOB_BASE_URL}/api/acceptance/iframes/${iframeId}?payment_token=${encodeURIComponent(paymentToken)}`;
}

function pickIntegrationId(
  settings: PaymobSettings,
  currency: "EGP" | "SAR",
  paymentMethod: PaymobPaymentMethod,
) {
  if (paymentMethod === "wallet") {
    if (currency !== "EGP") {
      throw new Error("Paymob mobile wallets are only configured for Egypt in this integration.");
    }
    if (!settings.paymob_integration_id_wallet_eg) {
      throw new Error("Paymob wallet integration ID for Egypt is missing.");
    }
    return Number(settings.paymob_integration_id_wallet_eg);
  }

  if (currency === "EGP") {
    if (!settings.paymob_integration_id_card_eg) {
      throw new Error("Paymob card integration ID for Egypt is missing.");
    }
    return Number(settings.paymob_integration_id_card_eg);
  }

  if (!settings.paymob_integration_id_card_sa) {
    throw new Error("Paymob card integration ID for Saudi Arabia is missing.");
  }
  return Number(settings.paymob_integration_id_card_sa);
}

async function getColumns(tableName: string) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName],
  );
  return new Set(((rows as any[]) || []).map((row: any) => row.COLUMN_NAME));
}

async function getAdminsAndManagers() {
  const pool = getPool();
  const columns = await getColumns("users");
  if (columns.size === 0 || !columns.has("id")) return [] as number[];

  const roleColumn = columns.has("role") ? "role" : columns.has("userRole") ? "userRole" : null;
  if (!roleColumn) return [] as number[];

  const deletedFilter = columns.has("deletedAt") ? " AND deletedAt IS NULL" : "";
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM users
      WHERE LOWER(${roleColumn}) IN ('admin', 'super admin', 'super_admin', 'salesmanager', 'sales manager')
      ${deletedFilter}
    `,
  );

  return ((rows as any[]) || []).map((row: any) => Number(row.id)).filter(Boolean);
}

async function tryInsertInAppNotification(userId: number, title: string, body: string) {
  if (!userId) return;
  try {
    const pool = getPool();
    await pool.execute(
      `
        INSERT INTO in_app_notifications (userId, type, title, body, isRead, createdAt)
        VALUES (?, 'system', ?, ?, 0, NOW())
      `,
      [userId, title, body],
    );
  } catch (error) {
    console.warn("[Paymob] Failed to insert in-app notification:", error);
  }
}

async function insertAuditLog(params: {
  action: "paymob_payment" | "paymob_contract_payment";
  entityType: "deal" | "contract";
  entityId: number;
  entityName: string;
  details: string;
}) {
  try {
    const pool = getPool();
    await pool.execute(
      `
        INSERT INTO audit_logs (userId, userName, userRole, action, entityType, entityId, entityName, details, createdAt)
        VALUES (NULL, 'Paymob Webhook', 'system', ?, ?, ?, ?, ?, NOW())
      `,
      [params.action, params.entityType, params.entityId, params.entityName, params.details],
    );
  } catch (error) {
    console.warn("[Paymob] Failed to insert audit log:", error);
  }
}

async function sendPaymobPaymentNotification(params: {
  dealId: number;
  leadId: number;
  leadName: string;
  orderId: string;
}) {
  const pool = getPool();
  const recipients = new Set<number>();

  const [leadRows] = await pool.execute(
    `SELECT assignedTo FROM leads WHERE id = ? LIMIT 1`,
    [params.leadId],
  );
  const assignedTo = Number((leadRows as any[])?.[0]?.assignedTo || 0);
  if (assignedTo) recipients.add(assignedTo);

  const admins = await getAdminsAndManagers();
  admins.forEach((id) => recipients.add(id));

  const title = `بيموب | دفعة مقبوضة - ${params.leadName}`;
  const body = `تم استلام دفعة ناجحة للصفقة #${params.dealId} عبر Paymob. رقم العملية المرجعي: ${params.orderId}.`;

  for (const userId of recipients) {
    await tryInsertInAppNotification(userId, title, body);
  }

  await insertAuditLog({
    action: "paymob_payment",
    entityType: "deal",
    entityId: params.dealId,
    entityName: params.leadName,
    details: body,
  });
}

async function sendPaymobContractPaymentNotification(params: {
  contractId: number;
  clientName: string;
  orderId: string;
}) {
  const pool = getPool();
  const recipients = new Set<number>();

  const [rows] = await pool.execute(
    `
      SELECT c.accountManagerId, ct.renewalAssignedTo
      FROM contracts ct
      INNER JOIN clients c ON c.id = ct.clientId
      WHERE ct.id = ?
      LIMIT 1
    `,
    [params.contractId],
  );

  const contractRow = (rows as any[])?.[0];
  const accountManagerId = Number(contractRow?.accountManagerId || 0);
  const renewalAssignedTo = Number(contractRow?.renewalAssignedTo || 0);
  if (accountManagerId) recipients.add(accountManagerId);
  if (renewalAssignedTo) recipients.add(renewalAssignedTo);

  const admins = await getAdminsAndManagers();
  admins.forEach((id) => recipients.add(id));

  const title = `بيموب | دفعة عقد مقبوضة - ${params.clientName}`;
  const body = `تم استلام دفعة ناجحة للعقد #${params.contractId} عبر Paymob. رقم العملية المرجعي: ${params.orderId}.`;

  for (const userId of recipients) {
    await tryInsertInAppNotification(userId, title, body);
  }

  await insertAuditLog({
    action: "paymob_contract_payment",
    entityType: "contract",
    entityId: params.contractId,
    entityName: params.clientName,
    details: body,
  });
}

function normalizeTransactionPayload(raw: any): PaymobTransactionLike {
  const tx = raw?.obj && typeof raw.obj === "object" ? raw.obj : raw;
  const orderValue = tx?.order;
  const normalizedOrder =
    typeof orderValue === "object" && orderValue !== null
      ? {
          id: (orderValue as any).id ?? tx?.["order.id"] ?? tx?.order_id,
          merchant_order_id:
            (orderValue as any).merchant_order_id ?? tx?.merchant_order_id ?? tx?.["merchant_order_id"],
        }
      : {
          id: tx?.["order.id"] ?? tx?.order_id ?? orderValue,
          merchant_order_id: tx?.merchant_order_id ?? tx?.["merchant_order_id"],
        };

  const sourceData =
    tx?.source_data && typeof tx.source_data === "object"
      ? tx.source_data
      : {
          pan: tx?.["source_data.pan"],
          sub_type: tx?.["source_data.sub_type"],
          type: tx?.["source_data.type"],
        };

  return {
    amount_cents: tx?.amount_cents,
    created_at: tx?.created_at,
    currency: tx?.currency,
    error_occured: tx?.error_occured,
    has_parent_transaction: tx?.has_parent_transaction,
    id: tx?.id,
    integration_id: tx?.integration_id,
    is_3d_secure: tx?.is_3d_secure,
    is_auth: tx?.is_auth,
    is_capture: tx?.is_capture,
    is_refunded: tx?.is_refunded,
    is_standalone_payment: tx?.is_standalone_payment,
    is_voided: tx?.is_voided,
    owner: tx?.owner,
    pending: tx?.pending,
    success: tx?.success,
    merchant_order_id: tx?.merchant_order_id ?? tx?.["merchant_order_id"],
    order: normalizedOrder,
    source_data: sourceData,
  };
}

function parseMerchantOrderId(value?: string | null) {
  const raw = (value || "").trim();
  const match = raw.match(/^(DEAL|CONTRACT)_(\d+)$/i);
  if (!match) throw new Error(`Invalid merchant_order_id received from Paymob: ${raw}`);
  return { kind: match[1].toUpperCase() as "DEAL" | "CONTRACT", id: Number(match[2]) };
}

// ─── Settings CRUD ─────────────────────────────────────────────────────────────
export async function getPaymobSettings(): Promise<PaymobSettings> {
  const db = getDb();
  const rows = await db.select().from(paymobSettings);
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.settingKey, row.settingValue || "");

  return {
    paymob_api_key: map.get("paymob_api_key") || "",
    paymob_hmac_secret: map.get("paymob_hmac_secret") || "",
    paymob_integration_id_card_eg: map.get("paymob_integration_id_card_eg") || "",
    paymob_integration_id_card_sa: map.get("paymob_integration_id_card_sa") || "",
    paymob_integration_id_wallet_eg: map.get("paymob_integration_id_wallet_eg") || "",
    paymob_iframe_id: map.get("paymob_iframe_id") || "",
    paymob_enabled: (map.get("paymob_enabled") || "false") === "true",
  };
}

export async function updatePaymobSettings(input: PaymobSettings) {
  const db = getDb();
  const pairs: Record<string, string> = {
    paymob_api_key: input.paymob_api_key || "",
    paymob_hmac_secret: input.paymob_hmac_secret || "",
    paymob_integration_id_card_eg: input.paymob_integration_id_card_eg || "",
    paymob_integration_id_card_sa: input.paymob_integration_id_card_sa || "",
    paymob_integration_id_wallet_eg: input.paymob_integration_id_wallet_eg || "",
    paymob_iframe_id: input.paymob_iframe_id || "",
    paymob_enabled: input.paymob_enabled ? "true" : "false",
  };

  for (const [settingKey, settingValue] of Object.entries(pairs)) {
    await db
      .insert(paymobSettings)
      .values({ settingKey, settingValue })
      .onDuplicateKeyUpdate({ set: { settingValue, updatedAt: sql`CURRENT_TIMESTAMP` } });
  }

  return await getPaymobSettings();
}

// ─── Paymob API Helpers ────────────────────────────────────────────────────────
async function authenticatePaymob(apiKey: string) {
  const response = await axios.post<{ token: string }>(`${PAYMOB_BASE_URL}/api/auth/tokens`, {
    api_key: apiKey,
  });
  return response.data.token;
}

async function registerPaymobOrder(params: {
  authToken: string;
  merchantOrderId: string;
  amountCents: number;
  currency: "EGP" | "SAR";
  itemName: string;
}) {
  const response = await axios.post<{ id: number }>(
    `${PAYMOB_BASE_URL}/api/ecommerce/orders`,
    {
      auth_token: params.authToken,
      delivery_needed: false,
      amount_cents: params.amountCents,
      currency: params.currency,
      merchant_order_id: params.merchantOrderId,
      items: [
        {
          name: params.itemName,
          amount_cents: params.amountCents,
          quantity: 1,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${params.authToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data.id;
}

async function createPaymobPaymentKey(params: {
  authToken: string;
  orderId: number;
  amountCents: number;
  currency: "EGP" | "SAR";
  integrationId: number;
  customerName: string;
  email: string;
  phone: string;
  countryCode: "EG" | "SA";
}) {
  const { firstName, lastName } = splitName(params.customerName);

  const response = await axios.post<{ token: string }>(
    `${PAYMOB_BASE_URL}/api/acceptance/payment_keys`,
    {
      auth_token: params.authToken,
      amount_cents: params.amountCents,
      expiration: 3600,
      order_id: params.orderId,
      billing_data: {
        first_name: firstName,
        last_name: lastName,
        email: params.email,
        phone_number: params.phone,
        apartment: "NA",
        floor: "NA",
        street: "NA",
        building: "NA",
        shipping_method: "NA",
        postal_code: "NA",
        city: "NA",
        country: params.countryCode,
        state: "NA",
      },
      currency: params.currency,
      integration_id: params.integrationId,
    },
    {
      headers: {
        Authorization: `Bearer ${params.authToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data.token;
}

async function createWalletRedirect(paymentToken: string, walletPhone: string) {
  const response = await axios.post<{ redirect_url?: string; iframe_redirection_url?: string }>(
    `${PAYMOB_BASE_URL}/api/acceptance/payments/pay`,
    {
      source: {
        identifier: walletPhone,
        subtype: "WALLET",
      },
      payment_token: paymentToken,
    },
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  const redirectUrl = response.data.redirect_url || response.data.iframe_redirection_url;
  if (!redirectUrl) throw new Error("Paymob wallet redirect URL was not returned.");
  return redirectUrl;
}

async function createCheckout(context: PaymentContext, paymentMethod: PaymobPaymentMethod, walletPhone?: string) {
  const settings = await getPaymobSettings();
  if (!settings.paymob_enabled) throw new Error("Paymob is disabled from admin settings.");
  if (!settings.paymob_api_key) throw new Error("Paymob API key is missing.");
  if (paymentMethod === "card" && !settings.paymob_iframe_id) throw new Error("Paymob iframe ID is missing.");

  const integrationId = pickIntegrationId(settings, context.currency, paymentMethod);
  const authToken = await authenticatePaymob(settings.paymob_api_key);
  const orderId = await registerPaymobOrder({
    authToken,
    merchantOrderId: context.merchantOrderId,
    amountCents: context.amountCents,
    currency: context.currency,
    itemName: context.itemName,
  });

  const paymentToken = await createPaymobPaymentKey({
    authToken,
    orderId,
    amountCents: context.amountCents,
    currency: context.currency,
    integrationId,
    customerName: context.customerName,
    email: context.email,
    phone: context.phone,
    countryCode: context.countryCode,
  });

  if (paymentMethod === "wallet") {
    const normalizedWalletPhone = normalizePhone(walletPhone || context.phone, "EG");
    const redirectUrl = await createWalletRedirect(paymentToken, normalizedWalletPhone);
    return {
      order_id: orderId,
      payment_token: paymentToken,
      iframe_url: redirectUrl,
      redirect_url: redirectUrl,
      merchant_order_id: context.merchantOrderId,
      payment_method: paymentMethod,
    } satisfies PaymobCheckoutResponse;
  }

  const iframeUrl = buildIframeUrl(settings.paymob_iframe_id, paymentToken);
  return {
    order_id: orderId,
    payment_token: paymentToken,
    iframe_url: iframeUrl,
    merchant_order_id: context.merchantOrderId,
    payment_method: paymentMethod,
  } satisfies PaymobCheckoutResponse;
}

// ─── Checkout Session (Deals) ──────────────────────────────────────────────────
export async function createPaymobCheckoutForDeal(
  dealId: number,
  options?: { paymentMethod?: PaymobPaymentMethod; walletPhone?: string },
): Promise<PaymobCheckoutResponse> {
  const pool = getPool();
  const paymentMethod = options?.paymentMethod || "card";

  const [dealRows] = await pool.execute(
    `SELECT * FROM deals WHERE id = ? AND deletedAt IS NULL LIMIT 1`,
    [dealId],
  );
  const deal = (dealRows as any[])?.[0];
  if (!deal) throw new Error("Deal not found.");
  if (deal.status !== "Pending") throw new Error("Paymob checkout can only be created for pending deals.");
  if (!deal.leadId) throw new Error("This deal is not linked to a lead.");

  const [leadRows] = await pool.execute(`SELECT * FROM leads WHERE id = ? LIMIT 1`, [deal.leadId]);
  const lead = (leadRows as any[])?.[0];
  if (!lead) throw new Error("Lead not found.");

  const currency = ensureSupportedCurrency(deal.currency);
  const countryCode = currencyToCountry(currency);
  const amountCents = amountToCents(deal.valueSar);

  return await createCheckout(
    {
      merchantOrderId: `DEAL_${deal.id}`,
      amountCents,
      currency,
      customerName: lead.name || `Lead ${lead.id}`,
      email: lead.email || `lead-${lead.id}@no-email.local`,
      phone: normalizePhone(lead.phone, countryCode),
      countryCode,
      itemName: `CRM Deal #${deal.id}`,
    },
    paymentMethod,
    options?.walletPhone,
  );
}

// ─── Contract Checkout (Account Management) ───────────────────────────────────
export async function createPaymobCheckoutForContract(
  contractId: number,
  options?: { paymentMethod?: PaymobPaymentMethod; walletPhone?: string },
): Promise<PaymobCheckoutResponse> {
  const pool = getPool();
  const paymentMethod = options?.paymentMethod || "card";

  const [contractRows] = await pool.execute(
    `SELECT * FROM contracts WHERE id = ? AND deletedAt IS NULL LIMIT 1`,
    [contractId],
  );
  const contract = (contractRows as any[])?.[0];
  if (!contract) throw new Error("Contract not found.");
  if (!contract.clientId) throw new Error("This contract is not linked to a client.");

  const [clientRows] = await pool.execute(`SELECT * FROM clients WHERE id = ? LIMIT 1`, [contract.clientId]);
  const client = (clientRows as any[])?.[0];
  if (!client) throw new Error("Client not found.");

  const currency = ensureSupportedCurrency(contract.currency);
  const countryCode = currencyToCountry(currency);
  const amountCents = amountToCents(contract.charges);
  const customerName = client.leadName || `Client ${client.id}`;
  const customerEmail = client.contactEmail || `client-${client.id}@no-email.local`;
  const customerPhone = normalizePhone(client.contactPhone || client.phone, countryCode);

  return await createCheckout(
    {
      merchantOrderId: `CONTRACT_${contract.id}`,
      amountCents,
      currency,
      customerName,
      email: customerEmail,
      phone: customerPhone,
      countryCode,
      itemName: contract.contractName || `Contract #${contract.id}`,
    },
    paymentMethod,
    options?.walletPhone,
  );
}

// ─── HMAC Verification ─────────────────────────────────────────────────────────
export async function verifyPaymobHmac(data: any, hmacFromQuery?: string | null) {
  const settings = await getPaymobSettings();
  if (!settings.paymob_hmac_secret) throw new Error("Paymob HMAC secret is missing.");

  const tx = normalizeTransactionPayload(data);
  const concatenated = [
    tx.amount_cents,
    tx.created_at,
    tx.currency,
    tx.error_occured,
    tx.has_parent_transaction,
    tx.id,
    tx.integration_id,
    tx.is_3d_secure,
    tx.is_auth,
    tx.is_capture,
    tx.is_refunded,
    tx.is_standalone_payment,
    tx.is_voided,
    typeof tx.order === "object" ? tx.order?.id : tx.order,
    tx.owner,
    tx.pending,
    tx.source_data?.pan,
    tx.source_data?.sub_type,
    tx.source_data?.type,
    tx.success,
  ]
    .map(stringifyHmacValue)
    .join("");

  const calculated = crypto.createHmac("sha512", settings.paymob_hmac_secret).update(concatenated).digest("hex");
  const received = String(hmacFromQuery || "").trim().toLowerCase();

  if (!received) throw new Error("Missing Paymob HMAC.");
  if (received.length !== calculated.length) throw new Error("Invalid Paymob HMAC length.");

  const isValid = crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(received));
  if (!isValid) throw new Error("Invalid Paymob HMAC signature.");

  return { isValid: true, calculated };
}

// ─── Webhook Handler ───────────────────────────────────────────────────────────
export async function handlePaymobWebhook(payload: any, hmac?: string | null) {
  await verifyPaymobHmac(payload, hmac);

  const tx = normalizeTransactionPayload(payload);
  const merchantOrderId =
    tx.merchant_order_id ||
    (typeof tx.order === "object" ? tx.order?.merchant_order_id : undefined) ||
    undefined;

  if (!merchantOrderId) {
    throw new Error("merchant_order_id was not found in Paymob callback payload.");
  }

  const success = normalizeBoolean(tx.success);
  const pending = normalizeBoolean(tx.pending);
  const errorOccured = normalizeBoolean(tx.error_occured);

  if (!success || pending || errorOccured) {
    return {
      ok: true,
      ignored: true,
      merchant_order_id: merchantOrderId,
      reason: "Transaction is not yet successful or still pending.",
    };
  }

  const ref = parseMerchantOrderId(merchantOrderId);
  const pool = getPool();
  const paymobOrderRef = String(tx.id || (typeof tx.order === "object" ? tx.order?.id : tx.order) || merchantOrderId);

  if (ref.kind === "DEAL") {
    const [dealRows] = await pool.execute(`SELECT id, leadId, status FROM deals WHERE id = ? LIMIT 1`, [ref.id]);
    const deal = (dealRows as any[])?.[0];
    if (!deal) throw new Error(`Deal ${ref.id} not found.`);

    if (deal.status !== "Won") {
      await pool.execute(
        `UPDATE deals SET status = 'Won', closedAt = COALESCE(closedAt, NOW()), updatedAt = NOW() WHERE id = ?`,
        [ref.id],
      );

      const [leadRows] = await pool.execute(`SELECT id, name FROM leads WHERE id = ? LIMIT 1`, [deal.leadId]);
      const lead = (leadRows as any[])?.[0];

      await sendPaymobPaymentNotification({
        dealId: ref.id,
        leadId: Number(deal.leadId),
        leadName: lead?.name || `Lead ${deal.leadId}`,
        orderId: paymobOrderRef,
      });
    }

    return {
      ok: true,
      entity: "deal",
      entityId: ref.id,
      merchant_order_id: merchantOrderId,
      paymob_order_ref: paymobOrderRef,
    };
  }

  const [contractRows] = await pool.execute(
    `SELECT id, clientId, status, contractRenewalStatus FROM contracts WHERE id = ? LIMIT 1`,
    [ref.id],
  );
  const contract = (contractRows as any[])?.[0];
  if (!contract) throw new Error(`Contract ${ref.id} not found.`);

  if (!(contract.status === "Active" && contract.contractRenewalStatus === "Renewed")) {
    await pool.execute(
      `
        UPDATE contracts
        SET status = 'Active',
            contractRenewalStatus = 'Renewed',
            updatedAt = NOW()
        WHERE id = ?
      `,
      [ref.id],
    );

    const [clientRows] = await pool.execute(`SELECT id, leadName FROM clients WHERE id = ? LIMIT 1`, [contract.clientId]);
    const client = (clientRows as any[])?.[0];

    await sendPaymobContractPaymentNotification({
      contractId: ref.id,
      clientName: client?.leadName || `Client ${contract.clientId}`,
      orderId: paymobOrderRef,
    });
  }

  return {
    ok: true,
    entity: "contract",
    entityId: ref.id,
    merchant_order_id: merchantOrderId,
    paymob_order_ref: paymobOrderRef,
  };
}
