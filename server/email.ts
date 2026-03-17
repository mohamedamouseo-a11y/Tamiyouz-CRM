import nodemailer from "nodemailer";

// ─── Email Configuration ──────────────────────────────────────────────────────
// Uses SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars
// Falls back to Ethereal (test) if not configured
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT ?? "587");

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // Development fallback: log to console
  return null;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; previewUrl?: string; info?: string }> {
  const transporter = getTransporter();

  if (!transporter) {
    // No SMTP configured — log the email content for dev/testing
    console.log("\n========== EMAIL (No SMTP configured) ==========");
    console.log(`TO: ${opts.to}`);
    console.log(`SUBJECT: ${opts.subject}`);
    console.log(`BODY: ${opts.text ?? opts.html}`);
    console.log("=================================================\n");
    return { success: true, info: "Email logged to console (no SMTP configured)" };
  }

  try {
    const from = process.env.SMTP_FROM ?? `"Tamiyouz CRM" <${process.env.SMTP_USER}>`;
    const info = await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    console.log(`[Email] Sent to ${opts.to}: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return { success: false, info: String(error) };
  }
}

export function buildPasswordResetEmail(opts: {
  name: string;
  resetUrl: string;
  lang?: "ar" | "en";
}): { subject: string; html: string; text: string } {
  const isAr = opts.lang === "ar";

  const subject = isAr
    ? "إعادة تعيين كلمة المرور - Tamiyouz CRM"
    : "Reset Your Password - Tamiyouz CRM";

  const html = `
<!DOCTYPE html>
<html dir="${isAr ? "rtl" : "ltr"}" lang="${isAr ? "ar" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: 'Cairo', Arial, sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a3a5c 0%, #0f2444 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 40px; }
    .body h2 { color: #1a3a5c; font-size: 20px; margin: 0 0 16px; }
    .body p { color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 20px; }
    .btn { display: inline-block; background: #1a3a5c; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .note { background: #f8f9fa; border-radius: 8px; padding: 16px; font-size: 13px; color: #888; }
    .footer { text-align: center; padding: 24px 40px; font-size: 12px; color: #aaa; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tamiyouz CRM</h1>
      <p>${isAr ? "نظام إدارة علاقات العملاء" : "Customer Relationship Management"}</p>
    </div>
    <div class="body">
      <h2>${isAr ? `مرحباً ${opts.name}،` : `Hello ${opts.name},`}</h2>
      <p>${isAr
        ? "تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في Tamiyouz CRM. انقر على الزر أدناه لإعادة تعيين كلمة المرور."
        : "We received a request to reset the password for your Tamiyouz CRM account. Click the button below to set a new password."
      }</p>
      <div class="btn-wrap">
        <a href="${opts.resetUrl}" class="btn">
          ${isAr ? "إعادة تعيين كلمة المرور" : "Reset Password"}
        </a>
      </div>
      <div class="note">
        <p style="margin:0">
          ${isAr
            ? "⏱ هذا الرابط صالح لمدة <strong>ساعة واحدة</strong> فقط. إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان."
            : "⏱ This link is valid for <strong>1 hour</strong> only. If you didn't request a password reset, you can safely ignore this email."
          }
        </p>
      </div>
    </div>
    <div class="footer">
      © 2025 Tamiyouz Alrowad. ${isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}
    </div>
  </div>
</body>
</html>`;

  const text = isAr
    ? `مرحباً ${opts.name}،\n\nانقر على الرابط التالي لإعادة تعيين كلمة المرور:\n${opts.resetUrl}\n\nهذا الرابط صالح لمدة ساعة واحدة فقط.`
    : `Hello ${opts.name},\n\nClick the link below to reset your password:\n${opts.resetUrl}\n\nThis link is valid for 1 hour only.`;

  return { subject, html, text };
}
