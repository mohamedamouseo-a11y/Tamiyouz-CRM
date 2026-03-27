import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { existsSync } from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startEmailScheduler } from "../emailReports";
import { streamLeadsExcel } from "../excelExport";
import { authenticateRequest } from "../auth";
import { startSyncScheduler } from "../syncEngine";
import { startMeetingReminderScheduler } from "../meetingReminder";
import { setupChat } from "../services/chat";
import { startNotificationEngine } from "../notificationEngine";
import { startExchangeRateScheduler } from "../exchangeRateSync";
import { backupService } from "../services/BackupService";
import { MetaLeadgenService, startMetaLeadgenPolling } from "../services/MetaLeadgenService";
import { restoreService } from "../services/RestoreService";
import { promises as fs } from "fs";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve uploaded files from local storage
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) {
    const { mkdirSync } = await import("fs");
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));
  // Rakan report downloads
  const downloadsDir = path.resolve(process.cwd(), "public", "downloads");
  if (!existsSync(downloadsDir)) {
    const { mkdirSync } = await import("fs");
    mkdirSync(downloadsDir, { recursive: true });
  }
  app.use("/downloads", express.static(downloadsDir));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Real-time Chat
  setupChat(server);

  // ── Backup Download endpoint ──────────────────────────────────────────────
  app.get("/admin/backup/download/:fileName", async (req, res) => {
    try {
      // Auth check via session cookie
      const user = await authenticateRequest(req as any).catch(() => null);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.role !== "Admin" && user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      const { fileName } = req.params;
      // Security: only allow alphanumeric, dots, underscores, hyphens
      if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
        res.status(400).json({ error: "Invalid file name" });
        return;
      }
      const filePath = backupService.getBackupFilePath(fileName);
      if (!existsSync(filePath)) {
        res.status(404).json({ error: "Backup file not found" });
        return;
      }
      const ext = path.extname(fileName).toLowerCase();
      const contentType = ext === ".csv" ? "text/csv" : "application/json";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.sendFile(filePath);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message ?? "Download failed" });
      }
    }
  });

  // ── Backup Restore endpoint (file upload via JSON body) ───────────────────
  app.post("/api/backup/restore", async (req, res) => {
    try {
      // Auth check via session cookie
      const user = await authenticateRequest(req as any).catch(() => null);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.role !== "Admin" && user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      const { backupData, confirmed } = req.body;
      if (!confirmed) {
        res.status(400).json({ error: "Please confirm the restore operation" });
        return;
      }
      if (!backupData) {
        res.status(400).json({ error: "No backup data provided" });
        return;
      }
      // Write backup data to a temp file
      const tempFilePath = path.join(process.cwd(), "backups", `restore_temp_${Date.now()}.json`);
      await fs.writeFile(tempFilePath, JSON.stringify(backupData), "utf-8");
      try {
        // Validate the backup file first
        const validation = await restoreService.validateBackupFile(tempFilePath);
        if (!validation.isValid) {
          await fs.unlink(tempFilePath).catch(() => {});
          res.status(400).json({ error: "Invalid backup file", details: validation.errors });
          return;
        }
        // Restore from the temp file
        const result = await restoreService.restoreFromJson(tempFilePath);
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});
        res.json({ success: true, ...result });
      } catch (restoreErr) {
        await fs.unlink(tempFilePath).catch(() => {});
        throw restoreErr;
      }
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message ?? "Restore failed" });
      }
    }
  });

  // ── Excel Export endpoint ──────────────────────────────────────────────────
  app.get("/api/export/leads", async (req, res) => {
    try {
      // Auth check via session cookie
      const user = await authenticateRequest(req as any).catch(() => null);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.role !== "Admin" && user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      const q = req.query as Record<string, string>;
      await streamLeadsExcel(res, {
        limit:         q.limit         ? Math.min(5000, parseInt(q.limit))  : 100,
        stage:         q.stage         || undefined,
        leadQuality:   q.leadQuality   as any || undefined,
        campaignName:  q.campaignName  || undefined,
        slaBreached:   q.slaBreached === "true"  ? true
                     : q.slaBreached === "false" ? false
                     : undefined,
        search:        q.search        || undefined,
        dateFrom:      q.dateFrom      ? new Date(q.dateFrom) : undefined,
        dateTo:        q.dateTo        ? new Date(q.dateTo)   : undefined,
      });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message ?? "Export failed" });
      }
    }
  });
  // ── Meta Leadgen Webhook ──────────────────────────────────────────────────
  // GET: Webhook verification (Meta sends a challenge)
  app.get("/api/meta/webhook", async (req, res) => {
    try {
      const mode = req.query["hub.mode"] as string;
      const token = req.query["hub.verify_token"] as string;
      const challenge = req.query["hub.challenge"] as string;

      if (mode === "subscribe" && token) {
        const config = await MetaLeadgenService.findConfigByVerifyToken(token);
        if (config) {
          console.log("[MetaLeadgen] Webhook verified for page:", config.pageId);
          res.status(200).send(challenge);
          return;
        }
      }

      console.warn("[MetaLeadgen] Webhook verification failed");
      res.status(403).send("Forbidden");
    } catch (err: any) {
      console.error("[MetaLeadgen] Webhook verification error:", err);
      res.status(500).send("Error");
    }
  });

  // POST: Receive leadgen webhook events
  app.post("/api/meta/webhook", async (req, res) => {
    try {
      // Validate signature if present
      const signature = req.headers["x-hub-signature-256"] as string | undefined;
      const rawBody = JSON.stringify(req.body);

      const isValid = await MetaLeadgenService.validateWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.warn("[MetaLeadgen] Invalid webhook signature");
        res.status(403).send("Invalid signature");
        return;
      }

      // Process the webhook asynchronously
      const result = await MetaLeadgenService.processLeadgenWebhook(req.body);
      console.log(`[MetaLeadgen] Webhook processed: ${result.processed} leads, ${result.skipped} skipped`);

      // Always respond 200 to Meta quickly
      res.status(200).json({ status: "ok", ...result });
    } catch (err: any) {
      console.error("[MetaLeadgen] Webhook processing error:", err);
      // Still respond 200 to prevent Meta from retrying
      res.status(200).json({ status: "error", message: err.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().then(() => {
  // Start email scheduler after server is up
  startEmailScheduler();
  // Start lead source sync scheduler
  // Start meeting reminder scheduler
  startMeetingReminderScheduler();
  // Start lead source sync scheduler
  startSyncScheduler().catch((err) => {
    console.error("[SyncEngine] Failed to start sync scheduler:", err);
  });

  // Auto-subscribe Meta leadgen pages to webhook events on startup
  MetaLeadgenService.autoSubscribeAllPages().catch((err) => {
    console.error("[MetaLeadgen] Failed to auto-subscribe pages:", err);
  });
  // Start Meta leadgen polling scheduler (fallback for webhook)
  startMetaLeadgenPolling();
  // Start notification engine
  startNotificationEngine();
  // Start exchange rate auto-sync scheduler
  startExchangeRateScheduler();
}).catch(console.error);
