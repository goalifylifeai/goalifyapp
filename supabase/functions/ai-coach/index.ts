// Supabase Edge Function (Deno runtime)
// Generates real, data-grounded coaching content (insights, weekly reflection,
// chat replies) by loading the caller's own goals/habits/journal and asking
// an LLM via the Vercel AI Gateway to reason over it. Insights and weekly
// reflection are cached in `coach_insights`; chat replies are stateless.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeQuotas, getPlan, type Limit, type Plan } from '../_shared/plan.ts';

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-5';
// How long a generated result is served from coach_insights before the next
// app open regenerates it. The app requests both on every launch, so these
// windows are what bound the automatic LLM spend. Free insights are kept for
// 10 days so their 3/month allowance spreads across the month.
const CACHE_TTL_MS: Record<Plan, Record<'insights' | 'weekly', number>> = {
  free:   { insights: 10 * 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 },
  beyond: { insights:      24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 },
};
// `force` can only bypass a cache entry at least this old, so a client can't
// loop regenerations.
const FORCE_MIN_AGE_MS = 15 * 60 * 1000;
const MAX_CHAT_MESSAGE_CHARS = 1000;

// LLM-call limits per plan (UTC windows), enforced via consume_ai_quotas
// (migration 0020). Cache hits don't count.
const LIMITS: Record<Plan, Record<Mode, Limit[]>> = {
  free: {
    chat:              [{ limit: 10, window: 'total' }],
    insights:          [{ limit: 3, window: 'month' }],
    weekly:            [{ limit: 1, window: 'week' }],
    'nudge-streak':    [{ limit: 1, window: 'day' }],
    'nudge-sentiment': [{ limit: 1, window: 'day' }],
  },
  beyond: {
    chat:              [{ limit: 20, window: 'day' }, { limit: 150, window: 'month' }],
    insights:          [{ limit: 1, window: 'day' }],
    weekly:            [{ limit: 1, window: 'week' }],
    'nudge-streak':    [{ limit: 1, window: 'day' }],
    'nudge-sentiment': [{ limit: 1, window: 'day' }],
  },
};

const CORS_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

type Mode = 'insights' | 'weekly' | 'chat' | 'nudge-streak' | 'nudge-sentiment';

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function callGateway(apiKey: string, system: string, user: string, maxTokens = 1200): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.6,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`AI Gateway error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('AI Gateway returned no content');
  return text;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!AI_GATEWAY_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI_GATEWAY_API_KEY not configured' }), { status: 500 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as { mode: Mode; message?: string; force?: boolean };
  const { mode, message, force = false } = body;
  if (!mode || !Object.hasOwn(LIMITS.free, mode)) return json({ error: 'valid mode required' }, 400);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const plan = await getPlan(adminClient, user.id);
  const consume = () => consumeQuotas(adminClient, user.id, `coach:${mode}`, LIMITS[plan][mode]);

  if (mode === 'chat') {
    if (!message?.trim()) return json({ error: 'message required' }, 400);
    if (message.length > MAX_CHAT_MESSAGE_CHARS) {
      return json({ error: 'message_too_long', message: `Keep questions under ${MAX_CHAT_MESSAGE_CHARS} characters.` }, 400);
    }
  }

  // Serve cached content for insights/weekly if fresh enough, and fall back to
  // it (however old) once the daily generation quota is spent.
  if (mode === 'insights' || mode === 'weekly') {
    const { data: cached } = await adminClient
      .from('coach_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', mode)
      .maybeSingle();
    const age = cached ? Date.now() - new Date(cached.generated_at as string).getTime() : Infinity;
    const minAge = force ? FORCE_MIN_AGE_MS : CACHE_TTL_MS[plan][mode];
    if (cached && age < minAge) return json(cached);
    if (await consume()) {
      return cached ? json(cached) : json({ error: 'rate_limited', message: 'Your coach has done enough thinking for now. Check back soon.' }, 429);
    }
  }

  // Load the caller's real data (server-side, never trust client-supplied context).
  const since = daysAgoISO(30);
  const [{ data: goals }, { data: subtasks }, { data: habits }, { data: logs }, { data: journal }] = await Promise.all([
    adminClient.from('goals').select('id,sphere,title,due_date').eq('user_id', user.id),
    adminClient.from('goal_subtasks').select('goal_id,text,done').eq('user_id', user.id),
    adminClient.from('habits').select('id,label,sphere,target_description').eq('user_id', user.id),
    adminClient.from('habit_logs').select('habit_id,date,done').eq('user_id', user.id).gte('date', since),
    adminClient.from('journal_entries').select('date,sentiment,excerpt').eq('user_id', user.id).gte('date', since).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(30),
  ]);

  const context = {
    goals: (goals ?? []).map(g => ({
      ...g,
      subtasks: (subtasks ?? []).filter(s => s.goal_id === g.id),
    })),
    habits: (habits ?? []).map(h => ({
      ...h,
      recent_logs: (logs ?? []).filter(l => l.habit_id === h.id),
    })),
    journal_last_30_days: journal ?? [],
  };

  const hasAnyData = context.goals.length > 0 || context.habits.length > 0 || context.journal_last_30_days.length > 0;

  const system = 'You are a calm, precise personal-growth coach embedded in an app called Goalify. ' +
    'You are given a user\'s real goals, habits (with recent completion logs), and recent journal entries. ' +
    'Ground every claim strictly in this data — never invent facts, streaks, or numbers not present in it. ' +
    'If the data is sparse, say so plainly rather than fabricating a pattern. ' +
    'Respond with ONLY valid JSON, no prose outside the JSON, no markdown fences.';

  try {
    if (mode === 'chat') {
      const blocked = await consume();
      if (blocked === 'error') {
        return json({ error: 'quota_unavailable' }, 503);
      }
      if (blocked === 'total') {
        return json({
          error: 'rate_limited', upgrade: true,
          message: "You've used your 10 free messages with your coach. Upgrade to Goalify Beyond to keep chatting.",
        }, 429);
      }
      if (blocked === 'day') {
        return json({ error: 'rate_limited', message: "You've reached today's 20 coach messages. Your coach will be back tomorrow." }, 429);
      }
      if (blocked) {
        return json({ error: 'rate_limited', message: "You've used this month's 150 coach messages. They reset on the 1st." }, 429);
      }
      const chatSystem = system.replace('Respond with ONLY valid JSON, no prose outside the JSON, no markdown fences.',
        'Respond with a single short, warm, specific paragraph (2-4 sentences) as plain text, not JSON.');
      const reply = await callGateway(
        AI_GATEWAY_API_KEY,
        chatSystem,
        `User's data:\n${JSON.stringify(context)}\n\nUser's question: ${message!.trim()}`,
        400,
      );
      return new Response(JSON.stringify({ reply: reply.trim() }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (mode === 'insights') {
      const prompt = hasAnyData
        ? `User's data:\n${JSON.stringify(context)}\n\nReturn JSON: { "insights": [ { "kind": "pattern"|"nudge"|"win", "title": string, "body": string } ] }. Return 2-4 insights, each grounded in a specific fact from the data.`
        : `The user has no goals, habits, or journal entries yet. Return JSON: { "insights": [ { "kind": "nudge", "title": string, "body": string } ] } with exactly one warm, encouraging insight suggesting they add their first goal or habit.`;
      const text = await callGateway(AI_GATEWAY_API_KEY, system, prompt);
      const parsed = extractJson(text) as { insights: unknown };

      const { data: saved } = await adminClient
        .from('coach_insights')
        .upsert({ user_id: user.id, kind: 'insights', content: parsed, model: MODEL, generated_at: new Date().toISOString() }, { onConflict: 'user_id,kind' })
        .select()
        .single();

      return new Response(JSON.stringify(saved), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (mode === 'nudge-streak') {
      const today = daysAgoISO(0);
      const [{ data: todayRow }, { data: history }] = await Promise.all([
        adminClient.from('daily_intentions').select('must_do_done').eq('user_id', user.id).eq('date', today).maybeSingle(),
        adminClient.from('daily_intentions').select('date,must_do_done,closed_at').eq('user_id', user.id).gte('date', since).lt('date', today),
      ]);

      if (todayRow?.must_do_done) {
        return new Response(JSON.stringify({ shouldNudge: false }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Mirrors lib/date.ts's streakFromDates: consecutive active days ending yesterday.
      const activeDates = new Set((history ?? []).filter(r => r.must_do_done || r.closed_at).map(r => r.date as string));
      let cursor = daysAgoISO(1);
      let streak = 0;
      while (activeDates.has(cursor)) {
        streak++;
        const d = new Date(`${cursor}T00:00:00`);
        d.setDate(d.getDate() - 1);
        cursor = d.toISOString().slice(0, 10);
      }

      if (streak === 0 || await consume()) {
        return json({ shouldNudge: false });
      }

      const prompt = `The user has a ${streak}-day streak of showing up for their daily ritual, and has not yet completed today's must-do action. Return JSON: { "title": string (max 40 chars), "body": string (max 100 chars) } — a warm, specific, non-guilt-tripping evening nudge that mentions the streak and encourages finishing today's must-do.`;
      const text = await callGateway(AI_GATEWAY_API_KEY, system, prompt);
      const parsed = extractJson(text) as { title: string; body: string };

      return new Response(JSON.stringify({ shouldNudge: true, ...parsed }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (mode === 'nudge-sentiment') {
      const recent = context.journal_last_30_days.slice(0, 5) as { date: string; sentiment: number }[];

      // Require at least 3 entries getting steadily lower over time, with the
      // latest clearly low. `recent` is newest-first, so each older entry must
      // be >= the one after it.
      const trendingDown = recent.length >= 3
        && recent.slice(0, 3).every((entry, i, arr) => i === 0 || entry.sentiment >= arr[i - 1].sentiment)
        && recent[0].sentiment < -0.1;

      if (!trendingDown || await consume()) {
        return json({ shouldNudge: false });
      }

      const prompt = `The user's last 3 journal entries have trended toward lower sentiment (most recent first): ${JSON.stringify(recent.slice(0, 3))}. Return JSON: { "title": string (max 40 chars), "body": string (max 100 chars) } — a gentle, non-clinical check-in nudge. Never diagnose or use clinical language; just invite them to check in.`;
      const text = await callGateway(AI_GATEWAY_API_KEY, system, prompt);
      const parsed = extractJson(text) as { title: string; body: string };

      return new Response(JSON.stringify({ shouldNudge: true, ...parsed }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // mode === 'weekly'
    const prompt = hasAnyData
      ? `User's data (last 30 days):\n${JSON.stringify(context)}\n\nReturn JSON: { "period": string (e.g. "Last 7 days"), "stats": [ { "n": string, "l": string } ] (3 short stat tiles), "quote": string (one reflective sentence in second person, present tense), "wins": [ { "t": string, "s": sphere } ], "challenges": [ { "t": string, "s": sphere } ], "next_step": { "title": string, "when": string } }. sphere must be one of finance, health, career, relationships. Base every item strictly on the data; if there isn't enough for a category, return an empty array for it.`
      : `The user has no data yet. Return JSON: { "period": "This week", "stats": [], "quote": "Your week in review will appear here once you start logging goals, habits, or journal entries.", "wins": [], "challenges": [], "next_step": { "title": "Add your first goal or habit", "when": "Today" } }.`;
    const text = await callGateway(AI_GATEWAY_API_KEY, system, prompt);
    const parsed = extractJson(text);

    const { data: saved } = await adminClient
      .from('coach_insights')
      .upsert({ user_id: user.id, kind: 'weekly', content: parsed, model: MODEL, generated_at: new Date().toISOString() }, { onConflict: 'user_id,kind' })
      .select()
      .single();

    return new Response(JSON.stringify(saved), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
