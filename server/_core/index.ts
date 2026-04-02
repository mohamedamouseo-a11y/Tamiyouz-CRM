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
import { handleTamaraWebhook, verifyTamaraWebhookRequest } from "../services/tamaraService";
import { handlePaymobWebhook } from "../services/paymobService";
import { startRakanAdvisoryEngine } from "../services/rakanAdvisoryEngine";
import { developerHubRouter } from "../routes/developerHub";
import { createPublicLeadIntakeRouter } from "../routes/publicLeadIntake";

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
  app.use(express.json({ limit: "50mb", verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = Buffer.from(buf); } }));
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
  // Developer Hub routes (Super Admin only)
  app.use("/api", developerHubRouter);
  // Landing Page Public Lead Intake
  app.use("/api/public", createPublicLeadIntakeRouter());
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

  // ── Demo Sync SSE endpoint (Super Admin only) ──────────────────────────
  app.post("/api/demo-sync", async (req, res) => {
    try {
      // Auth check
      const user = await authenticateRequest(req as any).catch(() => null);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // Super admin check (admin@tamiyouz.com only)
      if (user.email !== "admin@tamiyouz.com") {
        res.status(403).json({ error: "Super Admin access required" });
        return;
      }

      // Set SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (data: Record<string, any>) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const { execSync } = await import("child_process");

      const MAIN_DIR = "/var/www/tamiyouz_crm";
      const DEMO_DIR = "/var/www/tamiyouz_crm_demo";
      const DEMO_DB = "tamiyouz_crm_demo";
      const MAIN_DB = "tamiyouz_crm";
      const DB_USER = "tamiyouz";
      const DB_PASS = "TamiyouzDB@2025";

      const steps = [
        { percent: 5, step: "Backing up demo .env & ecosystem config", stepAr: "نسخ احتياطي لملفات الإعدادات" },
        { percent: 15, step: "Syncing client code", stepAr: "مزامنة كود الواجهة" },
        { percent: 25, step: "Syncing server code", stepAr: "مزامنة كود الخادم" },
        { percent: 35, step: "Syncing shared code", stepAr: "مزامنة الكود المشترك" },
        { percent: 40, step: "Syncing drizzle schema", stepAr: "مزامنة مخطط قاعدة البيانات" },
        { percent: 45, step: "Syncing config files", stepAr: "مزامنة ملفات الإعدادات" },
        { percent: 50, step: "Restoring demo config", stepAr: "استعادة إعدادات الديمو" },
        { percent: 55, step: "Installing packages", stepAr: "تثبيت الحزم" },
        { percent: 70, step: "Syncing database schema (new tables only)", stepAr: "مزامنة مخطط قاعدة البيانات (جداول جديدة فقط)" },
        { percent: 85, step: "Building project", stepAr: "بناء المشروع" },
        { percent: 95, step: "Restarting demo server", stepAr: "إعادة تشغيل خادم الديمو" },
      ];

      const runCmd = (cmd: string, label: string, labelAr: string) => {
        try {
          const output = execSync(cmd, { cwd: DEMO_DIR, timeout: 300000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          if (output && output.trim()) {
            sendEvent({ type: "log", message: `[${label}] ${output.trim().slice(0, 500)}`, messageAr: `[${labelAr}] ${output.trim().slice(0, 500)}`, level: "info" });
          }
          return true;
        } catch (err: any) {
          const stderr = err.stderr?.toString().trim().slice(0, 500) || err.message;
          sendEvent({ type: "log", message: `[${label}] Warning: ${stderr}`, messageAr: `[${labelAr}] تحذير: ${stderr}`, level: "warning" });
          return false;
        }
      };

      // Step 1: Backup demo config
      sendEvent({ type: "progress", ...steps[0] });
      runCmd(`cp -f ${DEMO_DIR}/ecosystem.config.cjs /tmp/demo_ecosystem.config.cjs.bak 2>/dev/null || true`, "Backup", "نسخ احتياطي");
      runCmd(`cp -f ${DEMO_DIR}/drizzle.config.ts /tmp/demo_drizzle.config.ts.bak 2>/dev/null || true`, "Backup", "نسخ احتياطي");
      sendEvent({ type: "log", message: "Demo config backed up", messageAr: "تم النسخ الاحتياطي لإعدادات الديمو", level: "success" });

      // Step 2: Sync client
      sendEvent({ type: "progress", ...steps[1] });
      runCmd(`rsync -a --delete --exclude='node_modules' --exclude='.env' ${MAIN_DIR}/client/ ${DEMO_DIR}/client/`, "Client Sync", "مزامنة الواجهة");
      sendEvent({ type: "log", message: "Client code synced", messageAr: "تم مزامنة كود الواجهة", level: "success" });

      // Step 3: Sync server
      sendEvent({ type: "progress", ...steps[2] });
      runCmd(`rsync -a --delete --exclude='node_modules' --exclude='.env' --exclude='google-calendar-key.json' ${MAIN_DIR}/server/ ${DEMO_DIR}/server/`, "Server Sync", "مزامنة الخادم");
      sendEvent({ type: "log", message: "Server code synced", messageAr: "تم مزامنة كود الخادم", level: "success" });

      // Step 4: Sync shared
      sendEvent({ type: "progress", ...steps[3] });
      runCmd(`rsync -a --delete ${MAIN_DIR}/shared/ ${DEMO_DIR}/shared/`, "Shared Sync", "مزامنة المشترك");
      sendEvent({ type: "log", message: "Shared code synced", messageAr: "تم مزامنة الكود المشترك", level: "success" });

      // Step 5: Sync drizzle
      sendEvent({ type: "progress", ...steps[4] });
      runCmd(`rsync -a --delete ${MAIN_DIR}/drizzle/ ${DEMO_DIR}/drizzle/`, "Drizzle Sync", "مزامنة Drizzle");
      sendEvent({ type: "log", message: "Drizzle schema synced", messageAr: "تم مزامنة مخطط Drizzle", level: "success" });

      // Step 6: Sync config files (package.json, tsconfig, vite.config, etc.)
      sendEvent({ type: "progress", ...steps[5] });
      runCmd(`cp -f ${MAIN_DIR}/package.json ${DEMO_DIR}/package.json`, "Config", "الإعدادات");
      runCmd(`cp -f ${MAIN_DIR}/tsconfig.json ${DEMO_DIR}/tsconfig.json`, "Config", "الإعدادات");
      runCmd(`cp -f ${MAIN_DIR}/vite.config.ts ${DEMO_DIR}/vite.config.ts`, "Config", "الإعدادات");
      runCmd(`cp -f ${MAIN_DIR}/components.json ${DEMO_DIR}/components.json 2>/dev/null || true`, "Config", "الإعدادات");
      runCmd(`cp -rf ${MAIN_DIR}/patches ${DEMO_DIR}/patches 2>/dev/null || true`, "Config", "الإعدادات");
      sendEvent({ type: "log", message: "Config files synced", messageAr: "تم مزامنة ملفات الإعدادات", level: "success" });

      // Step 7: Restore demo-specific config
      sendEvent({ type: "progress", ...steps[6] });
      runCmd(`cp -f /tmp/demo_ecosystem.config.cjs.bak ${DEMO_DIR}/ecosystem.config.cjs 2>/dev/null || true`, "Restore", "استعادة");
      runCmd(`cp -f /tmp/demo_drizzle.config.ts.bak ${DEMO_DIR}/drizzle.config.ts 2>/dev/null || true`, "Restore", "استعادة");
      sendEvent({ type: "log", message: "Demo config restored", messageAr: "تم استعادة إعدادات الديمو", level: "success" });

      // Step 8: npm install
      sendEvent({ type: "progress", ...steps[7] });
      sendEvent({ type: "log", message: "Running npm install (this may take a while)...", messageAr: "جاري تثبيت الحزم (قد يستغرق بعض الوقت)...", level: "info" });
      const npmOk = runCmd(`cd ${DEMO_DIR} && npm install --legacy-peer-deps 2>&1 | tail -5`, "npm install", "تثبيت الحزم");
      if (npmOk) {
        sendEvent({ type: "log", message: "Packages installed successfully", messageAr: "تم تثبيت الحزم بنجاح", level: "success" });
      }

      // Step 9: DB schema sync (new tables only, no data)
      sendEvent({ type: "progress", ...steps[8] });
      try {
        // Get tables from both databases
        const mainTables = execSync(
          `mysql -u ${DB_USER} -p'${DB_PASS}' -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${MAIN_DB}' ORDER BY TABLE_NAME" 2>/dev/null`,
          { encoding: "utf-8" }
        ).trim().split("\n").filter(Boolean);

        const demoTables = execSync(
          `mysql -u ${DB_USER} -p'${DB_PASS}' -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DEMO_DB}' ORDER BY TABLE_NAME" 2>/dev/null`,
          { encoding: "utf-8" }
        ).trim().split("\n").filter(Boolean);

        const missingTables = mainTables.filter((t: string) => !demoTables.includes(t));

        if (missingTables.length > 0) {
          sendEvent({ type: "log", message: `Found ${missingTables.length} missing tables: ${missingTables.join(", ")}`, messageAr: `تم العثور على ${missingTables.length} جداول ناقصة: ${missingTables.join(", ")}`, level: "warning" });

          for (const table of missingTables) {
            try {
              const createStmt = execSync(
                `mysql -u ${DB_USER} -p'${DB_PASS}' ${MAIN_DB} -N -e "SHOW CREATE TABLE \\\`${table}\\\`" 2>/dev/null | cut -f2-`,
                { encoding: "utf-8" }
              ).trim();

              if (createStmt) {
                execSync(
                  `mysql -u ${DB_USER} -p'${DB_PASS}' ${DEMO_DB} -e "${createStmt.replace(/"/g, '\\"')}" 2>/dev/null`,
                  { encoding: "utf-8" }
                );
                sendEvent({ type: "log", message: `Created table: ${table}`, messageAr: `تم إنشاء جدول: ${table}`, level: "success" });
              }
            } catch (tableErr: any) {
              sendEvent({ type: "log", message: `Failed to create table ${table}: ${tableErr.message?.slice(0, 200)}`, messageAr: `فشل إنشاء جدول ${table}`, level: "warning" });
            }
          }
        } else {
          sendEvent({ type: "log", message: "All tables already exist in demo DB", messageAr: "جميع الجداول موجودة بالفعل في قاعدة بيانات الديمو", level: "success" });
        }

        // Also sync missing columns for existing tables
        sendEvent({ type: "log", message: "Checking for missing columns...", messageAr: "فحص الأعمدة الناقصة...", level: "info" });
        let columnsAdded = 0;
        for (const table of mainTables.filter((t: string) => demoTables.includes(t))) {
          try {
            const mainCols = execSync(
              `mysql -u ${DB_USER} -p'${DB_PASS}' -N -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${MAIN_DB}' AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION" 2>/dev/null`,
              { encoding: "utf-8" }
            ).trim().split("\n").filter(Boolean);

            const demoCols = execSync(
              `mysql -u ${DB_USER} -p'${DB_PASS}' -N -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DEMO_DB}' AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION" 2>/dev/null`,
              { encoding: "utf-8" }
            ).trim().split("\n").filter(Boolean);

            const missingCols = mainCols.filter((c: string) => !demoCols.includes(c));
            for (const col of missingCols) {
              try {
                const colDef = execSync(
                  `mysql -u ${DB_USER} -p'${DB_PASS}' -N -e "SELECT CONCAT(COLUMN_TYPE, IF(IS_NULLABLE='NO',' NOT NULL',''), IF(COLUMN_DEFAULT IS NOT NULL, CONCAT(' DEFAULT ', IF(DATA_TYPE IN ('varchar','text','char','enum','set'), CONCAT('\\'', COLUMN_DEFAULT, '\\''), COLUMN_DEFAULT)), '')) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${MAIN_DB}' AND TABLE_NAME='${table}' AND COLUMN_NAME='${col}'" 2>/dev/null`,
                  { encoding: "utf-8" }
                ).trim();

                if (colDef) {
                  execSync(
                    `mysql -u ${DB_USER} -p'${DB_PASS}' ${DEMO_DB} -e "ALTER TABLE \\\`${table}\\\` ADD COLUMN \\\`${col}\\\` ${colDef}" 2>/dev/null`,
                    { encoding: "utf-8" }
                  );
                  sendEvent({ type: "log", message: `Added column ${table}.${col}`, messageAr: `تم إضافة عمود ${table}.${col}`, level: "success" });
                  columnsAdded++;
                }
              } catch {
                // Column might already exist or have constraints
              }
            }
          } catch {
            // Skip tables with issues
          }
        }
        if (columnsAdded === 0) {
          sendEvent({ type: "log", message: "All columns are in sync", messageAr: "جميع الأعمدة متزامنة", level: "success" });
        } else {
          sendEvent({ type: "log", message: `Added ${columnsAdded} missing columns`, messageAr: `تم إضافة ${columnsAdded} أعمدة ناقصة`, level: "success" });
        }
      } catch (dbErr: any) {
        sendEvent({ type: "log", message: `DB sync warning: ${dbErr.message?.slice(0, 300)}`, messageAr: `تحذير مزامنة قاعدة البيانات: ${dbErr.message?.slice(0, 300)}`, level: "warning" });
      }

      // Step 10: Build
      sendEvent({ type: "progress", ...steps[9] });
      sendEvent({ type: "log", message: "Building project (this may take a few minutes)...", messageAr: "جاري بناء المشروع (قد يستغرق بضع دقائق)...", level: "info" });
      const buildOk = runCmd(`cd ${DEMO_DIR} && npm run build 2>&1 | tail -10`, "Build", "البناء");
      if (buildOk) {
        sendEvent({ type: "log", message: "Build completed successfully", messageAr: "تم البناء بنجاح", level: "success" });
      }

      // Step 11: Restart PM2
      sendEvent({ type: "progress", ...steps[10] });
      runCmd("pm2 restart tamiyouz-crm-demo", "PM2 Restart", "إعادة التشغيل");
      sendEvent({ type: "log", message: "Demo server restarted", messageAr: "تم إعادة تشغيل خادم الديمو", level: "success" });

      // Wait a moment for the server to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify demo is running
      try {
        const healthCheck = execSync("curl -s -o /dev/null -w '%{http_code}' http://localhost:3003/", { encoding: "utf-8" }).trim();
        if (healthCheck === "200") {
          sendEvent({ type: "log", message: "Demo server is healthy (HTTP 200)", messageAr: "خادم الديمو يعمل بشكل سليم (HTTP 200)", level: "success" });
        } else {
          sendEvent({ type: "log", message: `Demo server returned HTTP ${healthCheck}`, messageAr: `خادم الديمو أرجع HTTP ${healthCheck}`, level: "warning" });
        }
      } catch {
        sendEvent({ type: "log", message: "Could not verify demo health", messageAr: "لم يتمكن من التحقق من صحة الديمو", level: "warning" });
      }

      // Done!
      sendEvent({ type: "done" });
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message ?? "Sync failed" });
      } else {
        try {
          res.write(`data: ${JSON.stringify({ type: "error", message: err.message, messageAr: `خطأ: ${err.message}` })}\n\n`);
        } catch {}
        res.end();
      }
    }
  });

// ── Tamara Webhook ──────────────────────────────────────────────────────────
  app.post("/api/tamara/webhook", async (req, res) => {
    try {
      await verifyTamaraWebhookRequest({
        headers: req.headers as Record<string, string | string[] | undefined>,
        query: req.query as Record<string, unknown>,
      });
      const result = await handleTamaraWebhook(req.body);
      return res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error("[Tamara webhook] error:", error);
      return res.status(400).json({
        ok: false,
        message: error instanceof Error ? error.message : "Invalid Tamara webhook request.",
      });
    }
  });
// ── Paymob Webhook ──────────────────────────────────────────────────────────
  app.post("/api/paymob/webhook", async (req, res) => {
    try {
      const hmac = typeof req.query.hmac === "string" ? req.query.hmac : undefined;
      const result = await handlePaymobWebhook(req.body, hmac);
      return res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error("[Paymob webhook:POST] error:", error);
      return res.status(400).json({
        ok: false,
        message: error instanceof Error ? error.message : "Invalid Paymob webhook request.",
      });
    }
  });

  app.get("/api/paymob/webhook", async (req, res) => {
    try {
      const hmac = typeof req.query.hmac === "string" ? req.query.hmac : undefined;
      const result = await handlePaymobWebhook(req.query, hmac);
      const success = String(req.query.success || "false") === "true";
      const pending = String(req.query.pending || "false") === "true";
      return res.status(200).send(`
        <!doctype html>
        <html lang="en">
          <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Paymob Payment Status</title>
            <style>body{font-family:Arial,sans-serif;background:#0b1020;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{max-width:560px;width:calc(100% - 32px);background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;box-shadow:0 10px 40px rgba(0,0,0,.25)}.ok{color:#34d399}.warn{color:#fbbf24}.muted{color:#cbd5e1}</style>
          </head>
          <body>
            <div class="card">
              <h2 class="${success && !pending ? "ok" : "warn"}">${success && !pending ? "Payment processed successfully" : "Payment is pending or failed"}</h2>
              <p class="muted">You can close this page and return to the CRM.</p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("[Paymob webhook:GET] error:", error);
      return res.status(400).send(`
        <!doctype html>
        <html lang="en">
          <head><meta charset="utf-8" /><title>Paymob Payment Status</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;">
            <h2>Invalid Paymob callback</h2>
            <p>${error instanceof Error ? error.message : "Invalid callback request."}</p>
          </body>
        </html>
      `);
    }
  });

  const rakanDownloadsDir = path.join(process.cwd(), "downloads");
  await fs.mkdir(path.join(rakanDownloadsDir, "rakan"), { recursive: true });
  app.use("/downloads", express.static(rakanDownloadsDir));

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
  // Start Rakan advisory engine
  startRakanAdvisoryEngine();
  // Start exchange rate auto-sync scheduler
  startExchangeRateScheduler();
}).catch(console.error);
