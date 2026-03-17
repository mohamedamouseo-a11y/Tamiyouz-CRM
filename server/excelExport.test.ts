import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";

// Mock the db module
vi.mock("./db", () => ({
  getLeadsForExport: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Ahmed Ali",
      phone: "+966501234567",
      country: "SA",
      businessProfile: "Retail",
      leadQuality: "Hot",
      stage: "New",
      campaignName: "Campaign A",
      ownerName: "Sales Agent",
      slaBreached: 0,
      createdAt: new Date("2026-01-15"),
      notes: "Test note",
    },
    {
      id: 2,
      name: "Fatima Hassan",
      phone: "+966509876543",
      country: "SA",
      businessProfile: "Services",
      leadQuality: "Warm",
      stage: "Contacted",
      campaignName: "Campaign B",
      ownerName: "Sales Agent 2",
      slaBreached: 1,
      createdAt: new Date("2026-01-20"),
      notes: null,
    },
  ]),
}));

import { getLeadsForExport } from "./db";
import { streamLeadsExcel } from "./excelExport";

describe("streamLeadsExcel", () => {
  let mockRes: Partial<Response>;
  const chunks: Buffer[] = [];

  beforeEach(() => {
    chunks.length = 0;
    mockRes = {
      setHeader: vi.fn(),
      write: vi.fn((chunk) => { chunks.push(chunk); return true; }),
      end: vi.fn(),
    } as any;
    vi.clearAllMocks();
  });

  it("should call getLeadsForExport with the provided options", async () => {
    await streamLeadsExcel(mockRes as Response, { limit: 50, stage: "New" });
    expect(getLeadsForExport).toHaveBeenCalledWith({ limit: 50, stage: "New" });
  });

  it("should set correct Content-Type header for xlsx", async () => {
    await streamLeadsExcel(mockRes as Response, {});
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("should set Content-Disposition header with .xlsx filename", async () => {
    await streamLeadsExcel(mockRes as Response, {});
    const calls = (mockRes.setHeader as any).mock.calls;
    const dispositionCall = calls.find((c: any[]) => c[0] === "Content-Disposition");
    expect(dispositionCall).toBeDefined();
    expect(dispositionCall[1]).toMatch(/\.xlsx/);
  });

  it("should call res.end() after writing", async () => {
    await streamLeadsExcel(mockRes as Response, {});
    expect(mockRes.end).toHaveBeenCalled();
  });

  it("should return the number of exported leads", async () => {
    const count = await streamLeadsExcel(mockRes as Response, { limit: 10 });
    expect(count).toBe(2); // mock returns 2 leads
  });

  it("should apply slaBreached filter when provided", async () => {
    await streamLeadsExcel(mockRes as Response, { slaBreached: true });
    expect(getLeadsForExport).toHaveBeenCalledWith(expect.objectContaining({ slaBreached: true }));
  });

  it("should apply quality filter when provided", async () => {
    await streamLeadsExcel(mockRes as Response, { leadQuality: "Hot" });
    expect(getLeadsForExport).toHaveBeenCalledWith(expect.objectContaining({ leadQuality: "Hot" }));
  });
});
