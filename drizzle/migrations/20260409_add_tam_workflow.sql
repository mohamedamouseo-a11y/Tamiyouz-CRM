ALTER TABLE `lead_assignments`
MODIFY COLUMN `role` enum('owner','collaborator','observer','client_success','account_manager','technical_account_manager') NOT NULL DEFAULT 'collaborator';

CREATE TABLE `lead_tam_reviews` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `tamUserId` int NOT NULL,
  `salesUserId` int NULL,
  `status` enum('Draft','ReadyForSalesAction','WaitingForReview','ClosedWon','ClosedLost') NOT NULL DEFAULT 'Draft',
  `dropReasonCategory` enum('service_understanding','wrong_expectations','technical_gap','budget','timing','trust','competition','other') NOT NULL DEFAULT 'other',
  `dropReasonDetails` text NULL,
  `leadNature` text NULL,
  `insightDoc` text NULL,
  `nextBestAction` text NULL,
  `salesImprovementNotes` text NULL,
  `callOutcome` enum('Interested','NotInterested','NeedFollowUp','NoAnswer','Won','Lost','Other') NULL,
  `objection` text NULL,
  `nextStep` text NULL,
  `readyForSalesActionAt` timestamp NULL,
  `salesFeedbackAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `lead_tam_reviews_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_tamreviews_leadId` ON `lead_tam_reviews` (`leadId`);
CREATE INDEX `idx_tamreviews_tamUserId` ON `lead_tam_reviews` (`tamUserId`);
CREATE INDEX `idx_tamreviews_salesUserId` ON `lead_tam_reviews` (`salesUserId`);
CREATE INDEX `idx_tamreviews_status` ON `lead_tam_reviews` (`status`);
