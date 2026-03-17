-- ─── TikTok Ads Integration — MySQL Migration ──────────────────────────────
-- Run this SQL on the tamiyouz_crm database before deploying the code

-- 1. TikTok Integrations (mirrors meta_integrations)
CREATE TABLE IF NOT EXISTS `tiktok_integrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `app_id` varchar(255) NOT NULL,
  `app_secret` varchar(255) NOT NULL,
  `is_active` tinyint NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TikTok Ad Accounts (mirrors meta_ad_accounts)
CREATE TABLE IF NOT EXISTS `tiktok_ad_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `integration_id` int NOT NULL,
  `advertiser_id` varchar(255) NOT NULL,
  `account_name` varchar(255) DEFAULT NULL,
  `access_token` text DEFAULT NULL,
  `token_expires_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT 0,
  `last_sync_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tiktok_ad_accounts_integrationId` (`integration_id`),
  KEY `idx_tiktok_ad_accounts_advertiserId` (`advertiser_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TikTok Campaign Snapshots (mirrors meta_campaign_snapshots + extra metrics)
CREATE TABLE IF NOT EXISTS `tiktok_campaign_snapshots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad_account_id` int NOT NULL,
  `campaign_id` varchar(255) NOT NULL,
  `campaign_name` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `objective` varchar(100) DEFAULT NULL,
  `daily_budget` decimal(12,2) DEFAULT NULL,
  `lifetime_budget` decimal(12,2) DEFAULT NULL,
  `impressions` int NOT NULL DEFAULT 0,
  `clicks` int NOT NULL DEFAULT 0,
  `spend` decimal(12,2) NOT NULL DEFAULT 0.00,
  `conversions` int NOT NULL DEFAULT 0,
  `ctr` decimal(8,4) NOT NULL DEFAULT 0.0000,
  `cpc` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cpa` decimal(12,2) NOT NULL DEFAULT 0.00,
  `raw_json` json DEFAULT NULL,
  `synced_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tiktok_campaigns_adAccountId` (`ad_account_id`),
  KEY `idx_tiktok_campaigns_campaignId` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
