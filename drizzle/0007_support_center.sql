CREATE TABLE `support_requests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(32) NOT NULL,
  `request_type` enum('Ticket','Suggestion') NOT NULL,
  `category` enum('Bug','Complaint','Access','Data','Feature','Improvement','Other') NOT NULL,
  `subject` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `priority` enum('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  `status` enum('New','UnderReview','WaitingUser','Resolved','Closed','Rejected') NOT NULL DEFAULT 'New',
  `screen_recording_link` text,
  `created_by` int NOT NULL,
  `super_admin_id` int NOT NULL,
  `closed_at` timestamp NULL,
  `closed_by` int NULL,
  `last_activity_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `support_requests_id` PRIMARY KEY(`id`),
  CONSTRAINT `support_requests_code_unique` UNIQUE(`code`)
);

CREATE INDEX `idx_support_requests_created_by` ON `support_requests` (`created_by`);
CREATE INDEX `idx_support_requests_super_admin_id` ON `support_requests` (`super_admin_id`);
CREATE INDEX `idx_support_requests_status` ON `support_requests` (`status`);
CREATE INDEX `idx_support_requests_request_type` ON `support_requests` (`request_type`);
CREATE INDEX `idx_support_requests_last_activity_at` ON `support_requests` (`last_activity_at`);

CREATE TABLE `support_request_messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `request_id` int NOT NULL,
  `user_id` int NOT NULL,
  `message` text NOT NULL,
  `is_from_super_admin` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `support_request_messages_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_support_request_messages_request_id` ON `support_request_messages` (`request_id`);
CREATE INDEX `idx_support_request_messages_user_id` ON `support_request_messages` (`user_id`);

CREATE TABLE `support_request_attachments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `request_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_url` text NOT NULL,
  `storage_key` varchar(500) NOT NULL,
  `file_size` int NULL,
  `file_type` varchar(100) NULL,
  `uploaded_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `support_request_attachments_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_support_request_attachments_request_id` ON `support_request_attachments` (`request_id`);
