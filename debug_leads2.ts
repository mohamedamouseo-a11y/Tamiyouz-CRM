import { leads, metaLeadgenConfig } from "./drizzle/schema";
import { getDb } from "./server/db";
import { eq, or } from "drizzle-orm";

async function main() {
  const db = await getDb();
  
  // Try to reproduce the exact error: select by externalId for the failing lead
  try {
    console.log("Test 1: select by externalId...");
    const [existingById] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.externalId, "1701129577550245"))
      .limit(1);
    console.log("Result:", existingById);
  } catch (err: any) {
    console.error("Error in test 1:", err.message);
  }

  // Try the phone check
  try {
    console.log("\nTest 2: select by phone...");
    const [existingByPhone] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.phone, "0500000000"))
      .limit(1);
    console.log("Result:", existingByPhone);
  } catch (err: any) {
    console.error("Error in test 2:", err.message);
  }

  // Try the insert
  try {
    console.log("\nTest 3: insert with all fields...");
    // Don't actually insert, just test the query building
    const query = db.insert(leads).values({
      name: "Test Lead",
      phone: "0501234567",
      country: "Saudi Arabia",
      businessProfile: null,
      leadQuality: "Unknown",
      campaignName: null,
      adCreative: null,
      ownerId: null as any,
      stage: "New",
      notes: null,
      externalId: "test_debug_12345",
      sourceId: null as any,
      sourceMetadata: { test: true },
      customFieldsData: {},
      leadTime: null,
    });
    console.log("Insert query built successfully");
    // Don't execute - just test building
  } catch (err: any) {
    console.error("Error in test 3:", err.message, err.stack);
  }

  // Try the full select that happens in the code
  try {
    console.log("\nTest 4: full select().from(leads)...");
    const rows = await db.select().from(leads).limit(1);
    console.log("Full select works, got", rows.length, "rows");
  } catch (err: any) {
    console.error("Error in test 4:", err.message);
  }

  process.exit(0);
}

main().catch(console.error);
