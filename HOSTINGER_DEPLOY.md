# Tamiyouz CRM — Hostinger Deployment Guide

This guide walks you through deploying Tamiyouz CRM on **Hostinger Node.js Web Apps Hosting** (Business plan or higher).

---

## Prerequisites

- Hostinger account with **Node.js Web Apps** plan (Business $13.99/mo or Cloud Startup $27.99/mo)
- A GitHub account (to push the code)
- MySQL database created in Hostinger hPanel

---

## Step 1 — Export Code to GitHub

1. In the Manus Management UI, go to **Settings → GitHub**
2. Click **"Export to GitHub"** and create a new private repository (e.g. `tamiyouz-crm`)
3. Note the repository URL (e.g. `https://github.com/yourusername/tamiyouz-crm`)

---

## Step 2 — Create MySQL Database on Hostinger

1. Log in to **Hostinger hPanel**
2. Go to **Databases → MySQL Databases**
3. Create a new database:
   - Database name: `tamiyouz_crm`
   - Username: `tamiyouz_user`
   - Password: (choose a strong password)
4. Note the **host**, **port** (usually `3306`), **database name**, **username**, and **password**

---

## Step 3 — Create Node.js App on Hostinger

1. In hPanel, go to **Websites → Node.js**
2. Click **"Create Application"**
3. Set:
   - **Node.js version**: 22.x (or latest LTS)
   - **Application root**: `/` (root of your repo)
   - **Application URL**: your domain or subdomain
   - **Startup file**: `dist/index.js`
4. Connect your GitHub repository from Step 1

---

## Step 4 — Set Environment Variables

In the Hostinger Node.js app settings, add these environment variables:

```
DATABASE_URL=mysql://tamiyouz_user:YOUR_DB_PASSWORD@localhost:3306/tamiyouz_crm
JWT_SECRET=<generate a 64-char random string>
NODE_ENV=production
```

**To generate JWT_SECRET**, run this in any terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Optional — for password reset emails (Gmail):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16char_app_password
SMTP_FROM=Tamiyouz CRM <your_email@gmail.com>
```

---

## Step 5 — Set Build and Start Commands

In the Hostinger Node.js app settings:

- **Build command**: `npm install -g pnpm && pnpm install && pnpm build`
- **Start command**: `node dist/index.js`

---

## Step 6 — Run Database Migrations

After the first deploy, you need to create the database tables. Connect to your Hostinger MySQL via the **phpMyAdmin** tool in hPanel and run the SQL from the migration files located in `drizzle/` folder of your repository (files ending in `.sql`).

Run them **in order** (0001, 0002, 0003...).

---

## Step 7 — Create Your Admin Account

After the app is running, visit your domain and:

1. Go to `/login`
2. Use the seeded admin credentials:
   - **Email**: `mohamedamou.seo@gmail.com`
   - **Password**: `Tamiyouz@2025`
3. **Immediately change your password** in Settings → Profile

---

## Step 8 — Point Your Domain (Optional)

If you want to use `crm.tamiyouzalrowad.com`:

1. In Hostinger hPanel → Domains → DNS Zone Editor
2. Add a **CNAME** record pointing `crm` to your Hostinger app URL
3. Or use the **Subdomain** feature in hPanel to create `crm.tamiyouzalrowad.com`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check that `NODE_ENV=production` and `DATABASE_URL` are set correctly |
| Database connection error | Verify MySQL host — on Hostinger it's usually `localhost` or `127.0.0.1` |
| Login not working | Ensure `JWT_SECRET` is set and at least 32 characters |
| Build fails | Make sure Node.js version is 22.x and pnpm is installed in build command |
| Password reset link not sent | SMTP not configured — the reset link appears on screen instead |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | MySQL connection string |
| `JWT_SECRET` | **Yes** | Random secret for session signing (min 32 chars) |
| `NODE_ENV` | **Yes** | Set to `production` |
| `SMTP_HOST` | No | Email server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | No | Email port (587 for TLS) |
| `SMTP_USER` | No | Email username |
| `SMTP_PASS` | No | Email password or App Password |
| `SMTP_FROM` | No | Sender display name and email |

All other variables (`VITE_APP_ID`, `OAUTH_SERVER_URL`, etc.) are Manus-platform-only and can be left blank on Hostinger.

---

## Support

For issues with the CRM code, contact your developer.
For Hostinger hosting issues, visit [hostinger.com/support](https://www.hostinger.com/support).
