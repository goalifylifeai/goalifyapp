-- Speed up RLS: wrap auth.uid() in a scalar subquery so Postgres evaluates it
-- once per statement (an initPlan) instead of once per row, and scope every
-- policy to the authenticated role so anon requests skip them entirely.
-- auth.uid() is null for anon, so no anon request could ever match these.
-- Fixes all 38 auth_rls_initplan advisor warnings. Logic is otherwise unchanged.


-- circle_daily_status
alter policy "circle_daily_status_select_member" on public.circle_daily_status to authenticated
  using (is_circle_member(circle_id, (select auth.uid())));

-- circle_members
alter policy "circle_members_insert_self" on public.circle_members to authenticated
  with check ((user_id = (select auth.uid())));
alter policy "circle_members_select_member" on public.circle_members to authenticated
  using (is_circle_member(circle_id, (select auth.uid())));

-- circles
alter policy "circles_insert_own" on public.circles to authenticated
  with check ((created_by = (select auth.uid())));
alter policy "circles_select_member_or_creator" on public.circles to authenticated
  using ((is_circle_member(id, (select auth.uid())) OR (created_by = (select auth.uid()))));

-- coach_insights
alter policy "coach_insights_select_own" on public.coach_insights to authenticated
  using (((select auth.uid()) = user_id));

-- daily_intentions
alter policy "daily_intentions_insert_own" on public.daily_intentions to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "daily_intentions_select_own" on public.daily_intentions to authenticated
  using (((select auth.uid()) = user_id));
alter policy "daily_intentions_update_own" on public.daily_intentions to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- future_self_letters
alter policy "future_letters_insert_own" on public.future_self_letters to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "future_letters_select_own" on public.future_self_letters to authenticated
  using (((select auth.uid()) = user_id));

-- goal_subtasks
alter policy "goal_subtasks_delete_own" on public.goal_subtasks to authenticated
  using (((select auth.uid()) = user_id));
alter policy "goal_subtasks_insert_own" on public.goal_subtasks to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "goal_subtasks_select_own" on public.goal_subtasks to authenticated
  using (((select auth.uid()) = user_id));
alter policy "goal_subtasks_update_own" on public.goal_subtasks to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- goals
alter policy "goals_delete_own" on public.goals to authenticated
  using (((select auth.uid()) = user_id));
alter policy "goals_insert_own" on public.goals to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "goals_select_own" on public.goals to authenticated
  using (((select auth.uid()) = user_id));
alter policy "goals_update_own" on public.goals to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- habit_logs
alter policy "habit_logs_delete_own" on public.habit_logs to authenticated
  using (((select auth.uid()) = user_id));
alter policy "habit_logs_insert_own" on public.habit_logs to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "habit_logs_select_own" on public.habit_logs to authenticated
  using (((select auth.uid()) = user_id));
alter policy "habit_logs_update_own" on public.habit_logs to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- habits
alter policy "habits_delete_own" on public.habits to authenticated
  using (((select auth.uid()) = user_id));
alter policy "habits_insert_own" on public.habits to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "habits_select_own" on public.habits to authenticated
  using (((select auth.uid()) = user_id));
alter policy "habits_update_own" on public.habits to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- journal_entries
alter policy "journal_entries_delete_own" on public.journal_entries to authenticated
  using (((select auth.uid()) = user_id));
alter policy "journal_entries_insert_own" on public.journal_entries to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "journal_entries_select_own" on public.journal_entries to authenticated
  using (((select auth.uid()) = user_id));
alter policy "journal_entries_update_own" on public.journal_entries to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- onboarding_state
alter policy "onboarding_select_own" on public.onboarding_state to authenticated
  using (((select auth.uid()) = user_id));
alter policy "onboarding_update_own" on public.onboarding_state to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- profiles
alter policy "profiles_select_own" on public.profiles to authenticated
  using (((select auth.uid()) = user_id));
alter policy "profiles_update_own" on public.profiles to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

-- vision_assets
alter policy "vision_assets_insert_own" on public.vision_assets to authenticated
  with check (((select auth.uid()) = user_id));
alter policy "vision_assets_select_own" on public.vision_assets to authenticated
  using (((select auth.uid()) = user_id));
alter policy "vision_assets_update_own" on public.vision_assets to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));
