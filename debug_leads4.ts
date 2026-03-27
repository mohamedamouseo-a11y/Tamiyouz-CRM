import { metaLeadgenConfig } from "./drizzle/schema";
import { Table } from "drizzle-orm";

const columns = (metaLeadgenConfig as any)[Table.Symbol.Columns];
console.log("metaLeadgenConfig columns:");
for (const [key, value] of Object.entries(columns)) {
  console.log(" ", key, value === undefined ? "UNDEFINED" : value === null ? "NULL" : "OK");
}
console.log("\nHas roundRobinIndex?", "roundRobinIndex" in columns);
