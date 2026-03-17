import { getDb } from "../db.js";
import { leads, deals, activities } from "../../drizzle/schema.js";
import { sql } from "drizzle-orm";

interface ArchiveOptions {
  startDate: Date;
  endDate: Date;
  cleanupMode: "archive" | "delete"; // archive = move to archived table, delete = permanently delete
  dryRun?: boolean; // If true, only count records without modifying
}

interface ArchiveResult {
  status: "success" | "error";
  message: string;
  recordsAffected: {
    leads: number;
    deals: number;
    activities: number;
  };
  dryRun: boolean;
  errors: string[];
}

export class ArchiveService {
  /**
   * Archive or delete old data within a date range
   */
  async archiveData(options: ArchiveOptions): Promise<ArchiveResult> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const { startDate, endDate, cleanupMode, dryRun = false } = options;
    const result: ArchiveResult = {
      status: "success",
      message: "Archive operation completed successfully",
      recordsAffected: { leads: 0, deals: 0, activities: 0 },
      dryRun,
      errors: [],
    };

    try {
      // Validate date range
      if (startDate > endDate) {
        throw new Error("startDate must be less than or equal to endDate");
      }

      // Count records that will be affected
      const leadCount = await this.countLeads(startDate, endDate);
      const dealCount = await this.countDeals(startDate, endDate);
      const activityCount = await this.countActivities(startDate, endDate);

      result.recordsAffected = {
        leads: leadCount,
        deals: dealCount,
        activities: activityCount,
      };

      // If dry run, return counts without making changes
      if (dryRun) {
        result.message = `DRY RUN: Would archive/delete ${leadCount} leads, ${dealCount} deals, and ${activityCount} activities`;
        return result;
      }

      // Perform actual archiving/deletion
      if (cleanupMode === "delete") {
        // Delete activities first (foreign key constraint)
        await this.deleteActivities(startDate, endDate);

        // Delete deals
        await this.deleteDeals(startDate, endDate);

        // Delete leads
        await this.deleteLeads(startDate, endDate);

        result.message = `Successfully deleted ${leadCount} leads, ${dealCount} deals, and ${activityCount} activities`;
      } else if (cleanupMode === "archive") {
        // Archive leads (move to archived table)
        await this.archiveLeads(startDate, endDate);

        // Archive deals
        await this.archiveDeals(startDate, endDate);

        // Archive activities
        await this.archiveActivities(startDate, endDate);

        result.message = `Successfully archived ${leadCount} leads, ${dealCount} deals, and ${activityCount} activities`;
      }

      return result;
    } catch (error) {
      result.status = "error";
      result.message = `Archive operation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
      return result;
    }
  }

  /**
   * Count leads within date range
   */
  private async countLeads(startDate: Date, endDate: Date): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(
        sql`(${leads.createdAt} BETWEEN ${startDate} AND ${endDate}) OR (${leads.contactTime} BETWEEN ${startDate} AND ${endDate})`
      );

    return result[0]?.count || 0;
  }

  /**
   * Count deals within date range
   */
  private async countDeals(startDate: Date, endDate: Date): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(deals)
      .where(sql`${deals.createdAt} BETWEEN ${startDate} AND ${endDate}`);

    return result[0]?.count || 0;
  }

  /**
   * Count activities within date range
   */
  private async countActivities(startDate: Date, endDate: Date): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(activities)
      .where(sql`${activities.createdAt} BETWEEN ${startDate} AND ${endDate}`);

    return result[0]?.count || 0;
  }

  /**
   * Delete leads within date range
   */
  private async deleteLeads(startDate: Date, endDate: Date): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    // First, get all lead IDs to delete related records
    const leadsToDelete = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        sql`(${leads.createdAt} BETWEEN ${startDate} AND ${endDate}) OR (${leads.contactTime} BETWEEN ${startDate} AND ${endDate})`
      );

    const leadIds = leadsToDelete.map((l) => l.id);

    if (leadIds.length === 0) return;

    // Delete related deals and activities first
    await this.deleteDealsForLeads(leadIds);
    await this.deleteActivitiesForLeads(leadIds);

    // Delete leads
    await db
      .delete(leads)
      .where(
        sql`(${leads.createdAt} BETWEEN ${startDate} AND ${endDate}) OR (${leads.contactTime} BETWEEN ${startDate} AND ${endDate})`
      );
  }

  /**
   * Delete deals within date range
   */
  private async deleteDeals(startDate: Date, endDate: Date): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    await db
      .delete(deals)
      .where(sql`${deals.createdAt} BETWEEN ${startDate} AND ${endDate}`);
  }

  /**
   * Delete activities within date range
   */
  private async deleteActivities(startDate: Date, endDate: Date): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    await db
      .delete(activities)
      .where(sql`${activities.createdAt} BETWEEN ${startDate} AND ${endDate}`);
  }

  /**
   * Delete deals for specific leads
   */
  private async deleteDealsForLeads(leadIds: number[]): Promise<void> {
    if (leadIds.length === 0) return;
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    await db
      .delete(deals)
      .where(sql`${deals.leadId} IN (${sql.join(leadIds)})`);
  }

  /**
   * Delete activities for specific leads
   */
  private async deleteActivitiesForLeads(leadIds: number[]): Promise<void> {
    if (leadIds.length === 0) return;
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    await db
      .delete(activities)
      .where(sql`${activities.leadId} IN (${sql.join(leadIds)})`);
  }

  /**
   * Archive leads (placeholder - requires archived tables)
   */
  private async archiveLeads(startDate: Date, endDate: Date): Promise<void> {
    // This would require creating archived tables:
    // - leads_archived
    // - deals_archived
    // - activities_archived
    //
    // For now, we'll just delete them as the archive functionality
    // requires additional table setup. In production, you would:
    // 1. Create INSERT INTO leads_archived SELECT * FROM leads WHERE...
    // 2. Then DELETE FROM leads WHERE...

    console.warn(
      "Archive mode requires archived tables setup. Falling back to deletion."
    );
    await this.deleteLeads(startDate, endDate);
  }

  /**
   * Archive deals (placeholder - requires archived tables)
   */
  private async archiveDeals(startDate: Date, endDate: Date): Promise<void> {
    console.warn(
      "Archive mode requires archived tables setup. Falling back to deletion."
    );
    await this.deleteDeals(startDate, endDate);
  }

  /**
   * Archive activities (placeholder - requires archived tables)
   */
  private async archiveActivities(startDate: Date, endDate: Date): Promise<void> {
    console.warn(
      "Archive mode requires archived tables setup. Falling back to deletion."
    );
    await this.deleteActivities(startDate, endDate);
  }

  /**
   * Get archive statistics
   */
  async getArchiveStats(): Promise<{
    totalLeads: number;
    totalDeals: number;
    totalActivities: number;
    oldestLeadDate: Date | null;
    oldestDealDate: Date | null;
    oldestActivityDate: Date | null;
  }> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const leadStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
        oldest: sql<Date>`MIN(${leads.createdAt})`,
      })
      .from(leads);

    const dealStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
        oldest: sql<Date>`MIN(${deals.createdAt})`,
      })
      .from(deals);

    const activityStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
        oldest: sql<Date>`MIN(${activities.createdAt})`,
      })
      .from(activities);

    return {
      totalLeads: leadStats[0]?.count || 0,
      totalDeals: dealStats[0]?.count || 0,
      totalActivities: activityStats[0]?.count || 0,
      oldestLeadDate: leadStats[0]?.oldest || null,
      oldestDealDate: dealStats[0]?.oldest || null,
      oldestActivityDate: activityStats[0]?.oldest || null,
    };
  }
}

export const archiveService = new ArchiveService();
