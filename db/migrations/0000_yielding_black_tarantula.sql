CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`scan_id` text,
	`source` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`framework` text NOT NULL,
	`heuristic_id` integer,
	`baymard_category` text,
	`wcag_criterion` text,
	`wcag_level` text,
	`generated_by_profile` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`recommendation` text NOT NULL,
	`severity` text NOT NULL,
	`evidence_selector` text,
	`evidence_dom_snippet` text,
	`evidence_bbox` text,
	`ai_confidence` text,
	`dismiss_reason` text,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `flows` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`profile` text NOT NULL,
	`triggered_by` text DEFAULT 'auto' NOT NULL,
	`gemini_model` text NOT NULL,
	`findings_generated` integer DEFAULT 0 NOT NULL,
	`findings_discarded` integer DEFAULT 0 NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_url` text NOT NULL,
	`description` text,
	`audit_profile` text DEFAULT 'nng' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`flow_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`capture_method` text,
	`screenshot_path` text,
	`raw_dom_path` text,
	`scrubbed_dom_path` text,
	`axe_results_path` text,
	`has_redactions` integer DEFAULT false NOT NULL,
	`last_analyzed_profile` text,
	`analyzed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`flow_id`) REFERENCES `flows`(`id`) ON UPDATE no action ON DELETE cascade
);
