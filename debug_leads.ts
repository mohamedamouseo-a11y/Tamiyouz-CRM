import { leads } from "./drizzle/schema";
import { Table } from "drizzle-orm";

const columns = (leads as any)[Table.Symbol.Columns];
console.log("Columns via Symbol:");
if (columns) {
  for (const [key, value] of Object.entries(columns)) {
    if (value === undefined || value === null) {
      console.log("  NULL/UNDEFINED:", key);
    } else {
      console.log("  OK:", key);
    }
  }
} else {
  console.log("No columns found via Symbol");
}
console.log("Done");
