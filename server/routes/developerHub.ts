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
const STORAGE_DIR = path.resolve(process.cwd(), "storage");
const STATE_FILE = path.join(STORAGE_DIR, "developer-hub.json");
const AI_CONTEXT_DIR = path.join(STORAGE_DIR, "ai-context");
const AI_CONTEXT_FILE = path.join(AI_CONTEXT_DIR, "tamiyouz-crm-context-latest.txt");

type DeveloperHubState = {
  webhookSecret: string;
  aiAccessToken: string;
  mcpEnabled: boolean;
  githubToken: string;
  githubRepo: string;
  latestContextFile: string | null;
  latestContextGeneratedAt: string | null;
  updatedAt: string;
};

type AuthenticatedRequest = Request & { rawBody?: Buffer };
type SseLevel = "info" | "success" | "error" | "warning";

let pushRunning = false;
let contextGenerationRunning = false;
let activeChild: ChildProcessWithoutNullStreams | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    githubToken: "",
    githubRepo: "",
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
      githubToken: parsed.githubToken || defaults.githubToken,
      githubRepo: parsed.githubRepo || defaults.githubRepo,
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
    const [{ stdout: branch }, { stdout: sha }, { stdout: lastCommit }, { stdout: dirty }, { stdout: ahead }] =
      await Promise.all([
        execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO_DIR }),
        execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO_DIR }),
        execFileAsync("git", ["log", "-1", "--pretty=%s"], { cwd: REPO_DIR }),
        execFileAsync("git", ["status", "--porcelain"], { cwd: REPO_DIR }),
        execFileAsync("git", ["rev-list", "--count", "origin/main..HEAD"], { cwd: REPO_DIR }).catch(() => ({ stdout: "0" })),
      ]);
    return {
      branch: branch.trim() || "main",
      shortSha: sha.trim() || "unknown",
      lastCommit: lastCommit.trim() || "No commit message",
      isDirty: dirty.trim().length > 0,
      unpushedCount: parseInt(ahead.trim(), 10) || 0,
    };
  } catch {
    return {
      branch: "unknown",
      shortSha: "unknown",
      lastCommit: "Unable to read git metadata",
      isDirty: false,
      unpushedCount: 0,
    };
  }
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
  env?: Record<string, string | undefined>;
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
      env: opts.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
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
      activeChild = null;
      reject(error);
    });
    child.on("close", (code) => {
      activeChild = null;
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
    ".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", ".md", ".css", ".sql", ".yaml", ".yml", ".sh",
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
    collected.push(`\n\n===== FILE: ${rel} =====\n${content}`);
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

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/developer-hub/status
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
    unpushedCount: git.unpushedCount,
    pushRunning,
    mcpEnabled: state.mcpEnabled,
    githubTokenSet: Boolean(state.githubToken),
    githubRepo: state.githubRepo,
    webhookSecret: state.webhookSecret,
    aiAccessUrl: `${baseUrl}/api/ai/context/latest?token=${state.aiAccessToken}`,
    aiAccessTokenMasked: `${state.aiAccessToken.slice(0, 6)}••••${state.aiAccessToken.slice(-4)}`,
    latestContextGeneratedAt: state.latestContextGeneratedAt,
  });
});

// POST /api/developer-hub/mcp
developerHubRouter.post("/developer-hub/mcp", async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;
  const enabled = Boolean(req.body?.enabled);
  const state = await saveState({ mcpEnabled: enabled });
  res.json({ ok: true, mcpEnabled: state.mcpEnabled });
});

// POST /api/developer-hub/github-token — Save GitHub token & repo
developerHubRouter.post("/developer-hub/github-token", async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  const { token, repo } = req.body || {};
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "GitHub token is required." });
    return;
  }

  // Extract repo from current remote if not provided
  let repoUrl = repo || "";
  if (!repoUrl) {
    try {
      const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: REPO_DIR });
      repoUrl = stdout.trim();
    } catch {
      repoUrl = "";
    }
  }

  // Update git remote URL with the new token
  try {
    // Parse the repo URL to get owner/repo
    let repoPath = "";
    const httpsMatch = repoUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    if (httpsMatch) {
      repoPath = httpsMatch[1].replace(/\.git$/, "");
    }

    if (repoPath) {
      const newRemoteUrl = `https://${token}@github.com/${repoPath}.git`;
      await execFileAsync("git", ["remote", "set-url", "origin", newRemoteUrl], { cwd: REPO_DIR });
    }
  } catch {
    // Non-fatal: remote URL update failed
  }

  const state = await saveState({ githubToken: token, githubRepo: repoUrl });
  res.json({
    ok: true,
    githubTokenSet: true,
    githubRepo: state.githubRepo,
  });
});

// POST /api/push-to-github — Push code from server to GitHub (SSE)
developerHubRouter.post("/push-to-github", async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  if (pushRunning) {
    res.status(409).json({ error: "Another push is already running." });
    return;
  }

  const state = await ensureState();
  if (!state.githubToken) {
    res.status(400).json({ error: "GitHub token not configured. Please set it first." });
    return;
  }

  pushRunning = true;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let clientClosed = false;
  req.on("close", () => {
    clientClosed = true;
    if (activeChild && !activeChild.killed) {
      activeChild.kill("SIGTERM");
    }
  });

  const commitMessage = req.body?.commitMessage || "";

  try {
    const git = await getGitSnapshot();

    sendSseEvent(res, {
      type: "log",
      level: "info",
      message: `Starting push for ${git.branch}@${git.shortSha}`,
      messageAr: `بدء الرفع للفرع ${git.branch}@${git.shortSha}`,
    });

    // Step 1: git add -A
    if (!clientClosed) {
      await streamCommand({
        command: "git",
        args: ["add", "-A"],
        cwd: REPO_DIR,
        step: "Stage changes",
        stepAr: "تجهيز التغييرات",
        percent: 20,
        res,
        isClosed: () => clientClosed,
      });
    }

    // Step 2: git commit (only if there are staged changes)
    if (!clientClosed) {
      const { stdout: statusOut } = await execFileAsync("git", ["status", "--porcelain"], { cwd: REPO_DIR });
      const { stdout: diffCached } = await execFileAsync("git", ["diff", "--cached", "--name-only"], { cwd: REPO_DIR });

      if (diffCached.trim().length > 0) {
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
        const changedFiles = diffCached.trim().split("\n").slice(0, 5).join(", ");
        const msg = commitMessage || `Push: ${timestamp} - ${changedFiles}`;

        await streamCommand({
          command: "git",
          args: ["commit", "-m", msg, "--no-verify"],
          cwd: REPO_DIR,
          step: "Commit changes",
          stepAr: "حفظ التغييرات (Commit)",
          percent: 50,
          res,
          isClosed: () => clientClosed,
        });
      } else if (statusOut.trim().length === 0) {
        // Check if there are unpushed commits
        const gitAfter = await getGitSnapshot();
        if (gitAfter.unpushedCount === 0) {
          sendSseEvent(res, {
            type: "log",
            level: "info",
            message: "No changes to commit and no unpushed commits.",
            messageAr: "لا توجد تغييرات للحفظ ولا commits غير مرفوعة.",
          });
          sendSseEvent(res, { type: "done", branch: gitAfter.branch, shortSha: gitAfter.shortSha });
          res.end();
          pushRunning = false;
          return;
        } else {
          sendSseEvent(res, {
            type: "log",
            level: "info",
            message: `No new changes, but ${gitAfter.unpushedCount} unpushed commits found. Pushing...`,
            messageAr: `لا توجد تغييرات جديدة، لكن يوجد ${gitAfter.unpushedCount} commit غير مرفوعة. جاري الرفع...`,
          });
          sendSseEvent(res, {
            type: "progress",
            step: "Commit changes",
            stepAr: "حفظ التغييرات (Commit)",
            percent: 50,
          });
        }
      }
    }

    // Step 3: git push
    if (!clientClosed) {
      await streamCommand({
        command: "git",
        args: ["push", "origin", "main"],
        cwd: REPO_DIR,
        step: "Push to GitHub",
        stepAr: "رفع الكود إلى GitHub",
        percent: 85,
        res,
        isClosed: () => clientClosed,
      });
    }

    if (!clientClosed) {
      const nextGit = await getGitSnapshot();
      sendSseEvent(res, {
        type: "done",
        branch: nextGit.branch,
        shortSha: nextGit.shortSha,
      });
      res.end();
    }
  } catch (error: any) {
    if (!clientClosed) {
      sendSseEvent(res, {
        type: "error",
        message: error?.message || "Push failed",
        messageAr: error?.message || "فشل الرفع",
      });
      res.end();
    }
  } finally {
    pushRunning = false;
    activeChild = null;
  }
});

// POST /api/ai/generate-context
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
        { cwd: REPO_DIR, maxBuffer: 1024 * 1024 * 20 }
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
    res.status(500).json({ error: error?.message || "Failed to generate AI context." });
  } finally {
    contextGenerationRunning = false;
  }
});

// GET /api/ai/context/latest
developerHubRouter.get("/ai/context/latest", async (req, res) => {
  try {
    const state = await ensureState();
    const token = String(req.query.token || "") || String(req.get("x-api-key") || "");
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
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(targetFile)}"`);
    res.sendFile(targetFile);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to download AI context." });
  }
});

export { developerHubRouter };
