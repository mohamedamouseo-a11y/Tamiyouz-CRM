// Test script for rakanReportGenerator
// Run from /var/www/tamiyouz_crm with: node test_rakan_report.js

const path = require("path");
process.env.DATABASE_URL = "mysql://tamiyouz:TamiyouzDB@2025@localhost:3306/tamiyouz_crm";

async function main() {
  // Dynamic import for ESM module
  const { generateRakanReport } = require("./dist/index.js").default || {};
  
  // Since the built file is ESM bundle, we'll test the SQL queries directly
  const mysql = require("mysql2/promise");
  const pool = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "tamiyouz",
    password: "TamiyouzDB@2025",
    database: "tamiyouz_crm",
  });

  console.log("=== Testing Sales Performance Query ===");
  try {
    const [rows] = await pool.query(`
      SELECT
        d.id AS deal_id,
        d.dealName AS deal_name,
        d.value AS deal_value,
        d.currency AS deal_currency,
        d.stage AS deal_stage,
        d.probability,
        d.expectedCloseDate AS expected_close,
        d.createdAt AS deal_created,
        l.id AS lead_id,
        l.name AS lead_name,
        l.stage AS lead_stage,
        l.campaignName AS lead_source,
        u.name AS owner_name
      FROM deals d
      LEFT JOIN leads l ON d.leadId = l.id
      LEFT JOIN users u ON l.assignedTo = u.id
      WHERE d.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY d.createdAt DESC
      LIMIT 10
    `);
    console.log(`Found ${rows.length} deals in last 30 days`);
    if (rows.length > 0) {
      console.log("Sample row:", JSON.stringify(rows[0], null, 2));
    }
  } catch (e) {
    console.error("Sales Performance Error:", e.message);
  }

  console.log("\n=== Testing SLA Breaches Query ===");
  try {
    const [rows] = await pool.query(`
      SELECT
        l.id AS lead_id,
        l.name AS lead_name,
        l.stage,
        l.campaignName AS source,
        l.createdAt AS lead_created,
        l.updatedAt AS last_updated,
        u.name AS assigned_to,
        TIMESTAMPDIFF(HOUR, l.createdAt, NOW()) AS hours_since_creation
      FROM leads l
      LEFT JOIN users u ON l.assignedTo = u.id
      WHERE l.stage = 'New'
        AND l.createdAt <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY l.createdAt ASC
      LIMIT 10
    `);
    console.log(`Found ${rows.length} SLA breach leads`);
    if (rows.length > 0) {
      console.log("Sample row:", JSON.stringify(rows[0], null, 2));
    }
  } catch (e) {
    console.error("SLA Breaches Error:", e.message);
  }

  console.log("\n=== Testing Activities Query ===");
  try {
    const [rows] = await pool.query(`
      SELECT
        a.id AS activity_id,
        a.type AS activity_type,
        a.title,
        a.description,
        a.status,
        a.date AS activity_date,
        a.createdAt AS created_at,
        u.name AS performed_by,
        l.name AS lead_name
      FROM activities a
      LEFT JOIN users u ON a.userId = u.id
      LEFT JOIN leads l ON a.leadId = l.id
      WHERE a.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY a.createdAt DESC
      LIMIT 10
    `);
    console.log(`Found ${rows.length} activities in last 30 days`);
    if (rows.length > 0) {
      console.log("Sample row:", JSON.stringify(rows[0], null, 2));
    }
  } catch (e) {
    console.error("Activities Error:", e.message);
  }

  console.log("\n=== Testing Contracts Query ===");
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id AS contract_id,
        c.contractName AS contract_name,
        c.charges AS amount,
        c.currency,
        c.status,
        c.startDate AS start_date,
        c.endDate AS end_date,
        c.createdAt AS created_at,
        cl.companyName AS client_name,
        u.name AS account_manager
      FROM contracts c
      LEFT JOIN clients cl ON c.clientId = cl.id
      LEFT JOIN users u ON c.accountManagerId = u.id
      ORDER BY c.endDate ASC
      LIMIT 10
    `);
    console.log(`Found ${rows.length} contracts`);
    if (rows.length > 0) {
      console.log("Sample row:", JSON.stringify(rows[0], null, 2));
    }
  } catch (e) {
    console.error("Contracts Error:", e.message);
  }

  console.log("\n=== All queries passed! ===");
  await pool.end();
}

main().catch(console.error);
