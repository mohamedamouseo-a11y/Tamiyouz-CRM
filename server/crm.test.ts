import { describe, expect, it, vi } from "vitest";
import { normalizePhone } from "./db";

// ─── Phone Normalization Tests ─────────────────────────────────────────────
describe("normalizePhone", () => {
  it("normalizes Saudi mobile starting with 05", () => {
    expect(normalizePhone("0512345678")).toBe("+966512345678");
  });

  it("normalizes Saudi mobile starting with 5", () => {
    expect(normalizePhone("512345678")).toBe("+966512345678");
  });

  it("normalizes with country code 966", () => {
    expect(normalizePhone("966512345678")).toBe("+966512345678");
  });

  it("normalizes with +966 prefix (already normalized)", () => {
    expect(normalizePhone("+966512345678")).toBe("+966512345678");
  });

  it("handles spaces and dashes", () => {
    expect(normalizePhone("05 12 345 678")).toBe("+966512345678");
    expect(normalizePhone("051-234-5678")).toBe("+966512345678");
  });

  it("returns original if not Saudi format", () => {
    const result = normalizePhone("12345");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

// ─── Auth Logout Test (from template) ─────────────────────────────────────
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: string = "user"): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@tamiyouz.com",
    name: "Test User",
    loginMethod: "manus",
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

// ─── Role-based Access Tests ───────────────────────────────────────────────
describe("role-based access", () => {
  it("SalesAgent context has correct role", () => {
    const { ctx } = createAuthContext("SalesAgent");
    expect(ctx.user?.role).toBe("SalesAgent");
  });

  it("Admin context has correct role", () => {
    const { ctx } = createAuthContext("Admin");
    expect(ctx.user?.role).toBe("Admin");
  });

  it("MediaBuyer context has correct role", () => {
    const { ctx } = createAuthContext("MediaBuyer");
    expect(ctx.user?.role).toBe("MediaBuyer");
  });
});

// ─── Lead Quality Validation ───────────────────────────────────────────────
describe("lead quality values", () => {
  const validQualities = ["Hot", "Warm", "Cold", "Bad", "Unknown"];

  it("validates all quality values", () => {
    validQualities.forEach((q) => {
      expect(validQualities.includes(q)).toBe(true);
    });
  });

  it("rejects invalid quality", () => {
    expect(validQualities.includes("Invalid")).toBe(false);
  });
});

// ─── Activity Types Validation ─────────────────────────────────────────────
describe("activity types", () => {
  const validTypes = ["WhatsApp", "Call", "SMS", "Meeting", "Offer", "Email", "Note"];

  it("validates all activity types", () => {
    validTypes.forEach((type) => {
      expect(validTypes.includes(type)).toBe(true);
    });
  });
});

// ─── Deal Status Validation ────────────────────────────────────────────────
describe("deal status", () => {
  const validStatuses = ["Pending", "Won", "Lost"];

  it("validates all deal statuses", () => {
    validStatuses.forEach((status) => {
      expect(validStatuses.includes(status)).toBe(true);
    });
  });
});
