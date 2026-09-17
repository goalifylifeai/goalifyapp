// Supabase Edge Function (Deno runtime)
// Generates real, data-grounded coaching content (insights, weekly reflection,
// chat replies) by loading the caller's own goals/habits/journal and asking
// an LLM via the Vercel AI Gateway to reason over it. Insights and weekly
// reflection are cached in `coach_insights`; chat replies are stateless.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-5';
const CACHE_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

type Mode = 'insights' | 'weekly' | 'chat';

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function callGateway(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 1200,
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
  if (!mode) return new Response(JSON.stringify({ error: 'mode required' }), { status: 400 });

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Serve cached content for insights/weekly if fresh enough.
  if (mode === 'insights' || mode === 'weekly') {
    if (!force) {
      const { data: cached } = await adminClient
        .from('coach_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', mode)
        .maybeSingle();
      if (cached && Date.now() - new Date(cached.generated_at as string).getTime() < CACHE_COOLDOWN_MS) {
        return new Response(JSON.stringify(cached), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  }

  // Load the caller's real data (server-side, never trust client-supplied context).
  const since = daysAgoISO(30);
  const [{ data: goals }, { data: subtasks }, { data: habits }, { data: logs }, { data: journal }] = await Promise.all([
    adminClient.from('goals').select('id,sphere,title,due_date').eq('user_id', user.id),
    adminClient.from('goal_subtasks').select('goal_id,text,done').eq('user_id', user.id),
    adminClient.from('habits').select('id,label,sphere,target_description').eq('user_id', user.id),
    adminClient.from('habit_logs').select('habit_id,date,done').eq('user_id', user.id).gte('date', since),
    adminClient.from('journal_entries').select('date,sentiment,excerpt').eq('user_id', user.id).gte('date', since).order('date', { ascending: false }).limit(30),
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
      if (!message?.trim()) return new Response(JSON.stringify({ error: 'message required' }), { status: 400 });
      const chatSystem = system.replace('Respond with ONLY valid JSON, no prose outside the JSON, no markdown fences.',
        'Respond with a single short, warm, specific paragraph (2-4 sentences) as plain text, not JSON.');
      const reply = await callGateway(
        AI_GATEWAY_API_KEY,
        chatSystem,
        `User's data:\n${JSON.stringify(context)}\n\nUser's question: ${message.trim()}`,
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
