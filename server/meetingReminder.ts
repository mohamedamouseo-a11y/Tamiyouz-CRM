/**
 * Meeting Reminder Scheduler
 * Checks for upcoming calendar events and creates in-app notifications
 * Uses configurable reminder times from meeting_notification_config table.
 */
import { listCalendarEvents } from "./googleCalendar";
import { getAllUsers, createBulkInAppNotifications, getMeetingNotificationConfig } from "./db";
import type { InsertInAppNotification } from "../drizzle/schema";

// Track which reminders have been sent to avoid duplicates
const sentReminders = new Map<string, number>(); // key -> repeat count sent

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, _] of sentReminders) {
    const ts = parseInt(key.split("_ts_").pop() || "0");
    if (now - ts > 2 * 60 * 60 * 1000) {
      sentReminders.delete(key);
    }
  }
}, 60 * 60 * 1000);

async function checkUpcomingMeetings() {
  try {
    // Get config from DB
    const config = await getMeetingNotificationConfig();
    const reminderMinutes = (config?.reminderMinutes as number[]) || [30, 10];
    const repeatCount = config?.repeatCount || 1;
    const soundEnabled = config?.soundEnabled ?? true;
    const popupEnabled = config?.popupEnabled ?? true;

    const maxMinutes = Math.max(...reminderMinutes) + 5;
    const now = new Date();
    const futureTime = new Date(now.getTime() + maxMinutes * 60 * 1000);

    // Get events starting in the configured window
    const events = await listCalendarEvents({
      timeMin: now.toISOString(),
      timeMax: futureTime.toISOString(),
      maxResults: 20,
    });

    if (!events || events.length === 0) return;

    // Get all users to match attendees
    const users = await getAllUsers();
    const usersByEmail = new Map(users.map((u) => [u.email?.toLowerCase(), u]));

    const notifications: InsertInAppNotification[] = [];

    for (const event of events) {
      const startTime = new Date(event.start);
      const minutesUntil = Math.round((startTime.getTime() - now.getTime()) / 60000);

      // Check each configured reminder time
      for (const reminderMin of reminderMinutes) {
        const tolerance = 3; // 3 minute tolerance window
        if (minutesUntil > reminderMin + tolerance || minutesUntil < Math.max(0, reminderMin - tolerance)) {
          continue;
        }

        const reminderKey = `${event.id}_${reminderMin}min_ts_${startTime.getTime()}`;
        const sentCount = sentReminders.get(reminderKey) || 0;

        if (sentCount >= repeatCount) continue;

        // Format time for display
        const timeStr = startTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Riyadh",
        });

        // Determine target users
        const targetUserIds = new Set<number>();
        if (event.attendees && event.attendees.length > 0) {
          for (const attendee of event.attendees) {
            const user = usersByEmail.get(attendee.email.toLowerCase());
            if (user) {
              targetUserIds.add(user.id);
            }
          }
        }
        // If no specific attendees matched, notify all active users
        if (targetUserIds.size === 0) {
          for (const user of users) {
            if (user.isActive) {
              targetUserIds.add(user.id);
            }
          }
        }

        for (const userId of targetUserIds) {
          notifications.push({
            userId,
            type: "meeting_reminder",
            title: `Meeting in ${reminderMin} min: ${event.summary}`,
            titleAr: `اجتماع بعد ${reminderMin} دقيقة: ${event.summary}`,
            body: `Your meeting "${event.summary}" starts at ${timeStr}${event.location ? ` at ${event.location}` : ""}`,
            bodyAr: `اجتماعك "${event.summary}" يبدأ الساعة ${timeStr}${event.location ? ` في ${event.location}` : ""}`,
            isRead: false,
            link: event.htmlLink || "/calendar",
            metadata: {
              eventId: event.id,
              startTime: event.start,
              reminderMinutes: reminderMin,
              soundEnabled,
              popupEnabled,
              repeatIndex: sentCount + 1,
              repeatTotal: repeatCount,
            },
          });
        }

        sentReminders.set(reminderKey, sentCount + 1);
      }
    }

    if (notifications.length > 0) {
      await createBulkInAppNotifications(notifications);
      console.log(`[MeetingReminder] Created ${notifications.length} reminder notifications`);
    }
  } catch (error) {
    console.error("[MeetingReminder] Error checking upcoming meetings:", error);
  }
}

export function startMeetingReminderScheduler() {
  console.log("[MeetingReminder] Starting meeting reminder scheduler (every 2 minutes)");
  // Check every 2 minutes for more responsive reminders
  setInterval(checkUpcomingMeetings, 2 * 60 * 1000);
  // Also run immediately
  setTimeout(checkUpcomingMeetings, 10000);
}
