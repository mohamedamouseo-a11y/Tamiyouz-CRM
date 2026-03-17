import { mysqlTable, mysqlSchema, AnyMySqlColumn, primaryKey, int, mysqlEnum, timestamp, text, varchar, json, decimal, index, datetime, unique, tinyint, boolean } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const activities = mysqlTable("activities", {
	id: int().autoincrement().notNull(),
	leadId: int().notNull(),
	userId: int().notNull(),
	type: mysqlEnum(['WhatsApp','Call','SMS','Meeting','Offer','Email','Note']).notNull(),
	activityTime: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	outcome: mysqlEnum(['Contacted','NoAnswer','Interested','NotInterested','Meeting','Offer','Won','Lost','Callback']).default('Contacted'),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "activities_id"}),
]);

export const auditLogs = mysqlTable("audit_logs", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	userName: varchar({ length: 255 }),
	userRole: varchar({ length: 64 }),
	action: varchar({ length: 64 }).notNull(),
	entityType: varchar({ length: 64 }).notNull(),
	entityId: int().notNull(),
	entityName: varchar({ length: 255 }),
	details: json(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "audit_logs_id"}),
]);

export const backupLogs = mysqlTable("backup_logs", {
	id: int().autoincrement().notNull(),
	triggeredBy: int().notNull(),
	startDate: timestamp({ mode: 'string' }).notNull(),
	endDate: timestamp({ mode: 'string' }).notNull(),
	format: mysqlEnum(['json','csv','both']).notNull(),
	fileName: varchar({ length: 255 }).notNull(),
	fileSize: decimal({ precision: 15, scale: 0 }),
	driveFileId: varchar({ length: 255 }),
	cleanupEnabled: tinyint().default(0).notNull(),
	cleanupStatus: mysqlEnum(['pending','completed','failed']).default('pending'),
	status: mysqlEnum(['success','partial','error']).notNull(),
	recordCount: json(),
	recordsSkipped: json(),
	errorLog: text(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "backup_logs_id"}),
]);

export const campaigns = mysqlTable("campaigns", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	platform: mysqlEnum(['Messages','LeadForm','Meta','Google','Snapchat','TikTok','Other']).default('Meta').notNull(),
	startDate: timestamp({ mode: 'string' }),
	endDate: timestamp({ mode: 'string' }),
	notes: text(),
	roundRobinEnabled: tinyint().default(0).notNull(),
	roundRobinIndex: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	isActive: tinyint().default(1).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "campaigns_id"}),
]);

export const chatMessages = mysqlTable("chat_messages", {
	id: int().autoincrement().notNull(),
	fromUserId: int().notNull(),
	toUserId: int(),
	roomId: varchar({ length: 255 }),
	content: text().notNull(),
	isRead: tinyint().default(0),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "chat_messages_id"}),
]);

export const clients = mysqlTable("clients", {
	id: int().autoincrement().notNull(),
	leadId: int().notNull(),
	dealId: int(),
	businessProfile: text(),
	group: varchar({ length: 255 }),
	planStatus: mysqlEnum(['Active','Paused','Cancelled','Pending']).default('Active').notNull(),
	renewalStatus: mysqlEnum(['Renewed','Pending','Expired','Cancelled']).default('Pending').notNull(),
	accountManagerId: int(),
	competentPerson: varchar({ length: 255 }),
	contactEmail: varchar({ length: 320 }),
	contactPhone: varchar({ length: 50 }),
	marketingObjective: text(),
	servicesNeeded: text(),
	socialMedia: text(),
	feedback: text(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	lastFollowUpDate: timestamp({ mode: 'string' }),
	nextFollowUpDate: timestamp({ mode: 'string' }),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "clients_id"}),
]);

export const contracts = mysqlTable("contracts", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	packageId: int(),
	contractName: varchar({ length: 255 }),
	contractFile: text(),
	startDate: timestamp({ mode: 'string' }),
	endDate: timestamp({ mode: 'string' }),
	period: varchar({ length: 100 }),
	charges: decimal({ precision: 12, scale: 2 }),
	currency: varchar({ length: 10 }).default('SAR'),
	monthlyCharges: decimal({ precision: 12, scale: 2 }),
	status: mysqlEnum(['Active','Expired','Cancelled','PendingRenewal']).default('Active').notNull(),
	contractRenewalStatus: mysqlEnum(['New','Negotiation','SentOffer','Won','Lost','Renewed','NotRenewed']).default('New'),
	priceOffer: text(),
	upselling: text(),
	renewalAssignedTo: int(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "contracts_id"}),
]);

export const customFields = mysqlTable("custom_fields", {
	id: int().autoincrement().notNull(),
	entity: mysqlEnum(['Lead','Deal','Activity','Campaign']).notNull(),
	fieldName: varchar({ length: 100 }).notNull(),
	fieldLabel: varchar({ length: 100 }),
	fieldLabelAr: varchar({ length: 100 }),
	fieldType: mysqlEnum(['text','number','date','select','boolean']).notNull(),
	isRequired: tinyint().default(0).notNull(),
	order: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	options: json(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "custom_fields_id"}),
]);

export const deals = mysqlTable("deals", {
	id: int().autoincrement().notNull(),
	leadId: int().notNull(),
	valueSar: decimal({ precision: 12, scale: 2 }),
	status: mysqlEnum(['Won','Lost','Pending']).default('Pending').notNull(),
	closedAt: timestamp({ mode: 'string' }),
	dealType: mysqlEnum(['New','Contract','Renewal','Upsell']).default('New'),
	lossReason: text(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "deals_id"}),
]);

export const inAppNotifications = mysqlTable("in_app_notifications", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	type: mysqlEnum(['meeting_reminder','lead_assigned','sla_breach','lead_transfer','mention','system','stage_change','deal_won','deal_lost','activity_logged','lead_quality_change','duplicate_lead','bulk_import']).default('system').notNull(),
	title: varchar({ length: 500 }).notNull(),
	titleAr: varchar({ length: 500 }),
	body: text(),
	bodyAr: text(),
	isRead: tinyint().default(0).notNull(),
	link: varchar({ length: 500 }),
	metadata: json(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "in_app_notifications_id"}),
]);

export const internalNotes = mysqlTable("internal_notes", {
	id: int().autoincrement().notNull(),
	leadId: int().notNull(),
	userId: int().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "internal_notes_id"}),
]);

export const leadSourceSyncLog = mysqlTable("lead_source_sync_log", {
	id: int().autoincrement().notNull(),
	sourceId: int().notNull(),
	status: mysqlEnum(['success','error','partial']).notNull(),
	rowsProcessed: int().default(0),
	rowsImported: int().default(0),
	rowsSkipped: int().default(0),
	rowsError: int().default(0),
	errorMessage: text(),
	details: json(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "lead_source_sync_log_id"}),
]);

export const leadSources = mysqlTable("lead_sources", {
	id: int().autoincrement().notNull(),
	sourceName: varchar({ length: 255 }).notNull(),
	status: mysqlEnum(['Connected','PermissionMissing','MappingError','Disabled']).default('Disabled').notNull(),
	isEnabled: tinyint().default(0).notNull(),
	sheetUrl: text(),
	spreadsheetId: varchar({ length: 255 }),
	worksheetMode: mysqlEnum(['pick','all']).default('pick').notNull(),
	worksheetName: varchar({ length: 255 }),
	syncFrequencyMinutes: int().default(5).notNull(),
	uniqueKeyPriority: mysqlEnum(['meta_lead_id','phone']).default('meta_lead_id').notNull(),
	assignmentRule: mysqlEnum(['round_robin','fixed_owner','by_campaign']).default('round_robin').notNull(),
	fixedOwnerId: int(),
	fieldMapping: json(),
	lastSyncTime: timestamp({ mode: 'string' }),
	lastSyncResult: text(),
	lastSyncRowCount: int().default(0),
	lastSyncCursor: varchar({ length: 255 }),
	isDeleted: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "lead_sources_id"}),
]);

export const leadTransfers = mysqlTable("lead_transfers", {
	id: int().autoincrement().notNull(),
	leadId: int().notNull(),
	fromUserId: int().notNull(),
	toUserId: int().notNull(),
	reason: text(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "lead_transfers_id"}),
]);

export const leads = mysqlTable("leads", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }),
	phone: varchar({ length: 50 }).notNull(),
	country: varchar({ length: 100 }).default('Saudi Arabia'),
	businessProfile: text(),
	leadQuality: mysqlEnum(['Hot','Warm','Cold','Bad','Unknown']).default('Unknown').notNull(),
	campaignName: varchar({ length: 255 }),
	adCreative: varchar({ length: 255 }),
	ownerId: int(),
	stage: varchar({ length: 100 }).default('New').notNull(),
	notes: text(),
	mediaBuyerNotes: text(),
	serviceIntroduced: text(),
	leadTime: timestamp({ mode: 'string' }),
	contactTime: timestamp({ mode: 'string' }),
	priceOfferSent: tinyint().default(0).notNull(),
	priceOfferLink: text(),
	priceOfferTime: timestamp({ mode: 'string' }),
	slaBreached: tinyint().default(0).notNull(),
	slaAlertedAt: timestamp({ mode: 'string' }),
	isDuplicate: tinyint().default(0).notNull(),
	duplicateOfId: int(),
	externalId: varchar({ length: 255 }),
	sourceId: int(),
	sourceMetadata: json(),
	customFieldsData: json(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	contactDate: datetime("contact_date", { mode: 'string'}),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	index("idx_leads_externalId").on(table.externalId),
	index("idx_leads_sourceId").on(table.sourceId),
	index("idx_leads_ownerId").on(table.ownerId),
	index("idx_leads_phone").on(table.phone),
	index("idx_leads_deletedAt").on(table.deletedAt),
	primaryKey({ columns: [table.id], name: "leads_id"}),
]);

export const notificationSubscribers = mysqlTable("notification_subscribers", {
	id: int().autoincrement().notNull(),
	email: varchar({ length: 320 }).notNull(),
	name: varchar({ length: 255 }),
	frequency: mysqlEnum(['daily','weekly']).default('daily').notNull(),
	dayOfWeek: int().default(1),
	hourOfDay: int().default(8),
	isActive: tinyint().default(1).notNull(),
	reportTypes: json().default(["sla","performance","deals"]),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "notification_subscribers_id"}),
	unique("notification_subscribers_email_unique").on(table.email),
]);

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	token: varchar({ length: 128 }).notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	usedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "password_reset_tokens_id"}),
	unique("password_reset_tokens_token_unique").on(table.token),
]);

export const pipelineStages = mysqlTable("pipeline_stages", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 100 }).notNull(),
	nameAr: varchar({ length: 100 }),
	color: varchar({ length: 20 }).default('#6366f1').notNull(),
	order: int().default(0).notNull(),
	isDefault: tinyint().default(0).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "pipeline_stages_id"}),
]);

export const servicePackages = mysqlTable("service_packages", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	price: decimal({ precision: 12, scale: 2 }),
	period: varchar({ length: 100 }),
	services: json(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "service_packages_id"}),
]);

export const slaConfig = mysqlTable("sla_config", {
	id: int().autoincrement().notNull(),
	hoursThreshold: int().default(24).notNull(),
	isEnabled: tinyint().default(1).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sla_config_id"}),
]);

export const themeSettings = mysqlTable("theme_settings", {
	id: int().autoincrement().notNull(),
	key: varchar({ length: 100 }).notNull(),
	value: text().notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "theme_settings_id"}),
	unique("theme_settings_key_unique").on(table.key),
]);

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['Admin','SalesManager','SalesAgent','MediaBuyer','AccountManager','AccountManagerLead']).default('SalesAgent').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	passwordHash: varchar({ length: 255 }),
	isActive: tinyint().default(1).notNull(),
	teamId: int(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
},
(table) => [
	index("idx_users_deletedAt").on(table.deletedAt),
	primaryKey({ columns: [table.id], name: "users_id"}),
	unique("users_openId_unique").on(table.openId),
]);

// ─── Phase 3: Follow-ups & Tasks ──────────────────────────────────────────

export const followUps = mysqlTable("follow_ups", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	userId: int().notNull(),
	type: mysqlEnum(['Call','Meeting','WhatsApp','Email']).notNull(),
	followUpDate: timestamp({ mode: 'string' }).notNull(),
	notes: text(),
	status: mysqlEnum('status', ['Pending','Completed']).default('Pending'),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "follow_ups_id"}),
	index("idx_followups_clientId").on(table.clientId),
	index("idx_followups_userId").on(table.userId),
]);

export const clientTasks = mysqlTable("client_tasks", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	assignedTo: int(),
	dueDate: timestamp({ mode: 'string' }),
	priority: mysqlEnum('priority', ['Low','Medium','High']).default('Medium'),
	status: mysqlEnum('status', ['ToDo','InProgress','Done','Cancelled']).default('ToDo'),
	notes: text(),
	createdBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "client_tasks_id"}),
	index("idx_clienttasks_clientId").on(table.clientId),
	index("idx_clienttasks_assignedTo").on(table.assignedTo),
]);

export const onboardingChecklists = mysqlTable("onboarding_checklists", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	items: json().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "onboarding_checklists_id"}),
]);

export const clientOnboardingItems = mysqlTable("client_onboarding_items", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	itemName: varchar({ length: 255 }).notNull(),
	isChecked: tinyint().default(0),
	notes: text(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "client_onboarding_items_id"}),
	index("idx_onboarding_clientId").on(table.clientId),
]);

// ─── Type Exports ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = typeof pipelineStages.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;
export type CustomField = typeof customFields.$inferSelect;
export type InsertCustomField = typeof customFields.$inferInsert;
export type ThemeSetting = typeof themeSettings.$inferSelect;
export type InsertThemeSetting = typeof themeSettings.$inferInsert;
export type SlaConfig = typeof slaConfig.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type NotificationSubscriber = typeof notificationSubscribers.$inferSelect;
export type InsertNotificationSubscriber = typeof notificationSubscribers.$inferInsert;
export type LeadSource = typeof leadSources.$inferSelect;
export type InsertLeadSource = typeof leadSources.$inferInsert;
export type LeadSourceSyncLog = typeof leadSourceSyncLog.$inferSelect;
export type InsertLeadSourceSyncLog = typeof leadSourceSyncLog.$inferInsert;
export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = typeof backupLogs.$inferInsert;
export type InternalNote = typeof internalNotes.$inferSelect;
export type InsertInternalNote = typeof internalNotes.$inferInsert;
export type LeadTransfer = typeof leadTransfers.$inferSelect;
export type InsertLeadTransfer = typeof leadTransfers.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = typeof inAppNotifications.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type ServicePackage = typeof servicePackages.$inferSelect;
export type InsertServicePackage = typeof servicePackages.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;
export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;
export type ClientTask = typeof clientTasks.$inferSelect;
export type InsertClientTask = typeof clientTasks.$inferInsert;
export type OnboardingChecklist = typeof onboardingChecklists.$inferSelect;
export type ClientOnboardingItem = typeof clientOnboardingItems.$inferSelect;
export type InsertClientOnboardingItem = typeof clientOnboardingItems.$inferInsert;
