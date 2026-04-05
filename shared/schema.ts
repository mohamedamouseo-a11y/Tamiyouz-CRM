import { mysqlTable, mysqlSchema, AnyMySqlColumn, primaryKey, int, mysqlEnum, timestamp, text, varchar, json, decimal, index, datetime, unique, tinyint, boolean, uniqueIndex } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const activities = mysqlTable("activities", {
	id: int().autoincrement().notNull(),
	leadId: int(),
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
	previousValue: json(),
	newValue: json(),
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
	leadId: int(),
	dealId: int(),
	businessProfile: text(),
	group: varchar({ length: 255 }),
	planStatus: mysqlEnum(['Active','Paused','Cancelled','Pending','Hold']).default('Active').notNull(),
	renewalStatus: mysqlEnum(['Renewed','Pending','Expired','Cancelled']).default('Pending').notNull(),
	accountManagerId: int(),
	competentPerson: varchar({ length: 255 }),
	contactEmail: varchar({ length: 320 }),
	contactPhone: varchar({ length: 50 }),
	leadName: varchar({ length: 255 }),
	phone: varchar({ length: 50 }),
	otherPhones: text(),

	marketingObjective: text(),
	servicesNeeded: text(),
	socialMedia: text(),
	feedback: text(),
	notes: text(),
	contractLink: text(),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
	lastFollowUpDate: timestamp({ mode: 'string' }),
	nextFollowUpDate: timestamp({ mode: 'string' }),
	healthScore: int().default(0),
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
	contractLink: text(),

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
	leadId: int(),
	valueSar: decimal({ precision: 12, scale: 2 }),
	currency: varchar({ length: 10 }).default("SAR").notNull(),
	valueBase: decimal({ precision: 12, scale: 2 }).default("0.00").notNull(),
	status: mysqlEnum(['Won','Lost','Pending']).default('Pending').notNull(),
	closedAt: timestamp({ mode: 'string' }),
	dealType: mysqlEnum(['New','Contract','Renewal','Upsell']).default('New'),
	lossReason: text(),
	notes: text(),
	dealDuration: int(),

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
	type: mysqlEnum(['meeting_reminder','lead_assigned','sla_breach','lead_transfer','mention','system','stage_change','deal_won','deal_lost','activity_logged','lead_quality_change','duplicate_lead','bulk_import','data_edit','data_delete','data_restore','data_undo']).default('system').notNull(),
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
	leadId: int(),
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



export const leadAttachments = mysqlTable("lead_attachments", {
	id: int().autoincrement().notNull(),
	leadId: int(),
	fileName: varchar({ length: 255 }).notNull(),
	fileUrl: text().notNull(),
	fileSize: int(),
	fileType: varchar({ length: 100 }),
	uploadedBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "lead_attachments_id"}),
	index("idx_lead_attachments_leadId").on(table.leadId),
]);

export const leadTransfers = mysqlTable("lead_transfers", {
	id: int().autoincrement().notNull(),
	leadId: int(),
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
	fitStatus: mysqlEnum("fit_status", ["Fit","Not Fit","Pending"]).default("Pending").notNull(),
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
	inactivatedAt: timestamp({ mode: 'string' }),
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
	deletedAt: timestamp({ mode: 'string' }),
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
	deletedAt: timestamp({ mode: 'string' }),
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

// ─── Phase 4: Dashboards & Performance ──────────────────────────────────────

export const clientObjectives = mysqlTable("client_objectives", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	status: mysqlEnum(['OnTrack','AtRisk','OffTrack']).default('OnTrack'),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
},
(table) => [
	primaryKey({ columns: [table.id], name: "client_objectives_id"}),
	index("idx_objectives_clientId").on(table.clientId),
]);

export const keyResults = mysqlTable("key_results", {
	id: int().autoincrement().notNull(),
	objectiveId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	targetValue: decimal({ precision: 12, scale: 2 }),
	currentValue: decimal({ precision: 12, scale: 2 }).default('0'),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "key_results_id"}),
	index("idx_keyresults_objectiveId").on(table.objectiveId),
]);

// ─── Phase 5: Enhancements ──────────────────────────────────────────────────

export const deliverables = mysqlTable("deliverables", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	contractId: int(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	status: mysqlEnum(['Pending','InProgress','Delivered','Approved','Rejected']).default('Pending'),
	dueDate: timestamp({ mode: 'string' }),
	deliveredAt: timestamp({ mode: 'string' }),
	assignedTo: int(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
},
(table) => [
	primaryKey({ columns: [table.id], name: "deliverables_id"}),
	index("idx_deliverables_clientId").on(table.clientId),
]);

export const upsellOpportunities = mysqlTable("upsell_opportunities", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	servicePackageId: int(),
	title: varchar({ length: 255 }).notNull(),
	potentialValue: decimal({ precision: 12, scale: 2 }),
	currency: varchar({ length: 10 }).default("SAR").notNull(),
	status: mysqlEnum(['Prospecting','ProposalSent','Negotiation','Won','Lost']).default('Prospecting'),
	notes: text(),

	createdBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
},
(table) => [
	primaryKey({ columns: [table.id], name: "upsell_opportunities_id"}),
	index("idx_upsell_clientId").on(table.clientId),
]);

export const clientCommunications = mysqlTable("client_communications", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	channelName: varchar({ length: 100 }).notNull(),
	channelType: mysqlEnum(['EmailThread','WhatsAppGroup','SlackChannel','Other']).notNull(),
	link: varchar({ length: 500 }),
	notes: text(),

	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "client_communications_id"}),
	index("idx_communications_clientId").on(table.clientId),
]);

export const csatSurveys = mysqlTable("csat_surveys", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	contractId: int(),
	score: int().notNull(),
	feedback: text(),
	submittedAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "csat_surveys_id"}),
	index("idx_csat_clientId").on(table.clientId),
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
export type LeadAttachment = typeof leadAttachments.$inferSelect;
export type InsertLeadAttachment = typeof leadAttachments.$inferInsert;
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
export type ClientObjective = typeof clientObjectives.$inferSelect;
export type InsertClientObjective = typeof clientObjectives.$inferInsert;
export type KeyResult = typeof keyResults.$inferSelect;
export type InsertKeyResult = typeof keyResults.$inferInsert;
export type Deliverable = typeof deliverables.$inferSelect;
export type InsertDeliverable = typeof deliverables.$inferInsert;
export type UpsellOpportunity = typeof upsellOpportunities.$inferSelect;
export type InsertUpsellOpportunity = typeof upsellOpportunities.$inferInsert;
export type ClientCommunication = typeof clientCommunications.$inferSelect;
export type InsertClientCommunication = typeof clientCommunications.$inferInsert;
export type CsatSurvey = typeof csatSurveys.$inferSelect;
export type InsertCsatSurvey = typeof csatSurveys.$inferInsert;

// ─── Lead Assignments (Collaboration Model) ──────────────────────────────────
export const leadAssignments = mysqlTable("lead_assignments", {
id: int().autoincrement().notNull(),
leadId: int(),
userId: int().notNull(),
role: mysqlEnum(['owner','collaborator','observer','client_success','account_manager']).default('collaborator').notNull(),
permissions: mysqlEnum(['full','edit','view']).default('edit').notNull(),
assignedBy: int(),
reason: varchar({ length: 500 }),
notes: text(),

isActive: tinyint().default(1).notNull(),
createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
index("idx_la_leadId").on(table.leadId),
index("idx_la_userId").on(table.userId),
index("idx_la_role").on(table.role),
index("idx_la_isActive").on(table.isActive),
primaryKey({ columns: [table.id], name: "lead_assignments_id"}),
]);
export type LeadAssignment = typeof leadAssignments.$inferSelect;
export type InsertLeadAssignment = typeof leadAssignments.$inferInsert;

// ─── Meeting Notification Config ──────────────────────────────────────────────
export const meetingNotificationConfig = mysqlTable("meeting_notification_config", {
	id: int().autoincrement().notNull(),
	reminderMinutes: json().$type<number[]>().default([30, 10]).notNull(),
	repeatCount: int().default(1).notNull(),
	soundEnabled: tinyint().default(1).notNull(),
	popupEnabled: tinyint().default(1).notNull(),
	autoCalendarForMeeting: tinyint().default(1).notNull(),
	autoCalendarForCall: tinyint().default(1).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "meeting_notification_config_id"}),
]);
export type MeetingNotificationConfig = typeof meetingNotificationConfig.$inferSelect;
export type InsertMeetingNotificationConfig = typeof meetingNotificationConfig.$inferInsert;

// ─── Lead Reminders (Internal per-lead reminders with calendar) ─────────────
export const leadReminders = mysqlTable("lead_reminders", {
id: int().autoincrement().notNull(),
leadId: int("lead_id").notNull(),
userId: int("user_id").notNull(),
title: varchar({ length: 255 }).notNull(),
description: text(),
reminderDate: timestamp("reminder_date", { mode: 'string' }).notNull(),
reminderTime: varchar("reminder_time", { length: 5 }).default('09:00').notNull(),
priority: mysqlEnum(['Low','Medium','High']).default('Medium').notNull(),
status: mysqlEnum('status', ['Pending','Done','Cancelled']).default('Pending').notNull(),
color: varchar({ length: 20 }).default('#6366f1'),
createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
completedAt: timestamp("completed_at", { mode: 'string' }),
},
(table) => [
primaryKey({ columns: [table.id], name: "lead_reminders_id"}),
index("idx_lr_lead_id").on(table.leadId),
index("idx_lr_user_id").on(table.userId),
index("idx_lr_reminder_date").on(table.reminderDate),
index("idx_lr_status").on(table.status),
]);
export type LeadReminder = typeof leadReminders.$inferSelect;
export type InsertLeadReminder = typeof leadReminders.$inferInsert;

// ─── User Notification Preferences ────────────────────────────────────────────
export const userNotificationPreferences = mysqlTable("user_notification_preferences", {
id: int().autoincrement().notNull(),
userId: int().notNull(),
notificationType: varchar({ length: 100 }).notNull(),
soundEnabled: tinyint().default(1).notNull(),
popupEnabled: tinyint().default(1).notNull(),
createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
primaryKey({ columns: [table.id], name: "user_notification_preferences_id"}),
]);

export type UserNotificationPreference = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreference = typeof userNotificationPreferences.$inferInsert;

// ─── Notification Sound Config ────────────────────────────────────────────────
export const notificationSoundConfig = mysqlTable("notification_sound_config", {
id: int().autoincrement().notNull(),
soundFileUrl: varchar({ length: 1000 }),
soundFileName: varchar({ length: 255 }),
uploadedBy: int(),
createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
primaryKey({ columns: [table.id], name: "notification_sound_config_id"}),
]);

export type NotificationSoundConfig = typeof notificationSoundConfig.$inferSelect;



// ─── Support Center ──────────────────────────────────────────────────────────

export const supportRequests = mysqlTable("support_requests", {
	id: int().autoincrement().notNull(),
	code: varchar({ length: 32 }).notNull(),
	requestType: mysqlEnum("request_type", ['Ticket','Suggestion']).notNull(),
	category: mysqlEnum("category", ['Bug','Complaint','Access','Data','Feature','Improvement','Other']).notNull(),
	subject: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	priority: mysqlEnum("priority", ['Low','Medium','High']).default('Medium').notNull(),
	status: mysqlEnum("status", ['New','UnderReview','WaitingUser','Resolved','Closed','Rejected']).default('New').notNull(),
	screenRecordingLink: text("screen_recording_link"),
	createdBy: int("created_by").notNull(),
	superAdminId: int("super_admin_id").notNull(),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	closedBy: int("closed_by"),
	lastActivityAt: timestamp("last_activity_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "support_requests_id"}),
	unique("support_requests_code_unique").on(table.code),
	index("idx_support_requests_created_by").on(table.createdBy),
	index("idx_support_requests_super_admin_id").on(table.superAdminId),
	index("idx_support_requests_status").on(table.status),
	index("idx_support_requests_request_type").on(table.requestType),
	index("idx_support_requests_last_activity_at").on(table.lastActivityAt),
]);

export const supportRequestMessages = mysqlTable("support_request_messages", {
	id: int().autoincrement().notNull(),
	requestId: int("request_id").notNull(),
	userId: int("user_id").notNull(),
	message: text().notNull(),
	isFromSuperAdmin: tinyint("is_from_super_admin").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "support_request_messages_id"}),
	index("idx_support_request_messages_request_id").on(table.requestId),
	index("idx_support_request_messages_user_id").on(table.userId),
]);

export const supportRequestAttachments = mysqlTable("support_request_attachments", {
	id: int().autoincrement().notNull(),
	requestId: int("request_id").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileUrl: text("file_url").notNull(),
	storageKey: varchar("storage_key", { length: 500 }).notNull(),
	fileSize: int("file_size"),
	fileType: varchar("file_type", { length: 100 }),
	uploadedBy: int("uploaded_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "support_request_attachments_id"}),
	index("idx_support_request_attachments_request_id").on(table.requestId),
]);

export type SupportRequest = typeof supportRequests.$inferSelect;
export type InsertSupportRequest = typeof supportRequests.$inferInsert;
export type SupportRequestMessage = typeof supportRequestMessages.$inferSelect;
export type InsertSupportRequestMessage = typeof supportRequestMessages.$inferInsert;
export type SupportRequestAttachment = typeof supportRequestAttachments.$inferSelect;
export type InsertSupportRequestAttachment = typeof supportRequestAttachments.$inferInsert;

// ─── Meta Ads Integration ──────────────────────────────────────────────────

export const metaIntegrations = mysqlTable("meta_integrations", {
	id: int().autoincrement().notNull(),
	appId: varchar({ length: 255 }).notNull(),
	appSecret: varchar({ length: 255 }).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "meta_integrations_id"}),
]);

export const metaAdAccounts = mysqlTable("meta_ad_accounts", {
	id: int().autoincrement().notNull(),
	integrationId: int().notNull(),
	adAccountId: varchar({ length: 255 }).notNull(),
	accountName: varchar({ length: 255 }),
	accessToken: text(),
	tokenExpiresAt: timestamp({ mode: 'string' }),
	isActive: tinyint().default(0).notNull(),
	lastSyncAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "meta_ad_accounts_id"}),
	index("idx_meta_ad_accounts_integrationId").on(table.integrationId),
	index("idx_meta_ad_accounts_adAccountId").on(table.adAccountId),
]);

export const metaCampaignSnapshots = mysqlTable("meta_campaign_snapshots", {
	id: int().autoincrement().notNull(),
	adAccountId: int().notNull(),
	campaignId: varchar({ length: 255 }).notNull(),
	campaignName: varchar({ length: 255 }),
	status: varchar({ length: 50 }),
	dailyBudget: decimal({ precision: 12, scale: 2 }),
	lifetimeBudget: decimal({ precision: 12, scale: 2 }),
	objective: varchar({ length: 100 }),
	rawJson: json(),
	syncedAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "meta_campaign_snapshots_id"}),
	index("idx_meta_campaigns_adAccountId").on(table.adAccountId),
	index("idx_meta_campaigns_campaignId").on(table.campaignId),
]);

export type MetaIntegration = typeof metaIntegrations.$inferSelect;
export type InsertMetaIntegration = typeof metaIntegrations.$inferInsert;
export type MetaAdAccount = typeof metaAdAccounts.$inferSelect;
export type InsertMetaAdAccount = typeof metaAdAccounts.$inferInsert;
export type MetaCampaignSnapshot = typeof metaCampaignSnapshots.$inferSelect;
export type InsertMetaCampaignSnapshot = typeof metaCampaignSnapshots.$inferInsert;

// ─── Meta Leadgen Webhook Config ──────────────────────────────────────────────
export const metaLeadgenConfig = mysqlTable("meta_leadgen_config", {
	id: int().autoincrement().notNull(),
	pageId: varchar("page_id", { length: 255 }).notNull(),
	pageName: varchar("page_name", { length: 255 }),
	pageAccessToken: text("page_access_token").notNull(),
	webhookVerifyToken: varchar("webhook_verify_token", { length: 255 }),
	isEnabled: tinyint("is_enabled").default(1).notNull(),
	assignmentRule: mysqlEnum("assignment_rule", ["round_robin", "fixed_owner", "by_campaign"]).default("round_robin").notNull(),
	fixedOwnerId: int("fixed_owner_id"),
	roundRobinIndex: int("round_robin_index").default(0).notNull(),
	fieldMapping: json("field_mapping"),
	totalLeadsReceived: int("total_leads_received").default(0).notNull(),
	lastLeadReceivedAt: timestamp("last_lead_received_at", { mode: "string" }),
	createdAt: timestamp("created_at", { mode: "string" }).default(sql`(now())`).notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "meta_leadgen_config_id"}),
	index("idx_meta_leadgen_config_page_id").on(table.pageId),
	index("idx_meta_leadgen_config_is_enabled").on(table.isEnabled),
]);

export type MetaLeadgenConfig = typeof metaLeadgenConfig.$inferSelect;
export type InsertMetaLeadgenConfig = typeof metaLeadgenConfig.$inferInsert;

// ─── TikTok Ads Integration ──────────────────────────────────────────────────

export const tiktokIntegrations = mysqlTable("tiktok_integrations", {
id: int().autoincrement().notNull(),
appId: varchar({ length: 255 }).notNull(),
appSecret: varchar({ length: 255 }).notNull(),
isActive: tinyint().default(1).notNull(),
createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
primaryKey({ columns: [table.id], name: "tiktok_integrations_id" }),
]);

export const tiktokAdAccounts = mysqlTable("tiktok_ad_accounts", {
id: int().autoincrement().notNull(),
integrationId: int().notNull(),
advertiserId: varchar({ length: 255 }).notNull(),
accountName: varchar({ length: 255 }),
accessToken: text(),
tokenExpiresAt: timestamp({ mode: 'string' }),
isActive: tinyint().default(0).notNull(),
lastSyncAt: timestamp({ mode: 'string' }),
createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
primaryKey({ columns: [table.id], name: "tiktok_ad_accounts_id" }),
index("idx_tiktok_ad_accounts_integrationId").on(table.integrationId),
index("idx_tiktok_ad_accounts_advertiserId").on(table.advertiserId),
]);

export const tiktokCampaignSnapshots = mysqlTable("tiktok_campaign_snapshots", {
id: int().autoincrement().notNull(),
adAccountId: int().notNull(),
campaignId: varchar({ length: 255 }).notNull(),
campaignName: varchar({ length: 255 }),
status: varchar({ length: 50 }),
objective: varchar({ length: 100 }),
dailyBudget: decimal({ precision: 12, scale: 2 }),
lifetimeBudget: decimal({ precision: 12, scale: 2 }),
impressions: int().default(0).notNull(),
clicks: int().default(0).notNull(),
spend: decimal({ precision: 12, scale: 2 }).default("0").notNull(),
conversions: int().default(0).notNull(),
ctr: decimal({ precision: 8, scale: 4 }).default("0").notNull(),
cpc: decimal({ precision: 12, scale: 2 }).default("0").notNull(),
cpa: decimal({ precision: 12, scale: 2 }).default("0").notNull(),
rawJson: json(),
syncedAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
createdAt: timestamp({ mode: 'string' }).default(sql`(now())`).notNull(),
updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
primaryKey({ columns: [table.id], name: "tiktok_campaign_snapshots_id" }),
index("idx_tiktok_campaigns_adAccountId").on(table.adAccountId),
index("idx_tiktok_campaigns_campaignId").on(table.campaignId),
]);

export type TikTokIntegration = typeof tiktokIntegrations.$inferSelect;
export type InsertTikTokIntegration = typeof tiktokIntegrations.$inferInsert;
export type TikTokAdAccount = typeof tiktokAdAccounts.$inferSelect;
export type InsertTikTokAdAccount = typeof tiktokAdAccounts.$inferInsert;
export type TikTokCampaignSnapshot = typeof tiktokCampaignSnapshots.$inferSelect;
export type InsertTikTokCampaignSnapshot = typeof tiktokCampaignSnapshots.$inferInsert;

export const exchangeRates = mysqlTable("exchange_rates", {
id: int().autoincrement().notNull(),
fromCurrency: varchar({ length: 10 }).notNull(),
toCurrency: varchar({ length: 10 }).notNull(),
rate: decimal({ precision: 18, scale: 8 }).notNull(),
updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
primaryKey({ columns: [table.id], name: "exchange_rates_id" }),
uniqueIndex("exchange_rates_pair_uq").on(table.fromCurrency, table.toCurrency),
]);

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;
