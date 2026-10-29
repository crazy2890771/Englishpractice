-- Fluency Lab: base data, new-user bootstrap, storage and hardening.

-- Supported languages (content is seeded separately by `npm run db:seed`).
INSERT INTO public.languages (id, name_en, name_th, framework, levels, enabled) VALUES
  ('en', 'English', 'ภาษาอังกฤษ', 'CEFR', ARRAY['A1','A2','B1','B2','C1','C2'], true),
  ('zh', 'Mandarin Chinese', 'ภาษาจีนกลาง', 'HSK 3.0', ARRAY['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7','HSK8','HSK9'], true)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- When someone signs up: create their profile, languages and the default weekly schedule.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'name', split_part(coalesce(NEW.email, ''), '@', 1)));

  INSERT INTO public.user_languages (user_id, language_id) VALUES (NEW.id, 'en'), (NEW.id, 'zh');

  -- Default schedule (0 = Sunday … 6 = Saturday)
  INSERT INTO public.schedule_slots (user_id, weekday, language_id, skills, position) VALUES
    (NEW.id, 0, 'en', ARRAY['listening','speaking'], 0),
    (NEW.id, 1, 'en', ARRAY['reading','writing'], 0),
    (NEW.id, 2, 'zh', ARRAY['listening','speaking'], 0),
    (NEW.id, 3, 'zh', ARRAY['reading','writing'], 0),
    (NEW.id, 4, 'en', ARRAY['listening','speaking'], 0),
    (NEW.id, 5, 'en', ARRAY['reading','writing'], 0),
    (NEW.id, 6, 'en', ARRAY['vocabulary'], 0),
    (NEW.id, 6, 'zh', ARRAY['vocabulary'], 1);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- Private bucket for speaking recordings: users can only touch files under "<their user id>/…".
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recordings', 'recordings', false, 10485760, ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac','audio/x-m4a'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "recordings_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint
CREATE POLICY "recordings_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recordings' AND (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint
CREATE POLICY "recordings_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint

-- Defence in depth: the public (anon) API key gets no table access at all.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
