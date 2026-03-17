CREATE TABLE `backup_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredBy` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`format` enum('json','csv','both') NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` decimal(15,0),
	`driveFileId` varchar(255),
	`cleanupEnabled` boolean NOT NULL DEFAULT false,
	`cleanupStatus` enum('pending','completed','failed') DEFAULT 'pending',
	`status` enum('success','partial','error') NOT NULL,
	`recordCount` json,
	`recordsSkipped` json,
	`errorLog` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backup_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_source_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`status` enum('success','error','partial') NOT NULL,
	`rowsProcessed` int DEFAULT 0,
	`rowsImported` int DEFAULT 0,
	`rowsSkipped` int DEFAULT 0,
	`rowsError` int DEFAULT 0,
	`errorMessage` text,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_source_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceName` varchar(255) NOT NULL,
	`status` enum('Connected','PermissionMissing','MappingError','Disabled') NOT NULL DEFAULT 'Disabled',
	`isEnabled` boolean NOT NULL DEFAULT false,
	`sheetUrl` text,
	`spreadsheetId` varchar(255),
	`worksheetMode` enum('pick','all') NOT NULL DEFAULT 'pick',
	`worksheetName` varchar(255),
	`syncFrequencyMinutes` int NOT NULL DEFAULT 5,
	`uniqueKeyPriority` enum('meta_lead_id','phone') NOT NULL DEFAULT 'meta_lead_id',
	`assignmentRule` enum('round_robin','fixed_owner','by_campaign') NOT NULL DEFAULT 'round_robin',
	`fixedOwnerId` int,
	`fieldMapping` json,
	`lastSyncTime` timestamp,
	`lastSyncResult` text,
	`lastSyncRowCount` int DEFAULT 0,
	`lastSyncCursor` varchar(255),
	`isDeleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `externalId` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `sourceId` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `sourceMetadata` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `customFieldsData` json;