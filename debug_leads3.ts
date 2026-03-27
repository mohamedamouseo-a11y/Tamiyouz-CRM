import { leads, metaLeadgenConfig, campaigns, customFields, users } from "./drizzle/schema";
import { getDb } from "./server/db";
import { eq, or, and, isNull } from "drizzle-orm";
import { normalizeSaudiPhone } from "./server/googleSheets";

// Simulate the exact flow for lead 1701129577550245
async function main() {
  const db = await getDb();
  
  // Step 1: Get the config
  const configs = await db.select().from(metaLeadgenConfig).where(eq(metaLeadgenConfig.isEnabled, 1));
  console.log("Configs:", configs.length);
  
  for (const config of configs) {
    console.log("Config:", config.pageId, config.pageName);
    console.log("fieldMapping type:", typeof config.fieldMapping);
    console.log("fieldMapping:", JSON.stringify(config.fieldMapping));
    
    // Step 2: Parse fieldMapping the same way the code does
    const fieldMapping = (typeof config.fieldMapping === 'string' ? (() => { try { return JSON.parse(config.fieldMapping); } catch { return {}; } })() : config.fieldMapping) ?? {};
    console.log("Parsed fieldMapping:", JSON.stringify(fieldMapping));
    
    // Step 3: Check what mapMetaFields does with empty field_data
    // The lead 1701129577550245 might have unusual field_data
  }
  
  // Step 4: Check assignOwner - does it use a select that could fail?
  // Check the campaigns table
  try {
    console.log("\nTest campaigns select:");
    const [camp] = await db
      .select({ id: campaigns.id, roundRobinIndex: campaigns.roundRobinIndex, roundRobinEnabled: campaigns.roundRobinEnabled })
      .from(campaigns)
      .where(eq(campaigns.name, "test"))
      .limit(1);
    console.log("Campaigns select works");
  } catch (err: any) {
    console.error("ERROR in campaigns select:", err.message, err.stack);
  }

  // Step 5: Check the users select
  try {
    console.log("\nTest users select:");
    const usersResult = await db
      .select({ id: users.id, name: users.name, teamId: users.teamId })
      .from(users)
      .limit(1);
    console.log("Users select works, got", usersResult.length);
  } catch (err: any) {
    console.error("ERROR in users select:", err.message, err.stack);
  }

  // Step 6: Check the metaLeadgenConfig roundRobinIndex select
  try {
    console.log("\nTest roundRobinIndex select:");
    const [rr] = await db
      .select({ roundRobinIndex: metaLeadgenConfig.roundRobinIndex })
      .from(metaLeadgenConfig)
      .limit(1);
    console.log("RoundRobin select works:", rr);
  } catch (err: any) {
    console.error("ERROR in roundRobinIndex select:", err.message, err.stack);
  }

  process.exit(0);
}

main().catch(console.error);
