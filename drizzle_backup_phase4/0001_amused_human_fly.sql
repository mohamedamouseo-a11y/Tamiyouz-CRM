CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('WhatsApp','Call','SMS','Meeting','Offer','Email','Note') NOT NULL,
	`activityTime` timestamp NOT NULL DEFAULT (now()),
	`outcome` enum('Contacted','NoAnswer','Interested','NotInterested','Meeting','Offer','Won','Lost','Callback') DEFAULT 'Contacted',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`platform` enum('Messages','LeadForm','Meta','Google','Snapchat','TikTok','Other') NOT NULL DEFAULT 'Meta',
	`startDate` timestamp,
	`endDate` timestamp,
	`notes` text,
	`roundRobinEnabled` boolean NOT NULL DEFAULT false,
	`roundRobinIndex` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entity` enum('Lead','Deal','Activity','Campaign') NOT NULL,
	`fieldName` varchar(100) NOT NULL,
	`fieldLabel` varchar(100),
	`fieldLabelAr` varchar(100),
	`fieldType` enum('text','number','date','select','boolean') NOT NULL,
	`options` json,
	`isRequired` boolean NOT NULL DEFAULT false,
	`order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`valueSar` decimal(12,2),
	`status` enum('Won','Lost','Pending') NOT NULL DEFAULT 'Pending',
	`closedAt` timestamp,
	`dealType` enum('New','Contract','Renewal','Upsell') DEFAULT 'New',
	`lossReason` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255),
	`phone` varchar(30) NOT NULL,
	`country` varchar(100) DEFAULT 'Saudi Arabia',
	`businessProfile` text,
	`leadQuality` enum('Hot','Warm','Cold','Bad','Unknown') NOT NULL DEFAULT 'Unknown',
	`campaignName` varchar(255),
	`adCreative` varchar(255),
	`ownerId` int,
	`stage` varchar(100) NOT NULL DEFAULT 'New',
	`notes` text,
	`mediaBuyerNotes` text,
	`serviceIntroduced` text,
	`slaBreached` boolean NOT NULL DEFAULT false,
	`slaAlertedAt` timestamp,
	`isDuplicate` boolean NOT NULL DEFAULT false,
	`duplicateOfId` int,
	`leadTime` timestamp,
	`contactTime` timestamp,
	`priceOfferSent` boolean NOT NULL DEFAULT false,
	`priceOfferLink` text,
	`priceOfferTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameAr` varchar(100),
	`color` varchar(20) NOT NULL DEFAULT '#6366f1',
	`order` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pipeline_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sla_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hoursThreshold` int NOT NULL DEFAULT 24,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sla_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `theme_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `theme_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('Admin','SalesManager','SalesAgent','MediaBuyer','user','admin') NOT NULL DEFAULT 'SalesAgent';--> statement-breakpoint
ALTER TABLE `users` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;