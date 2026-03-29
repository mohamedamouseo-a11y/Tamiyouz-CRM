import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { promisify } from "util";
import path from "path";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import { authenticateRequest } from "../auth";

const execFileAsync = promisify(execFile);

const developerHubRouter = Router();

const REPO_DIR = process.env.DEV_HUB_REPO_DIR || "/var/www/tamiyouz_crm";
const DEPLOY_SCRIPT = process.env.DEV_HUB_DEPLOY_SCRIPT || "/var/www/tamiyouz_crm/git-auto-sync.sh";
const PM2_APP_NAME = process.env.DEV_HUB_PM2_APP || "tamiyouz-crm";
const STORAGE_DIR = path.resolve(process.cwd(), "storage");
const STATE_FILE = path.join(STORAGE_DIR, "developer-hub.json");
const AI_CONTEXT_DIR = path.join(STORAGE_DIR, "ai-context");
const AI_CONTEXT_FILE = path.join(AI_CONTEXT_DIR, "tamiyouz-crm-context-latest.txt");

type DeveloperHubState = {
  webhookSecret: string;
  aiAccessToken: string;
  mcpEnabled: boolean;
  latestContextFile: string | null;
  latestContextGeneratedAt: string | null;
  updatedAt: string;
};

type AuthenticatedRequest = Request & { rawBody?: Buffer };

type SseLevel = "info" | "success" | "error" | "warning";

let deploymentRunning = false;
let contextGenerationRunning = false;
let activeDeployChild: ChildProcessWithoutNullStreams | null = null;

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureState(): Promise<DeveloperHubState> {
  await ensureDir(STORAGE_DIR);
  await ensureDir(AI_CONTEXT_DIR);

  const defaults: DeveloperHubState = {
    webhookSecret:
      process.env.GITHUB_WEBHOOK_SECRET || crypto.randomBytes(32).toString("hex"),
    aiAccessToken:
      process.env.DEVELOPER_HUB_AI_TOKEN || crypto.randomBytes(24).toString("hex"),
    mcpEnabled: process.env.MCP_SERVER_ENABLED === "true",
    latestContextFile: existsSync(AI_CONTEXT_FILE) ? path.basename(AI_CONTEXT_FILE) : null,
    latestContextGeneratedAt: null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DeveloperHubState>;
    const merged: DeveloperHubState = {
      ...defaults,
      ...parsed,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || parsed.webhookSecret || defaults.webhookSecret,
      aiAccessToken: process.env.DEVELOPER_HUB_AI_TOKEN || parsed.aiAccessToken || defaults.aiAccessToken,
      mcpEnabled:
        typeof parsed.mcpEnabled === "boolean" ? parsed.mcpEnabled : defaults.mcpEnabled,
      latestContextFile: parsed.latestContextFile || defaults.latestContextFile,
      latestContextGeneratedAt:
        parsed.latestContextGeneratedAt || defaults.latestContextGeneratedAt,
      updatedAt: parsed.updatedAt || defaults.updatedAt,
    };

    await fs.writeFile(STATE_FILE, JSON.stringify(merged, null, 2), "utf8");
    return merged;
  } catch {
    await fs.writeFile(STATE_FILE, JSON.stringify(defaults, null, 2), "utf8");
    return defaults;
  }
}

async function saveState(partial: Partial<DeveloperHubState>) {
  const state = await ensureState();
  const nextState: DeveloperHubState = {
    ...state,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(STATE_FILE, JSON.stringify(nextState, null, 2), "utf8");
  return nextState;
}

async function requireSuperAdmin(req: Request, res: Response) {
  const user = await authenticateRequest(req as any).catch(() => null);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (user.email !== "admin@tamiyouz.com") {
    res.status(403).json({ error: "Super Admin access required" });
    return null;
  }
  return user;
}

function getBaseUrl(req: Request) {
  const protocol =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ||
    req.protocol ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0] ||
    req.get("host") ||
    "sales.tamiyouzplaform.com";
  return `${protocol}://${host}`;
}

function sendSseEvent(res: Response, payload: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function splitLines(input: string) {
  return input
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

async function getGitSnapshot() {
  try {
    const [{ stdout: branch }, { stdout: sha }, { stdout: lastCommit }, { stdout: dirty }] =
      await Promise.all([
        execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO_DIR }),
        execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO_DIR }),
        execFileAsync("git", ["log", "-1", "--pretty=%s"], { cwd: REPO_DIR }),
        execFileAsync("git", ["status", "--porcelain"], { cwd: REPO_DIR }),
      ]);

    return {
      branch: branch.trim() || "main",
      shortSha: sha.trim() || "unknown",
      lastCommit: lastCommit.trim() || "No commit message",
      isDirty: dirty.trim().length > 0,
    };
  } catch {
    return {
      branch: "unknown",
      shortSha: "unknown",
      lastCommit: "Unable to read git metadata",
      isDirty: false,
    };
  }
}

function addLog(res: Response, level: SseLevel, message: string, messageAr: string) {
  sendSseEvent(res, { type: "log", level, message, messageAr });
}

async function streamCommand(opts: {
  command: string;
  args: string[];
  cwd: string;
  step: string;
  stepAr: string;
  percent: number;
  res: Response;
  isClosed: () => boolean;
}) {
  sendSseEvent(opts.res, {
    type: "progress",
    step: opts.step,
    stepAr: opts.stepAr,
    percent: opts.percent,
  });

  return await new Promise<void>((resolve, reject) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    activeDeployChild = child;

    const writeChunk = (chunk: Buffer | string, level: SseLevel) => {
      if (opts.isClosed()) return;
      const lines = splitLines(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk);
      for (const line of lines) {
        sendSseEvent(opts.res, {
          type: "log",
          level,
          message: `[${opts.step}] ${line}`,
          messageAr: `[${opts.stepAr}] ${line}`,
        });
      }
    };

    child.stdout.on("data", (chunk) => writeChunk(chunk, "info"));
    child.stderr.on("data", (chunk) => writeChunk(chunk, "warning"));

    child.on("error", (error) => {
      activeDeployChild = null;
      reject(error);
    });

    child.on("close", (code) => {
      activeDeployChild = null;
      if (opts.isClosed()) {
        resolve();
        return;
      }
      if (code === 0) {
        sendSseEvent(opts.res, {
          type: "log",
          level: "success",
          message: `${opts.step} completed successfully`,
          messageAr: `اكتملت خطوة ${opts.stepAr} بنجاح`,
        });
        resolve();
      } else {
        reject(new Error(`${opts.command} exited with code ${code}`));
      }
    });
  });
}

async function generateFallbackContextFile(outputFile: string) {
  const includePaths = [
    path.join(REPO_DIR, "client"),
    path.join(REPO_DIR, "server"),
    path.join(REPO_DIR, "shared"),
    path.join(REPO_DIR, "drizzle"),
    path.join(REPO_DIR, "package.json"),
    path.join(REPO_DIR, "tsconfig.json"),
    path.join(REPO_DIR, "vite.config.ts"),
    path.join(REPO_DIR, "ecosystem.config.cjs"),
  ];

  const ignoreDirs = new Set([
    "node_modules",
    ".git",
    "dist",
    "uploads",
    "backups",
    "public",
    "client_backup_phase4",
    "server_backup_phase4",
  ]);

  const collected: string[] = [];
  const allowedExt = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".cjs",
    ".mjs",
    ".json",
    ".md",
    ".css",
    ".sql",
    ".yaml",
    ".yml",
    ".sh",
  ]);

  async function walk(target: string) {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      const dirName = path.basename(target);
      if (ignoreDirs.has(dirName)) return;
      const entries = await fs.readdir(target);
      for (const entry of entries) {
        await walk(path.join(target, entry));
      }
      return;
    }

    const ext = path.extname(target).toLowerCase();
    if (!allowedExt.has(ext)) return;

    const rel = path.relative(REPO_DIR, target);
    const content = await fs.readFile(target, "utf8");
    collected.push(
      `\n\n===== FILE: ${rel} =====\n${content}`
    );
  }

  for (const entry of includePaths) {
    if (existsSync(entry)) {
      await walk(entry);
    }
  }

  const packed = [
    "Tamiyouz CRM - AI Context",
    `Generated at: ${new Date().toISOString()}`,
    "",
    collected.join("\n"),
  ].join("\n");

  await fs.writeFile(outputFile, packed, "utf8");
}

async function triggerDetachedDeployScript(scriptPath: string) {
  const child = spawn("bash", [scriptPath], {
    cwd: REPO_DIR,
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

developerHubRouter.get("/developer-hub/status", async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  const state = await ensureState();
  const git = await getGitSnapshot();
  const baseUrl = getBaseUrl(req);

  res.json({
    repoPath: REPO_DIR,
    branch: git.branch,
    shortSha: git.shortSha,
    lastCommit: git.lastCommit,
    isDirty: git.isDirty,
    deployRunning: deploymentRunning,
    mcpEnabled: state.mcpEnabled,
    webhookUrl: `${baseUrl}/api/webhooks/github`,
    webhookSecret: state.webhookSecret,
    aiAccessUrl: `${baseUrl}/api/ai/context/latest?token=${state.aiAccessToken}`,
    aiAccessTokenMasked: `${state.aiAccessToken.slice(0, 6)}••••${state.aiAccessToken.slice(-4)}`,
    latestContextGeneratedAt: state.latestContextGeneratedAt,
  });
});

developerHubRouter.post("/developer-hub/mcp", async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  const enabled = Boolean(req.body?.enabled);
  const state = await saveState({ mcpEnabled: enabled });

  res.json({
    ok: true,
    mcpEnabled: state.mcpEnabled,
  });
});

developerHubRouter.post("/deploy-sync", async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  if (deploymentRunning) {
    res.status(409).json({ error: "Another deployment is already running." });
    return;
  }

  deploymentRunning = true;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let clientClosed = false;
  req.on("close", () => {
    clientClosed = true;
    if (activeDeployChild && !activeDeployChild.killed) {
      activeDeployChild.kill("SIGTERM");
    }
  });

  const steps = [
    {
      command: "git",
      args: ["pull", "--ff-only"],
      cwd: REPO_DIR,
      step: "Git pull",
      stepAr: "سحب آخر التحديثات من GitHub",
      percent: 20,
    },
    {
      command: "pnpm",
      args: ["install", "--frozen-lockfile"],
      cwd: REPO_DIR,
      step: "Install dependencies",
      stepAr: "تثبيت الاعتمادات",
      percent: 45,
    },
    {
      command: "pnpm",
      args: ["build"],
      cwd: REPO_DIR,
      step: "Build application",
      stepAr: "بناء التطبيق",
      percent: 72,
    },

  ];

  try {
    const git = await getGitSnapshot();

    sendSseEvent(res, {
      type: "log",
      level: "info",
      message: `Starting deployment for ${git.branch}@${git.shortSha}`,
      messageAr: `بدء النشر للفرع ${git.branch}@${git.shortSha}`,
    });

    for (const step of steps) {
      if (clientClosed) break;
      await streamCommand({
        ...step,
        res,
        isClosed: () => clientClosed,
      });
    }

    if (!clientClosed) {
      // Send progress for PM2 restart step
      sendSseEvent(res, {
        type: "progress",
        step: "Restart PM2 service",
        stepAr: "إعادة تشغيل خدمة PM2",
        percent: 95,
      });
      addLog(res, "info", "Preparing to restart PM2 service...", "جاري تجهيز إعادة تشغيل PM2...");

      const nextGit = await getGitSnapshot();
      sendSseEvent(res, {
        type: "done",
        branch: nextGit.branch,
        shortSha: nextGit.shortSha,
      });
      res.end();

      // Trigger PM2 restart AFTER the response is fully sent (detached)
      // This avoids killing the SSE connection mid-stream
      setTimeout(() => {
        const pmChild = spawn("pm2", ["restart", PM2_APP_NAME], {
          cwd: REPO_DIR,
          env: process.env,
          detached: true,
          stdio: "ignore",
        });
        pmChild.unref();
      }, 500);
    }
  } catch (error: any) {
    if (!clientClosed) {
      sendSseEvent(res, {
        type: "error",
        message: error?.message || "Deployment failed",
        messageAr: error?.message || "فشل النشر",
      });
      res.end();
    }
  } finally {
    deploymentRunning = false;
    activeDeployChild = null;
  }
});

developerHubRouter.post("/webhooks/github", async (req: AuthenticatedRequest, res) => {
  try {
    const state = await ensureState();
    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}), "utf8");

    const signatureHeader = req.get("x-hub-signature-256");
    if (!signatureHeader) {
      res.status(401).json({ error: "Missing GitHub signature header." });
      return;
    }

    const expectedSignature =
      "sha256=" +
      crypto.createHmac("sha256", state.webhookSecret).update(rawBody).digest("hex");

    const signatureBuffer = Buffer.from(signatureHeader, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      res.status(401).json({ error: "Invalid GitHub signature." });
      return;
    }

    const eventName = req.get("x-github-event") || "unknown";
    const payload = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString("utf8"))
      : req.body || {};

    if (eventName === "ping") {
      res.status(200).json({ ok: true, message: "GitHub webhook verified." });
      return;
    }

    if (eventName !== "push") {
      res.status(202).json({ ok: true, ignored: true, reason: `Ignored ${eventName} event.` });
      return;
    }

    if (payload?.ref && payload.ref !== "refs/heads/main") {
      res.status(202).json({ ok: true, ignored: true, reason: `Ignored branch ${payload.ref}.` });
      return;
    }

    await triggerDetachedDeployScript(DEPLOY_SCRIPT);

    res.status(202).json({
      ok: true,
      message: "Webhook accepted. Auto-deploy script started.",
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Webhook processing failed.",
    });
  }
});

developerHubRouter.post("/ai/generate-context", async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  if (contextGenerationRunning) {
    res.status(409).json({ error: "AI context generation is already running." });
    return;
  }

  contextGenerationRunning = true;

  try {
    await ensureDir(AI_CONTEXT_DIR);

    try {
      await execFileAsync(
        "npx",
        ["-y", "repomix", "-o", AI_CONTEXT_FILE, "--quiet"],
        {
          cwd: REPO_DIR,
          maxBuffer: 1024 * 1024 * 20,
        }
      );
    } catch {
      await generateFallbackContextFile(AI_CONTEXT_FILE);
    }

    const nextState = await saveState({
      latestContextFile: path.basename(AI_CONTEXT_FILE),
      latestContextGeneratedAt: new Date().toISOString(),
    });

    const baseUrl = getBaseUrl(req);

    res.json({
      ok: true,
      fileName: nextState.latestContextFile,
      generatedAt: nextState.latestContextGeneratedAt,
      apiUrl: `${baseUrl}/api/ai/context/latest?token=${nextState.aiAccessToken}`,
      downloadUrl: `${baseUrl}/api/ai/context/latest?token=${nextState.aiAccessToken}`,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Failed to generate AI context.",
    });
  } finally {
    contextGenerationRunning = false;
  }
});

developerHubRouter.get("/ai/context/latest", async (req, res) => {
  try {
    const state = await ensureState();
    const token =
      String(req.query.token || "") ||
      String(req.get("x-api-key") || "");

    if (!token || token !== state.aiAccessToken) {
      res.status(401).json({ error: "Invalid or missing AI access token." });
      return;
    }

    const targetFile = path.join(
      AI_CONTEXT_DIR,
      state.latestContextFile || path.basename(AI_CONTEXT_FILE)
    );

    if (!existsSync(targetFile)) {
      res.status(404).json({ error: "AI context file not found. Generate it first." });
      return;
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(targetFile)}"`
    );
    res.sendFile(targetFile);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to download AI context." });
  }
});

export { developerHubRouter };
