-- Private bucket for generated vision images. 0005 only described this in a
-- comment, so it was never created and every upload from generate-vision failed.
--
-- Objects live at `<user_id>/<goal_id>/stage_<n>.jpg`. The edge function
-- uploads with the service role (bypasses RLS); users only need to read their
-- own folder so the app can create signed URLs.

insert into storage.buckets (id, name, public)
values ('vision-assets', 'vision-assets', false)
on conflict (id) do nothing;

drop policy if exists "vision_assets_read_own" on storage.objects;
create policy "vision_assets_read_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vision-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
