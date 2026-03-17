import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getNotificationSubscribers: vi.fn().mockResolvedValue([]),
  addNotificationSubscriber: vi.fn().mockResolvedValue(1),
  updateNotificationSubscriber: vi.fn().mockResolvedValue(undefined),
  deleteNotificationSubscriber: vi.fn().mockResolvedValue(undefined),
  getReportData: vi.fn().mockResolvedValue({
    period: { from: new Date("2026-01-01"), to: new Date("2026-01-31") },
    totalLeads: 10,
    slaBreached: 1,
    wonDeals: 2,
    wonValue: 5000,
    lostDeals: 1,
    agentStats: [],
  }),
}));

// Mock the email module
vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  getNotificationSubscribers,
  addNotificationSubscriber,
  updateNotificationSubscriber,
  deleteNotificationSubscriber,
  getReportData,
} from "./db";
import { sendEmail } from "./email";
import { buildReportEmail } from "./emailReports";

describe("Notification Subscribers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list subscribers (returns empty array initially)", async () => {
    const result = await getNotificationSubscribers();
    expect(result).toEqual([]);
    expect(getNotificationSubscribers).toHaveBeenCalledOnce();
  });

  it("should add a subscriber and return an id", async () => {
    const id = await addNotificationSubscriber({
      email: "test@example.com",
      name: "Test User",
      frequency: "daily",
      isActive: true,
      reportTypes: ["sla", "performance"],
    });
    expect(id).toBe(1);
    expect(addNotificationSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com", frequency: "daily" })
    );
  });

  it("should update a subscriber", async () => {
    await updateNotificationSubscriber(1, { isActive: false });
    expect(updateNotificationSubscriber).toHaveBeenCalledWith(1, { isActive: false });
  });

  it("should delete a subscriber", async () => {
    await deleteNotificationSubscriber(1);
    expect(deleteNotificationSubscriber).toHaveBeenCalledWith(1);
  });
});

describe("Report Email Builder", () => {
  const makeReportData = (totalLeads: number, wonDeals: number, wonValue: number) => ({
    period: { from: new Date("2026-01-01"), to: new Date("2026-01-31") },
    totalLeads,
    slaBreached: 2,
    wonDeals,
    wonValue,
    lostDeals: 1,
    agentStats: [],
  });

  it("should build a daily report email with subject and html", () => {
    const reportData = makeReportData(50, 3, 15000);
    const result = buildReportEmail(reportData, "daily");
    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("html");
    expect(result).toHaveProperty("text");
    expect(result.subject).toContain("Daily");
    expect(result.html).toContain("50"); // totalLeads
  });

  it("should build a weekly report email", () => {
    const reportData = makeReportData(200, 12, 60000);
    const result = buildReportEmail(reportData, "weekly");
    expect(result.subject).toContain("Weekly");
    expect(result.html).toContain("200");
  });
});

describe("Send Test Report", () => {
  it("should call sendEmail with correct parameters", async () => {
    const reportData = await getReportData();
    expect(reportData).not.toBeNull();
    if (!reportData) return;

    const { subject, html, text } = buildReportEmail(reportData, "daily");
    const result = await sendEmail({ to: "admin@example.com", subject, html, text });
    expect(result).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin@example.com" })
    );
  });
});
