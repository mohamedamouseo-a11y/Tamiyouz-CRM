import { createWriteStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import { Transform } from "stream";
import path from "path";
import { getDb } from "../db.js";
import { leads, deals, activities, customFields } from "../../drizzle/schema.js";
import { sql } from "drizzle-orm";

interface BackupOptions {
  startDate: Date;
  endDate: Date;
  format: "json" | "csv" | "both";
  includeCustomFields?: boolean;
}

interface BackupResult {
  fileName: string;
  filePath: string;
  fileSize: number;
  format: string;
  recordCount: {
    leads: number;
    deals: number;
    activities: number;
  };
}

export class BackupService {
  private backupDir = path.join(process.cwd(), "backups");

  constructor() {
    // Ensure backup directory exists
    fs.mkdir(this.backupDir, { recursive: true }).catch(console.error);
  }

  /**
   * Generate a backup of data within a date range
   */
  async generateBackup(options: BackupOptions): Promise<BackupResult[]> {
    const { startDate, endDate, format, includeCustomFields = true } = options;

    // Validate date range
    if (startDate > endDate) {
      throw new Error("startDate must be less than or equal to endDate");
    }

    const datePrefix = this.formatDateForFileName(startDate, endDate);
    const results: BackupResult[] = [];

    if (format === "json" || format === "both") {
      const jsonResult = await this.generateJsonBackup(
        startDate,
        endDate,
        datePrefix,
        includeCustomFields
      );
      results.push(jsonResult);
    }

    if (format === "csv" || format === "both") {
      const csvResult = await this.generateCsvBackup(startDate, endDate, datePrefix);
      results.push(csvResult);
    }

    return results;
  }

  /**
   * Generate JSON backup with all related data
   */
  private async generateJsonBackup(
    startDate: Date,
    endDate: Date,
    datePrefix: string,
    includeCustomFields: boolean
  ): Promise<BackupResult> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const fileName = `crm_backup_${datePrefix}.json`;
    const filePath = path.join(this.backupDir, fileName);

    const writeStream = createWriteStream(filePath);
    let recordCount = {
      leads: 0,
      deals: 0,
      activities: 0,
    };

    try {
      // Start JSON structure
      await this.writeToStream(writeStream, '{\n  "metadata": {\n');
      await this.writeToStream(
        writeStream,
        `    "exportDate": "${new Date().toISOString()}",\n`
      );
      await this.writeToStream(
        writeStream,
        `    "startDate": "${startDate.toISOString()}",\n`
      );
      await this.writeToStream(
        writeStream,
        `    "endDate": "${endDate.toISOString()}"\n`
      );
      await this.writeToStream(writeStream, "  },\n");

      // Export leads
      await this.writeToStream(writeStream, '  "leads": [\n');
      recordCount.leads = await this.exportLeadsAsJson(
        writeStream,
        startDate,
        endDate
      );
      await this.writeToStream(writeStream, "\n  ],\n");

      // Export deals
      await this.writeToStream(writeStream, '  "deals": [\n');
      recordCount.deals = await this.exportDealsAsJson(
        writeStream,
        startDate,
        endDate
      );
      await this.writeToStream(writeStream, "\n  ],\n");

      // Export activities
      await this.writeToStream(writeStream, '  "activities": [\n');
      recordCount.activities = await this.exportActivitiesAsJson(
        writeStream,
        startDate,
        endDate
      );
      await this.writeToStream(writeStream, "\n  ]");

      if (includeCustomFields) {
        await this.writeToStream(writeStream, ",\n");
        await this.writeToStream(writeStream, '  "customFields": [\n');
        await this.exportCustomFieldsAsJson(writeStream);
        await this.writeToStream(writeStream, "\n  ]");
      }

      // Close JSON
      await this.writeToStream(writeStream, "\n}");

      writeStream.end();
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      const fileSize = (await fs.stat(filePath)).size;

      return {
        fileName,
        filePath,
        fileSize,
        format: "json",
        recordCount,
      };
    } catch (error) {
      await fs.unlink(filePath).catch(() => {});
      throw error;
    }
  }

  /**
   * Generate CSV backup (leads only, flattened)
   */
  private async generateCsvBackup(
    startDate: Date,
    endDate: Date,
    datePrefix: string
  ): Promise<BackupResult> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const fileName = `crm_backup_${datePrefix}.csv`;
    const filePath = path.join(this.backupDir, fileName);

    try {
      // Fetch leads within date range
      const leadsData = await db
        .select()
        .from(leads)
        .where(
          sql`(${leads.createdAt} BETWEEN ${startDate} AND ${endDate}) OR (${leads.contactTime} BETWEEN ${startDate} AND ${endDate})`
        )
        .limit(10000); // Batch limit

      if (leadsData.length === 0) {
        throw new Error("No leads found in the specified date range");
      }

      // Prepare CSV headers
      const headers = Object.keys(leadsData[0]);
      const csvContent = [
        headers.join(","),
        ...leadsData.map((lead) =>
          headers
            .map((header) => {
              const value = (lead as any)[header];
              if (value === null || value === undefined) return "";
              if (typeof value === "string" && value.includes(",")) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(",")
        ),
      ].join("\n");

      await fs.writeFile(filePath, csvContent, "utf-8");
      const fileSize = (await fs.stat(filePath)).size;

      return {
        fileName,
        filePath,
        fileSize,
        format: "csv",
        recordCount: {
          leads: leadsData.length,
          deals: 0,
          activities: 0,
        },
      };
    } catch (error) {
      await fs.unlink(filePath).catch(() => {});
      throw error;
    }
  }

  /**
   * Export leads as JSON (streaming)
   */
  private async exportLeadsAsJson(
    writeStream: NodeJS.WritableStream,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const batchSize = 1000;
    let offset = 0;
    let recordCount = 0;
    let isFirst = true;

    while (true) {
      const batch = await db
        .select()
        .from(leads)
        .where(
          sql`(${leads.createdAt} BETWEEN ${startDate} AND ${endDate}) OR (${leads.contactTime} BETWEEN ${startDate} AND ${endDate})`
        )
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) break;

      for (const lead of batch) {
        if (!isFirst) {
          await this.writeToStream(writeStream, ",\n");
        }
        await this.writeToStream(writeStream, "    " + JSON.stringify(lead));
        isFirst = false;
        recordCount++;
      }

      offset += batchSize;
    }

    return recordCount;
  }

  /**
   * Export deals as JSON (streaming)
   */
  private async exportDealsAsJson(
    writeStream: NodeJS.WritableStream,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const batchSize = 1000;
    let offset = 0;
    let recordCount = 0;
    let isFirst = true;

    while (true) {
      const batch = await db
        .select()
        .from(deals)
        .where(
          sql`${deals.createdAt} BETWEEN ${startDate} AND ${endDate}`
        )
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) break;

      for (const deal of batch) {
        if (!isFirst) {
          await this.writeToStream(writeStream, ",\n");
        }
        await this.writeToStream(writeStream, "    " + JSON.stringify(deal));
        isFirst = false;
        recordCount++;
      }

      offset += batchSize;
    }

    return recordCount;
  }

  /**
   * Export activities as JSON (streaming)
   */
  private async exportActivitiesAsJson(
    writeStream: NodeJS.WritableStream,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const batchSize = 1000;
    let offset = 0;
    let recordCount = 0;
    let isFirst = true;

    while (true) {
      const batch = await db
        .select()
        .from(activities)
        .where(
          sql`${activities.createdAt} BETWEEN ${startDate} AND ${endDate}`
        )
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) break;

      for (const activity of batch) {
        if (!isFirst) {
          await this.writeToStream(writeStream, ",\n");
        }
        await this.writeToStream(writeStream, "    " + JSON.stringify(activity));
        isFirst = false;
        recordCount++;
      }

      offset += batchSize;
    }

    return recordCount;
  }

  /**
   * Export custom fields as JSON
   */
  private async exportCustomFieldsAsJson(
    writeStream: NodeJS.WritableStream
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const fields = await db.select().from(customFields);
    const jsonStr = fields.map((f) => JSON.stringify(f)).join(",\n    ");
    await this.writeToStream(writeStream, "    " + jsonStr);
  }

  /**
   * Helper to write to stream
   */
  private writeToStream(
    stream: NodeJS.WritableStream,
    data: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!stream.write(data)) {
        stream.once("drain", resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Format date range for file name
   */
  private formatDateForFileName(startDate: Date, endDate: Date): string {
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    return `${start}_to_${end}`;
  }

  /**
   * Get list of available backups
   */
  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      return files.filter((f) => f.startsWith("crm_backup_"));
    } catch {
      return [];
    }
  }

  /**
   * Get backup file path for download
   */
  getBackupFilePath(fileName: string): string {
    const filePath = path.join(this.backupDir, fileName);
    // Security check: ensure file is within backupDir
    if (!filePath.startsWith(this.backupDir)) {
      throw new Error("Invalid file path");
    }
    return filePath;
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(fileName: string): Promise<void> {
    const filePath = this.getBackupFilePath(fileName);
    await fs.unlink(filePath);
  }
}

export const backupService = new BackupService();
