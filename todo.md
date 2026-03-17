# Tamiyouz CRM - Project TODO

## Phase 1: Database & Schema
- [x] Extend users table with role (Admin/SalesManager/SalesAgent/MediaBuyer), team_id
- [x] Create leads table (name, phone, country, business_profile, lead_quality, campaign_name, ad_creative, owner_id, stage, notes, sla_breached)
- [x] Create activities table (lead_id, user_id, type, activity_time, outcome, notes)
- [x] Create deals table (lead_id, value_sar, status, closed_at, deal_type, loss_reason)
- [x] Create campaigns table (name, platform, start_date, end_date, notes, round_robin_enabled)
- [x] Create pipeline_stages table (name, order, color)
- [x] Create custom_fields table (entity, field_name, field_type, options)
- [x] Create theme_settings table (key, value)
- [x] Run migrations
- [x] Seed default pipeline stages and SLA config

## Phase 2: Backend API
- [x] Auth procedures (me, logout, user management)
- [x] Leads CRUD with role-based filtering
- [x] Activities CRUD
- [x] Deals CRUD
- [x] Campaigns CRUD
- [x] Pipeline stages CRUD
- [x] Users management (admin only)
- [x] Round-robin assignment logic
- [x] Duplicate detection by phone (+966 normalization)
- [x] SLA alert calculation
- [x] Excel import with column mapping (leads.import procedure)
- [x] Dashboard stats (agent + team)
- [x] Theme settings CRUD

## Phase 3: Frontend Core
- [x] i18n system (Arabic/English with RTL/LTR switching)
- [x] Design tokens / theme system in CSS variables
- [x] CRMLayout with RTL-aware sidebar
- [x] Logo display in navbar
- [x] Role-based route guards
- [x] Login page (branded with Tamiyouz branding)

## Phase 4: Feature Pages
- [x] Agent Dashboard (My Leads, My Activities, My Deals)
- [x] Leads List with filters (stage, quality, campaign, date, search, SLA)
- [x] Lead Profile (details + timeline + deal)
- [x] Team Dashboard for SalesManager (charts + agent performance table)
- [x] Admin Settings (users/roles, pipeline stages, custom fields, theme, SLA)
- [x] Excel Import page with column mapping and auto-detection
- [x] Campaigns List page

## Phase 5: Automations & Polish
- [x] SLA alert badges in lead list and dashboard
- [x] Round-robin assignment UI toggle per campaign
- [x] Duplicate detection on phone input
- [x] Phone normalization to +966 format
- [x] Deal value display in SAR
- [x] RTL/LTR layout switching
- [x] Theme color/font customization from Settings

## Phase 6: Tests & Delivery
- [x] Vitest unit tests: phone normalization, auth logout, role-based access, lead quality, activity types, deal status (15 tests passing)
- [x] Final checkpoint and delivery

## Bug Fixes (from video recording)
- [x] Fix /settings route returning 404 on published site (added /settings alias route in App.tsx)
- [x] Add inline campaign creation dialog on Campaigns page (instead of redirect to /settings)
- [x] Verify all sidebar navigation routes are properly registered in App.tsx

## Custom Auth System
- [x] Replace Manus OAuth with custom email/password auth
- [x] Add password hashing with bcrypt
- [x] Add login/register tRPC procedures
- [x] Build branded login page with email/password form
- [x] Seed admin account: mohamedamou.seo@gmail.com
- [x] Update CRMLayout and useAuth to use custom auth

## Password Reset Flow
- [x] Add password_reset_tokens table to schema
- [x] Add sendPasswordReset and resetPassword tRPC procedures
- [x] Build Forgot Password page
- [x] Build Reset Password page (token-based)
- [x] Reset link shown on-screen in dev mode (no SMTP needed)

## Bug Fixes Round 2
- [x] Fix campaign date overflow — clamp dates to valid MySQL range (1970–2037) in frontend and backend

## Hostinger Deployment
- [x] Audit and remove all Manus-specific dependencies and code
- [x] Replace Manus auth core with standalone JWT session system
- [x] Create .env.example template with all required variables
- [x] Write Hostinger deployment guide (step-by-step)
- [x] Verify clean build with no Manus dependencies (15/15 tests pass, build succeeds)
- [x] Package and deliver deployment files

## Pipeline Stages Enhancements
- [x] Add isActive toggle (enable/disable stage without deleting)
- [x] Add reorder API (update orderIndex for all stages)
- [x] Build drag-and-drop reorder UI in Admin Settings → Pipeline tab
- [x] Show enable/disable toggle per stage instead of delete-only
- [x] Enforce SalesAgent can only change stage for their own assigned leads
- [x] Enforce SalesAgent cannot reassign leads to other agents

## Notifications & Reporting
- [x] Add notification_subscribers table (email, frequency: daily/weekly, isActive)
- [x] Build email report generator (SLA breaches, agent stats, deals summary)
- [x] Add cron-style scheduler to send reports automatically (daily 8AM, weekly Mon 8AM)
- [x] Admin UI: add/remove notification emails, set frequency (daily/weekly), send test report
- [x] Dashboard: free date-range picker for Agent Dashboard
- [x] Dashboard: free date-range picker for Team Dashboard
- [ ] Dashboard: date-range picker for Leads List (future enhancement)

## Google Sheets Export
- [x] Research Google Sheets API approach (Service Account vs OAuth vs API key)
- [x] Add Google Sheets API credentials to environment secrets (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY)
- [x] Backend: add sheets.exportLeads tRPC procedure (accepts count, filters, spreadsheetId)
- [x] Backend: create/write rows to Google Sheet via googleapis npm package
- [x] Admin UI: Export page with count input, filter options, and Google Sheet URL input
- [x] Show export result and link to the updated sheet after export
- [x] Write vitest tests for the export procedure (7 tests passing)

## Excel Export (replacing Google Sheets)
- [x] Remove Google Sheets page, route, and googleapis dependency
- [x] Add /api/export/leads endpoint that streams an .xlsx file
- [x] Use exceljs to build the workbook with headers and lead rows
- [x] Add Export button + dialog to Leads List page (count, filters)
- [x] Write vitest tests for the export helper (7 tests passing)

## Delete User
- [x] Add deleteUser tRPC procedure (admin only, cannot delete self)
- [x] Add Delete button with confirmation dialog to Users tab in AdminSettings
