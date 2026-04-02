export interface SlackNotificationPayload {
  webhookUrl: string;
  channel?: string;
  mention?: string;
  title: string;
  blocks?: any[];
  text: string;
}

export async function sendSlackNotification(input: SlackNotificationPayload): Promise<{ success: boolean; error?: string }> {
  if (!input.webhookUrl) {
    return { success: false, error: "Missing Slack webhook URL" };
  }

  try {
    const body = {
      channel: input.channel || undefined,
      text: [input.mention, input.text].filter(Boolean).join(" "),
      blocks: input.blocks,
    };

    const response = await fetch(input.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: text || `Slack webhook failed with ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Unknown Slack error" };
  }
}
