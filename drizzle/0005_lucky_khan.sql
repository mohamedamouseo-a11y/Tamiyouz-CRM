CREATE TABLE `notification_subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`frequency` enum('daily','weekly') NOT NULL DEFAULT 'daily',
	`dayOfWeek` int DEFAULT 1,
	`hourOfDay` int DEFAULT 8,
	`isActive` boolean NOT NULL DEFAULT true,
	`reportTypes` json DEFAULT ('["sla","performance","deals"]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_subscribers_email_unique` UNIQUE(`email`)
);
