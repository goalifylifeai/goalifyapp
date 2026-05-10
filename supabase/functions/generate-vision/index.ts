// Supabase Edge Function (Deno runtime)
// Generates 4 vision images per goal via fal.ai and stores them in Supabase Storage.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SphereId = 'finance' | 'health' | 'career' | 'relationships';
type VisionStage = 0 | 1 | 2 | 3;

const STYLE = 'soft film grain, analog warmth, shallow depth of field, editorial still photography, no text, no logos, no faces, 4:3 crop, no horror, no sadness, no violence';

const SCENES: Record<SphereId, Record<VisionStage, string>> = {
  finance: {
    0: 'Cluttered kitchen table with unopened envelopes, warm morning light through a window',
    1: 'Kitchen table half-cleared, two open letters side by side, a coffee cup, morning light',
    2: 'Kitchen table clear, one bill stamped PAID in red, a sun patch on the wooden surface',
    3: 'Kitchen window with linen curtain, empty table beneath it, a small plant, quiet confidence',
  },
  health: {
    0: 'Empty running shoes by a door, first light of dawn on hardwood floor',
    1: 'Empty road at 6 AM, morning mist, one runner silhouette far in the distance',
    2: 'Runner mid-stride through open fields, golden hour light, long shadow behind them',
    3: 'Finish line tape, quiet supportive crowd, arms wide open, triumphant moment',
  },
  career: {
    0: 'Blank notebook open on a clean desk, half-sharpened pencil, grey morning light',
    1: 'Notebook with rough sketches and sticky notes, coffee ring, focused creative energy',
    2: 'Laptop showing a working prototype, person hands on keyboard, concentrated focus',
    3: 'Design review meeting, colleagues nodding, warm office light, laptop with shipped product',
  },
  relationships: {
    0: 'Empty dining table set for six, unlit candles, folded napkins, late afternoon light',
    1: 'Same table with two people deep in conversation, warm lamp light, leaning in close',
    2: 'Table full of friends laughing, wine raised, warm blur of a good evening',
    3: 'Two pairs of hands clasped across the table, candle burned low, quiet warmth',
  },
};

function buildPrompt(sphere: SphereId, stage: VisionStage): string {
  return `${SCENES[sphere][stage]}, ${STYLE}`;
}

function promptHash(prompt: string): string {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) {
    h = (Math.imul(31, h) + prompt.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function seedFromGoalId(goalId: string): number {
  let hash = 5381;
  for (let i = 0; i < goalId.length; i++) {
    hash = ((hash << 5) + hash) ^ goalId.charCodeAt(i);
    hash = hash >>> 0;
  }
  return (hash % 2_147_483_647) + 1;
}

const REGEN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const FAL_API_KEY = Deno.env.get('FAL_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!FAL_API_KEY) {
    return new Response(JSON.stringify({ error: 'FAL_API_KEY not configured' }), { status: 500 });
  }

  // Authenticate caller.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as {
    goal_id: string;
    goal_title: string;
    sphere: SphereId;
    regen?: boolean;
    regen_stage?: VisionStage;
  };

  const { goal_id, sphere, regen = false, regen_stage } = body;
  if (!goal_id || !sphere) {
    return new Response(JSON.stringify({ error: 'goal_id and sphere required' }), { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const seed = seedFromGoalId(goal_id);
  const stages: VisionStage[] = regen && regen_stage !== undefined ? [regen_stage] : [0, 1, 2, 3];

  // Load existing rows to check idempotency and rate limits.
  const { data: existing } = await adminClient
    .from('vision_assets')
    .select('*')
    .eq('user_id', user.id)
    .eq('goal_id', goal_id);

  const existingMap = new Map<VisionStage, Record<string, unknown>>();
  for (const row of existing ?? []) {
    existingMap.set(row.stage as VisionStage, row as Record<string, unknown>);
  }

  const results: Record<string, unknown>[] = [];

  for (const stage of stages) {
    const prompt = buildPrompt(sphere, stage);
    const hash = promptHash(prompt);
    const existingRow = existingMap.get(stage);

    // Idempotency: skip if already ready with the same prompt.
    if (!regen && existingRow?.status === 'ready' && existingRow?.prompt_hash === hash) {
      results.push(existingRow);
      continue;
    }

    // Rate limit for regens (free tier: 7-day cooldown).
    if (regen && existingRow?.last_regen_at) {
      const lastRegen = new Date(existingRow.last_regen_at as string).getTime();
      if (Date.now() - lastRegen < REGEN_COOLDOWN_MS) {
        results.push({ ...(existingRow ?? {}), error: 'regen_rate_limited' });
        continue;
      }
    }

    // Mark as generating.
    const { data: upserted } = await adminClient
      .from('vision_assets')
      .upsert({
        user_id: user.id,
        goal_id,
        stage,
        status: 'generating',
        prompt_hash: hash,
        seed,
        storage_path: (existingRow?.storage_path as string) ?? '',
      }, { onConflict: 'user_id,goal_id,stage' })
      .select()
      .single();

    // Call fal.ai synchronous endpoint.
    let imageUrl: string | null = null;
    try {
      const falRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          seed,
          image_size: 'landscape_4_3',
          num_inference_steps: 4,
          num_images: 1,
          enable_safety_checker: true,
        }),
      });
      if (falRes.ok) {
        const falData = await falRes.json() as { images?: { url: string }[] };
        imageUrl = falData.images?.[0]?.url ?? null;
      }
    } catch (_) {
      // fal.ai call failed — mark error below.
    }

    if (!imageUrl) {
      await adminClient.from('vision_assets').update({
        status: 'error',
        error_msg: 'Image generation failed',
      }).eq('user_id', user.id).eq('goal_id', goal_id).eq('stage', stage);
      results.push({ ...(upserted ?? {}), status: 'error' });
      continue;
    }

    // Download image and upload to Supabase Storage.
    const storagePath = `${user.id}/${goal_id}/stage_${stage}.jpg`;
    let uploadOk = false;
    try {
      const imgRes = await fetch(imageUrl);
      const imgBlob = await imgRes.blob();
      const { error: uploadErr } = await adminClient.storage
        .from('vision-assets')
        .upload(storagePath, imgBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      uploadOk = !uploadErr;
    } catch (_) {
      // Upload failed.
    }

    const finalStatus = uploadOk ? 'ready' : 'error';
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: finalStatus,
      storage_path: uploadOk ? storagePath : '',
      generated_at: uploadOk ? now : null,
      error_msg: uploadOk ? null : 'Storage upload failed',
    };
    if (regen) {
      updatePayload.last_regen_at = now;
      updatePayload.regen_count = ((existingRow?.regen_count as number) ?? 0) + 1;
    }

    const { data: finalRow } = await adminClient
      .from('vision_assets')
      .update(updatePayload)
      .eq('user_id', user.id)
      .eq('goal_id', goal_id)
      .eq('stage', stage)
      .select()
      .single();

    results.push(finalRow ?? { ...upserted, ...updatePayload });
  }

  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
