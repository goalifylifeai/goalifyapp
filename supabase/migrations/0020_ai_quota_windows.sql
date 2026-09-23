-- Plan-based AI limits need windows other than "per day" (e.g. 10 coach
-- messages ever on Free, 150/month on Beyond) and sometimes several limits on
-- one action (Beyond chat: 20/day AND 150/month).
--
-- consume_ai_quotas checks every limit first and only then counts the call
-- against all of them, atomically, so a call blocked by one limit never uses
-- up another. Each window gets its own ai_usage row: `day` holds the start of
-- the window and `kind` is suffixed with the window name, so a monthly bucket
-- and a daily bucket that both start on the 1st never collide.
--
-- p_limits: [{"limit": 20, "window": "day"}, {"limit": 150, "window": "month"}]
-- window: 'day' | 'week' | 'month' | 'total'   (UTC)
-- Returns null when allowed, otherwise the window that blocked the call.

create or replace function public.consume_ai_quotas(p_user_id uuid, p_kind text, p_limits jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l jsonb;
  win text;
  bucket date;
  bucket_kind text;
  used integer;
begin
  -- Pass 1: lock each bucket and check it.
  for l in select value from jsonb_array_elements(p_limits) loop
    win := l->>'window';
    bucket := case win
      when 'day'   then current_date
      when 'week'  then date_trunc('week', current_date)::date
      when 'month' then date_trunc('month', current_date)::date
      when 'total' then date '2000-01-01'
    end;
    if bucket is null then
      raise exception 'consume_ai_quotas: unknown window %', win;
    end if;
    bucket_kind := p_kind || '/' || win;

    insert into public.ai_usage (user_id, day, kind, count)
    values (p_user_id, bucket, bucket_kind, 0)
    on conflict (user_id, day, kind) do nothing;

    select count into used from public.ai_usage
    where user_id = p_user_id and day = bucket and kind = bucket_kind
    for update;

    if used >= (l->>'limit')::integer then
      return win;
    end if;
  end loop;

  -- Pass 2: every limit has room, so count this call against all of them.
  for l in select value from jsonb_array_elements(p_limits) loop
    win := l->>'window';
    update public.ai_usage
    set count = count + 1
    where user_id = p_user_id
      and kind = p_kind || '/' || win
      and day = case win
        when 'day'   then current_date
        when 'week'  then date_trunc('week', current_date)::date
        when 'month' then date_trunc('month', current_date)::date
        when 'total' then date '2000-01-01'
      end;
  end loop;

  return null;
end;
$$;

revoke all on function public.consume_ai_quotas(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.consume_ai_quotas(uuid, text, jsonb) to service_role;
