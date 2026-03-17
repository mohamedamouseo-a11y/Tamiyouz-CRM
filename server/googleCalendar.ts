/**
 * Google Calendar Integration Service
 * Uses a Service Account to manage calendar events for Tamiyouz CRM.
 * Calendar ID: veo3.tamiyouz@gmail.com
 * Service Account: tamiyouz-crm-calendar@ai-telesales.iam.gserviceaccount.com
 */
import { google } from "googleapis";
import path from "path";
import fs from "fs";

// ─── Configuration ───────────────────────────────────────────────────────────
const CALENDAR_ID = "veo3.tamiyouz@gmail.com";
const KEY_FILE_PATH = path.join(import.meta.dirname, "google-calendar-key.json");

// ─── Auth ────────────────────────────────────────────────────────────────────
let _calendarClient: ReturnType<typeof google.calendar> | null = null;

async function getCalendarClient() {
  if (_calendarClient) return _calendarClient;

  if (!fs.existsSync(KEY_FILE_PATH)) {
    throw new Error(`Google Calendar key file not found at ${KEY_FILE_PATH}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  _calendarClient = google.calendar({ version: "v3", auth });
  return _calendarClient;
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  attendees?: string[];  // email addresses
  leadId?: number;
  leadName?: string;
  agentName?: string;
}

export interface CalendarEventResult {
  id: string;
  htmlLink: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  status: string;
  attendees?: { email: string; responseStatus?: string }[];
}

// ─── Create Event ────────────────────────────────────────────────────────────
export async function createCalendarEvent(event: CalendarEvent): Promise<CalendarEventResult> {
  const calendar = await getCalendarClient();

  const description = [
    event.description || "",
    "",
    "─── CRM Details ───",
    event.leadId ? `Lead ID: ${event.leadId}` : "",
    event.leadName ? `Lead Name: ${event.leadName}` : "",
    event.agentName ? `Agent: ${event.agentName}` : "",
    `Created from Tamiyouz CRM`,
  ].filter(Boolean).join("\n");

  const eventBody: any = {
    summary: event.summary,
    description,
    location: event.location || undefined,
    start: {
      dateTime: event.startDateTime,
      timeZone: "Asia/Riyadh",
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: "Asia/Riyadh",
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "popup", minutes: 10 },
      ],
    },
  };

  // Service account on Gmail cannot add attendees (causes 403 error)
  // Instead, include attendee emails in the event description
  if (event.attendees && event.attendees.length > 0) {
    const attendeeList = event.attendees.join(", ");
    eventBody.description = (eventBody.description || "") + "\n\nAttendees: " + attendeeList;
  }

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: eventBody,
  });

  const data = response.data;
  return {
    id: data.id!,
    htmlLink: data.htmlLink!,
    summary: data.summary || "",
    description: data.description || undefined,
    location: data.location || undefined,
    start: data.start?.dateTime || data.start?.date || "",
    end: data.end?.dateTime || data.end?.date || "",
    status: data.status || "confirmed",
    attendees: data.attendees?.map((a) => ({
      email: a.email!,
      responseStatus: a.responseStatus || undefined,
    })),
  };
}

// ─── Update Event ────────────────────────────────────────────────────────────
export async function updateCalendarEvent(
  eventId: string,
  event: Partial<CalendarEvent>
): Promise<CalendarEventResult> {
  const calendar = await getCalendarClient();

  const updateBody: any = {};

  if (event.summary) updateBody.summary = event.summary;
  if (event.description !== undefined) updateBody.description = event.description;
  if (event.location !== undefined) updateBody.location = event.location;
  if (event.startDateTime) {
    updateBody.start = { dateTime: event.startDateTime, timeZone: "Asia/Riyadh" };
  }
  if (event.endDateTime) {
    updateBody.end = { dateTime: event.endDateTime, timeZone: "Asia/Riyadh" };
  }
  // Don't set attendees on update (service account limitation on Gmail)
  // Attendees info is included in description instead

  const response = await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: updateBody,
  });

  const data = response.data;
  return {
    id: data.id!,
    htmlLink: data.htmlLink!,
    summary: data.summary || "",
    description: data.description || undefined,
    location: data.location || undefined,
    start: data.start?.dateTime || data.start?.date || "",
    end: data.end?.dateTime || data.end?.date || "",
    status: data.status || "confirmed",
    attendees: data.attendees?.map((a) => ({
      email: a.email!,
      responseStatus: a.responseStatus || undefined,
    })),
  };
}

// ─── Delete Event ────────────────────────────────────────────────────────────
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = await getCalendarClient();
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
    sendUpdates: "all",
  });
}

// ─── Get Event ───────────────────────────────────────────────────────────────
export async function getCalendarEvent(eventId: string): Promise<CalendarEventResult | null> {
  const calendar = await getCalendarClient();
  try {
    const response = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });
    const data = response.data;
    return {
      id: data.id!,
      htmlLink: data.htmlLink!,
      summary: data.summary || "",
      description: data.description || undefined,
      location: data.location || undefined,
      start: data.start?.dateTime || data.start?.date || "",
      end: data.end?.dateTime || data.end?.date || "",
      status: data.status || "confirmed",
      attendees: data.attendees?.map((a) => ({
        email: a.email!,
        responseStatus: a.responseStatus || undefined,
      })),
    };
  } catch (err: any) {
    if (err.code === 404) return null;
    throw err;
  }
}

// ─── List Events ─────────────────────────────────────────────────────────────
export async function listCalendarEvents(options?: {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  search?: string;
}): Promise<CalendarEventResult[]> {
  const calendar = await getCalendarClient();

  const params: any = {
    calendarId: CALENDAR_ID,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: options?.maxResults || 50,
  };

  if (options?.timeMin) params.timeMin = options.timeMin;
  if (options?.timeMax) params.timeMax = options.timeMax;
  if (options?.search) params.q = options.search;

  const response = await calendar.events.list(params);

  return (response.data.items || []).map((data) => ({
    id: data.id!,
    htmlLink: data.htmlLink!,
    summary: data.summary || "",
    description: data.description || undefined,
    location: data.location || undefined,
    start: data.start?.dateTime || data.start?.date || "",
    end: data.end?.dateTime || data.end?.date || "",
    status: data.status || "confirmed",
    attendees: data.attendees?.map((a) => ({
      email: a.email!,
      responseStatus: a.responseStatus || undefined,
    })),
  }));
}

// ─── Get Free/Busy ───────────────────────────────────────────────────────────
export async function getFreeBusy(
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  const calendar = await getCalendarClient();

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: "Asia/Riyadh",
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busy = response.data.calendars?.[CALENDAR_ID]?.busy || [];
  return busy.map((b) => ({
    start: b.start || "",
    end: b.end || "",
  }));
}
