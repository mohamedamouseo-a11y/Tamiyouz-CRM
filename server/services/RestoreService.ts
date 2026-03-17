import { promises as fs } from "fs";
import { getDb } from "../db.js";
import { leads, deals, activities, customFields } from "../../drizzle/schema.js";

interface RestoreResult {
  status: "success" | "partial" | "error";
  message: string;
  recordsRestored: {
    leads: number;
    deals: number;
    activities: number;
  };
  recordsSkipped: {
    leads: number;
    deals: number;
    activities: number;
  };
  errors: string[];
}

export class RestoreService {
  /**
   * Restore data from a JSON backup file
   */
  async restoreFromJson(filePath: string): Promise<RestoreResult> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const result: RestoreResult = {
      status: "success",
      message: "Restore completed successfully",
      recordsRestored: { leads: 0, deals: 0, activities: 0 },
      recordsSkipped: { leads: 0, deals: 0, activities: 0 },
      errors: [],
    };

    try {
      // Read and parse JSON file
      const fileContent = await fs.readFile(filePath, "utf-8");
      const backupData = JSON.parse(fileContent);

      if (!backupData.leads || !Array.isArray(backupData.leads)) {
        throw new Error("Invalid backup file format: missing leads array");
      }

      // Restore leads
      for (const leadData of backupData.leads) {
        try {
          await this.restoreLead(leadData, result);
        } catch (error) {
          result.errors.push(
            `Error restoring lead ${leadData.id}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          result.recordsSkipped.leads++;
        }
      }

      // Restore deals
      if (backupData.deals && Array.isArray(backupData.deals)) {
        for (const dealData of backupData.deals) {
          try {
            await this.restoreDeal(dealData, result);
          } catch (error) {
            result.errors.push(
              `Error restoring deal ${dealData.id}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            result.recordsSkipped.deals++;
          }
        }
      }

      // Restore activities
      if (backupData.activities && Array.isArray(backupData.activities)) {
        for (const activityData of backupData.activities) {
          try {
            await this.restoreActivity(activityData, result);
          } catch (error) {
            result.errors.push(
              `Error restoring activity ${activityData.id}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
            result.recordsSkipped.activities++;
          }
        }
      }

      // Set status based on results
      if (result.errors.length > 0) {
        result.status = "partial";
        result.message = `Restore completed with ${result.errors.length} errors`;
      }

      return result;
    } catch (error) {
      return {
        status: "error",
        message: `Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        recordsRestored: { leads: 0, deals: 0, activities: 0 },
        recordsSkipped: { leads: 0, deals: 0, activities: 0 },
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Restore a single lead, checking for duplicates
   */
  private async restoreLead(
    leadData: any,
    result: RestoreResult
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    // Check for duplicate by phone number
    const existingLead = await db
      .select()
      .from(leads)
      .where(leads.phone === leadData.phone)
      .limit(1);

    if (existingLead.length > 0) {
      // Lead already exists, skip it
      result.recordsSkipped.leads++;
      return;
    }

    // Remove id to let database auto-generate
    const { id, ...leadInsertData } = leadData;

    // Ensure required fields
    if (!leadInsertData.phone) {
      throw new Error("Phone number is required");
    }

    // Insert the lead
    await db.insert(leads).values(leadInsertData);
    result.recordsRestored.leads++;
  }

  /**
   * Restore a single deal, checking for duplicates
   */
  private async restoreDeal(
    dealData: any,
    result: RestoreResult
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    // Check if deal with same leadId and createdAt already exists
    const existingDeal = await db
      .select()
      .from(deals)
      .where(deals.leadId === dealData.leadId)
      .limit(1);

    if (existingDeal.length > 0) {
      // Deal already exists for this lead, skip it
      result.recordsSkipped.deals++;
      return;
    }

    // Remove id to let database auto-generate
    const { id, ...dealInsertData } = dealData;

    // Ensure required fields
    if (!dealInsertData.leadId) {
      throw new Error("leadId is required");
    }

    // Insert the deal
    await db.insert(deals).values(dealInsertData);
    result.recordsRestored.deals++;
  }

  /**
   * Restore a single activity, checking for duplicates
   */
  private async restoreActivity(
    activityData: any,
    result: RestoreResult
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    // Activities can have duplicates, so we check by leadId, userId, type, and activityTime
    const existingActivity = await db
      .select()
      .from(activities)
      .where(
        activities.leadId === activityData.leadId &&
          activities.userId === activityData.userId &&
          activities.type === activityData.type &&
          activities.activityTime === activityData.activityTime
      )
      .limit(1);

    if (existingActivity.length > 0) {
      // Activity already exists, skip it
      result.recordsSkipped.activities++;
      return;
    }

    // Remove id to let database auto-generate
    const { id, ...activityInsertData } = activityData;

    // Ensure required fields
    if (!activityInsertData.leadId || !activityInsertData.userId) {
      throw new Error("leadId and userId are required");
    }

    // Insert the activity
    await db.insert(activities).values(activityInsertData);
    result.recordsRestored.activities++;
  }

  /**
   * Validate a backup file before restoring
   */
  async validateBackupFile(filePath: string): Promise<{
    isValid: boolean;
    errors: string[];
    summary: {
      leads: number;
      deals: number;
      activities: number;
    };
  }> {
    const errors: string[] = [];
    const summary = { leads: 0, deals: 0, activities: 0 };

    try {
      const fileContent = await fs.readFile(filePath, "utf-8");
      const backupData = JSON.parse(fileContent);

      // Check structure
      if (!backupData.leads || !Array.isArray(backupData.leads)) {
        errors.push("Missing or invalid 'leads' array");
      } else {
        summary.leads = backupData.leads.length;
      }

      if (backupData.deals && !Array.isArray(backupData.deals)) {
        errors.push("Invalid 'deals' array");
      } else if (backupData.deals) {
        summary.deals = backupData.deals.length;
      }

      if (backupData.activities && !Array.isArray(backupData.activities)) {
        errors.push("Invalid 'activities' array");
      } else if (backupData.activities) {
        summary.activities = backupData.activities.length;
      }

      // Validate lead records
      if (backupData.leads) {
        for (let i = 0; i < backupData.leads.length; i++) {
          const lead = backupData.leads[i];
          if (!lead.phone) {
            errors.push(`Lead at index ${i} is missing required field: phone`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        summary,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Failed to validate backup file: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
        summary: { leads: 0, deals: 0, activities: 0 },
      };
    }
  }
}

export const restoreService = new RestoreService();
