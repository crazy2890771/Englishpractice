CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"cost_cents" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"skill" text NOT NULL,
	"kind" text NOT NULL,
	"unit_id" text,
	"level_code" text NOT NULL,
	"session_id" uuid,
	"score" double precision NOT NULL,
	"section_scores" jsonb NOT NULL,
	"passed" boolean NOT NULL,
	"criteria" jsonb NOT NULL,
	"remediation" jsonb,
	"remediation_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"input_mode" text,
	"feedback" jsonb,
	"recording_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"topic" text NOT NULL,
	"level_code" text NOT NULL,
	"correction_mode" text NOT NULL,
	"session_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"evaluator" text NOT NULL,
	"summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "curriculum_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"language_id" text NOT NULL,
	"code" text NOT NULL,
	"ord" smallint NOT NULL,
	"name_th" text NOT NULL,
	"has_content" boolean DEFAULT false NOT NULL,
	CONSTRAINT "curriculum_levels_language_id_code_unique" UNIQUE("language_id","code")
);
--> statement-breakpoint
ALTER TABLE "curriculum_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"exercise_id" text NOT NULL,
	"language_id" text NOT NULL,
	"skill" text NOT NULL,
	"response" jsonb NOT NULL,
	"score" double precision NOT NULL,
	"is_correct" boolean NOT NULL,
	"feedback" jsonb,
	"evaluator" text NOT NULL,
	"ai_provider" text,
	"is_retry" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"language_id" text NOT NULL,
	"unit_id" text,
	"level_code" text NOT NULL,
	"skill" text NOT NULL,
	"type" text NOT NULL,
	"objective" text NOT NULL,
	"purpose" text NOT NULL,
	"tags" text[] NOT NULL,
	"content" jsonb NOT NULL,
	"owner_id" uuid,
	"validated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "languages" (
	"id" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_th" text NOT NULL,
	"framework" text NOT NULL,
	"levels" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "languages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"skill" text NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "level_exams" (
	"id" text PRIMARY KEY NOT NULL,
	"language_id" text NOT NULL,
	"level_code" text NOT NULL,
	"skill" text NOT NULL,
	"sections" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "level_exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"language_id" text NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mistake_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"skill" text NOT NULL,
	"category_id" text NOT NULL,
	"exercise_id" text,
	"attempt_id" uuid,
	"original" text NOT NULL,
	"corrected" text NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mistake_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "placement_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "placement_assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "placement_skill_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"estimated_level" text,
	"confidence" text,
	"detail" jsonb,
	"strengths" text[],
	"weaknesses" text[],
	"limitations" text[],
	"evaluator" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "placement_skill_results_assessment_id_skill_unique" UNIQUE("assessment_id","skill")
);
--> statement-breakpoint
ALTER TABLE "placement_skill_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"ui_language" text DEFAULT 'th' NOT NULL,
	"explanation_language" text DEFAULT 'th' NOT NULL,
	"timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"daily_minutes" smallint DEFAULT 30 NOT NULL,
	"correction_mode" text DEFAULT 'after_each' NOT NULL,
	"show_pinyin" boolean DEFAULT true NOT NULL,
	"playback_speed" double precision DEFAULT 1 NOT NULL,
	"review_new_per_day" smallint DEFAULT 10 NOT NULL,
	"review_max_per_day" smallint DEFAULT 60 NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_time" text DEFAULT '19:00' NOT NULL,
	"topics" text[] DEFAULT '{mixed}'::text[] NOT NULL,
	"goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"ai_provider" text DEFAULT 'auto' NOT NULL,
	"save_recordings" boolean DEFAULT false NOT NULL,
	"recording_retention_days" smallint DEFAULT 90 NOT NULL,
	"onboarded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "progress_snapshots" (
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"skill" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"accuracy" double precision NOT NULL,
	"attempts" integer NOT NULL,
	"level_code" text NOT NULL,
	CONSTRAINT "progress_snapshots_user_id_language_id_skill_snapshot_date_pk" PRIMARY KEY("user_id","language_id","skill","snapshot_date")
);
--> statement-breakpoint
ALTER TABLE "progress_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"duration_ms" integer,
	"transcript" text,
	"exercise_id" text,
	"prompt" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recordings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"language_id" text NOT NULL,
	"skills" text[] NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "schedule_slots_user_id_weekday_language_id_unique" UNIQUE("user_id","weekday","language_id")
);
--> statement-breakpoint
ALTER TABLE "schedule_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "skill_progress" (
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"skill" text NOT NULL,
	"level_code" text NOT NULL,
	"placement_level" text,
	"current_unit_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_progress_user_id_language_id_skill_pk" PRIMARY KEY("user_id","language_id","skill")
);
--> statement-breakpoint
ALTER TABLE "skill_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_log" (
	"user_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"language_id" text NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "study_log_user_id_log_date_language_id_pk" PRIMARY KEY("user_id","log_date","language_id")
);
--> statement-breakpoint
ALTER TABLE "study_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"kind" text NOT NULL,
	"scheduled_date" date,
	"skills" text[] NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"plan" jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"unit_id" text,
	"level_exam_id" text,
	"remediation_for" uuid,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"summary" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "unit_progress" (
	"user_id" uuid NOT NULL,
	"unit_id" text NOT NULL,
	"skill" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"practice_attempts" integer DEFAULT 0 NOT NULL,
	"practice_correct" double precision DEFAULT 0 NOT NULL,
	"best_assessment" double precision,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_progress_user_id_unit_id_skill_pk" PRIMARY KEY("user_id","unit_id","skill")
);
--> statement-breakpoint
ALTER TABLE "unit_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "units" (
	"id" text PRIMARY KEY NOT NULL,
	"language_id" text NOT NULL,
	"level_code" text NOT NULL,
	"ord" smallint NOT NULL,
	"title" text NOT NULL,
	"title_th" text NOT NULL,
	"topics" text[] NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_languages" (
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"goal" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_languages_user_id_language_id_pk" PRIMARY KEY("user_id","language_id")
);
--> statement-breakpoint
ALTER TABLE "user_languages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_weaknesses" (
	"user_id" uuid NOT NULL,
	"category_id" text NOT NULL,
	"language_id" text NOT NULL,
	"status" text NOT NULL,
	"first_detected_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"recent_occurrences" integer DEFAULT 0 NOT NULL,
	"mastery" double precision DEFAULT 0 NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_weaknesses_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "user_weaknesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vocabulary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language_id" text NOT NULL,
	"word" text NOT NULL,
	"pronunciation" text,
	"meaning_th" text NOT NULL,
	"meaning_en" text DEFAULT '' NOT NULL,
	"example" text DEFAULT '' NOT NULL,
	"example_translation" text DEFAULT '' NOT NULL,
	"difficulty" smallint DEFAULT 3 NOT NULL,
	"source_unit_id" text,
	"ease_factor" double precision DEFAULT 2.5 NOT NULL,
	"interval_days" double precision DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocabulary_items_user_id_language_id_word_unique" UNIQUE("user_id","language_id","word")
);
--> statement-breakpoint
ALTER TABLE "vocabulary_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vocabulary_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quality" smallint NOT NULL,
	"correct" boolean NOT NULL,
	"mode" text NOT NULL,
	"interval_days" double precision NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocabulary_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "weakness_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"language_id" text NOT NULL,
	"skill" text NOT NULL,
	"name_en" text NOT NULL,
	"name_th" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weakness_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_levels" ADD CONSTRAINT "curriculum_levels_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_exams" ADD CONSTRAINT "level_exams_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_records" ADD CONSTRAINT "mistake_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_records" ADD CONSTRAINT "mistake_records_category_id_weakness_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."weakness_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_records" ADD CONSTRAINT "mistake_records_attempt_id_exercise_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exercise_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_assessments" ADD CONSTRAINT "placement_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_assessments" ADD CONSTRAINT "placement_assessments_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_skill_results" ADD CONSTRAINT "placement_skill_results_assessment_id_placement_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."placement_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_skill_results" ADD CONSTRAINT "placement_skill_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_current_unit_id_units_id_fk" FOREIGN KEY ("current_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_log" ADD CONSTRAINT "study_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_level_exam_id_level_exams_id_fk" FOREIGN KEY ("level_exam_id") REFERENCES "public"."level_exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_languages" ADD CONSTRAINT "user_languages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_languages" ADD CONSTRAINT "user_languages_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_weaknesses" ADD CONSTRAINT "user_weaknesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_weaknesses" ADD CONSTRAINT "user_weaknesses_category_id_weakness_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."weakness_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_reviews" ADD CONSTRAINT "vocabulary_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_reviews" ADD CONSTRAINT "vocabulary_reviews_item_id_vocabulary_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."vocabulary_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weakness_categories" ADD CONSTRAINT "weakness_categories_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_id_created_at_index" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "assessment_results_user_id_language_id_created_at_index" ON "assessment_results" USING btree ("user_id","language_id","created_at");--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_id_created_at_index" ON "conversation_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_user_id_created_at_index" ON "conversations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "exercise_attempts_user_id_language_id_skill_created_at_index" ON "exercise_attempts" USING btree ("user_id","language_id","skill","created_at");--> statement-breakpoint
CREATE INDEX "exercise_attempts_session_id_index" ON "exercise_attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "exercises_language_id_skill_level_code_index" ON "exercises" USING btree ("language_id","skill","level_code");--> statement-breakpoint
CREATE INDEX "mistake_records_user_id_category_id_created_at_index" ON "mistake_records" USING btree ("user_id","category_id","created_at");--> statement-breakpoint
CREATE INDEX "placement_assessments_user_id_language_id_index" ON "placement_assessments" USING btree ("user_id","language_id");--> statement-breakpoint
CREATE INDEX "recordings_user_id_created_at_index" ON "recordings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "study_sessions_user_id_language_id_created_at_index" ON "study_sessions" USING btree ("user_id","language_id","created_at");--> statement-breakpoint
CREATE INDEX "units_language_id_level_code_ord_index" ON "units" USING btree ("language_id","level_code","ord");--> statement-breakpoint
CREATE INDEX "vocabulary_items_user_id_due_at_index" ON "vocabulary_items" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "vocabulary_reviews_item_id_index" ON "vocabulary_reviews" USING btree ("item_id");--> statement-breakpoint
CREATE POLICY "ai_usage_own" ON "ai_usage" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_usage"."user_id" = (select auth.uid())) WITH CHECK ("ai_usage"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "assessment_results_own" ON "assessment_results" AS PERMISSIVE FOR ALL TO "authenticated" USING ("assessment_results"."user_id" = (select auth.uid())) WITH CHECK ("assessment_results"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "conversation_messages_own" ON "conversation_messages" AS PERMISSIVE FOR ALL TO "authenticated" USING ("conversation_messages"."user_id" = (select auth.uid())) WITH CHECK ("conversation_messages"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "conversations_own" ON "conversations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("conversations"."user_id" = (select auth.uid())) WITH CHECK ("conversations"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "curriculum_levels_read" ON "curriculum_levels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "exercise_attempts_own" ON "exercise_attempts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exercise_attempts"."user_id" = (select auth.uid())) WITH CHECK ("exercise_attempts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "exercises_read" ON "exercises" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("exercises"."owner_id" is null or "exercises"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "exercises_insert_generated" ON "exercises" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("exercises"."purpose" = 'generated' and "exercises"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "languages_read" ON "languages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "lessons_read" ON "lessons" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "level_exams_read" ON "level_exams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "materials_read" ON "materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "mistake_records_own" ON "mistake_records" AS PERMISSIVE FOR ALL TO "authenticated" USING ("mistake_records"."user_id" = (select auth.uid())) WITH CHECK ("mistake_records"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "placement_assessments_own" ON "placement_assessments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("placement_assessments"."user_id" = (select auth.uid())) WITH CHECK ("placement_assessments"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "placement_skill_results_own" ON "placement_skill_results" AS PERMISSIVE FOR ALL TO "authenticated" USING ("placement_skill_results"."user_id" = (select auth.uid())) WITH CHECK ("placement_skill_results"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_own" ON "profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "progress_snapshots_own" ON "progress_snapshots" AS PERMISSIVE FOR ALL TO "authenticated" USING ("progress_snapshots"."user_id" = (select auth.uid())) WITH CHECK ("progress_snapshots"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "recordings_own" ON "recordings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("recordings"."user_id" = (select auth.uid())) WITH CHECK ("recordings"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "schedule_slots_own" ON "schedule_slots" AS PERMISSIVE FOR ALL TO "authenticated" USING ("schedule_slots"."user_id" = (select auth.uid())) WITH CHECK ("schedule_slots"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "skill_progress_own" ON "skill_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING ("skill_progress"."user_id" = (select auth.uid())) WITH CHECK ("skill_progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "study_log_own" ON "study_log" AS PERMISSIVE FOR ALL TO "authenticated" USING ("study_log"."user_id" = (select auth.uid())) WITH CHECK ("study_log"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "study_sessions_own" ON "study_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("study_sessions"."user_id" = (select auth.uid())) WITH CHECK ("study_sessions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "unit_progress_own" ON "unit_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING ("unit_progress"."user_id" = (select auth.uid())) WITH CHECK ("unit_progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "units_read" ON "units" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "user_languages_own" ON "user_languages" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_languages"."user_id" = (select auth.uid())) WITH CHECK ("user_languages"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_weaknesses_own" ON "user_weaknesses" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_weaknesses"."user_id" = (select auth.uid())) WITH CHECK ("user_weaknesses"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "vocabulary_items_own" ON "vocabulary_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vocabulary_items"."user_id" = (select auth.uid())) WITH CHECK ("vocabulary_items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "vocabulary_reviews_own" ON "vocabulary_reviews" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vocabulary_reviews"."user_id" = (select auth.uid())) WITH CHECK ("vocabulary_reviews"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "weakness_categories_read" ON "weakness_categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);