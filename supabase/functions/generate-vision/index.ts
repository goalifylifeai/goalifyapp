// Supabase Edge Function (Deno runtime)
// Generates one vision image per goal (the final "arriving" stage) via fal.ai
// and stores it in Supabase Storage.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeQuotas, getPlan, type Limit, type Plan } from '../_shared/plan.ts';

type SphereId = 'finance' | 'health' | 'career' | 'relationships';
type VisionStage = 0 | 1 | 2 | 3;

// Describe only what should be in the frame: FLUX has no negative prompt, so
// "no text / no faces" tends to pull those in. Scenes are people-free still
// lifes (AI faces, hands and lettering look wrong) that imply the goal is done,
// with quiet space low in the frame where the app overlays its caption.
const STYLE = 'calm editorial still-life photograph, soft natural light, gentle film grain, warm muted palette of cream, sand and honey brown, shallow depth of field, uncluttered composition with quiet empty space in the lower third, peaceful and hopeful mood';

const SCENES: Record<SphereId, Record<VisionStage, string>> = {
  finance: {
    0: 'Cluttered kitchen table with unopened envelopes, warm morning light through a window',
    1: 'Kitchen table half-cleared, two open letters side by side, a coffee cup, morning light',
    2: 'Kitchen table clear, one bill stamped PAID in red, a sun patch on the wooden surface',
    3: 'A glass jar filled with coins beside a thriving green potted plant on a sunlit wooden windowsill, a linen curtain glowing in morning light, a feeling of quiet security',
  },
  health: {
    0: 'Empty running shoes by a door, first light of dawn on hardwood floor',
    1: 'Empty road at 6 AM, morning mist, one runner silhouette far in the distance',
    2: 'Runner mid-stride through open fields, golden hour light, long shadow behind them',
    3: 'A pair of well-worn running shoes resting on a wooden porch step at sunrise, a water bottle beside them, an empty country road glowing gold in the distance, dew on the grass',
  },
  career: {
    0: 'Blank notebook open on a clean desk, half-sharpened pencil, grey morning light',
    1: 'Notebook with rough sketches and sticky notes, coffee ring, focused creative energy',
    2: 'Laptop showing a working prototype, person hands on keyboard, concentrated focus',
    3: 'A tidy wooden desk by a large window at golden hour, an open sketchbook, a closed laptop, a cup of tea and a small vase of fresh flowers celebrating finished work',
  },
  relationships: {
    0: 'Empty dining table set for six, unlit candles, folded napkins, late afternoon light',
    1: 'Same table with two people deep in conversation, warm lamp light, leaning in close',
    2: 'Table full of friends laughing, wine raised, warm blur of a good evening',
    3: 'A long wooden dining table after a warm dinner with friends, empty wine glasses, crumpled linen napkins, candles burned low, chairs pushed back, soft lamplight',
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
// Only the final stage is generated — one image per goal. SCENES keeps the
// earlier stages for reference/rows generated before this change.
const FINAL_STAGE: VisionStage = 3;

// Images generated per user, per plan (UTC windows), enforced via
// consume_ai_quotas (migration 0020); idempotent hits don't count. 6/day is a
// burst guard; the monthly cap is the real ceiling.
const IMAGE_LIMITS: Record<Plan, Limit[]> = {
  free:   [{ limit: 6, window: 'day' }, { limit: 10, window: 'month' }],
  beyond: [{ limit: 6, window: 'day' }, { limit: 30, window: 'month' }],
};

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
  };

  const { goal_id, regen = false } = body;
  if (!goal_id) {
    return new Response(JSON.stringify({ error: 'goal_id required' }), { status: 400 });
  }
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const plan = await getPlan(adminClient, user.id);

  // Regenerating (a second image for the same goal) is a Beyond feature, so
  // Free users get exactly one image per goal.
  if (regen && plan !== 'beyond') {
    return new Response(JSON.stringify({ error: 'pro_required' }), { status: 403 });
  }

  // Only generate for a goal the caller owns; take the sphere from the row,
  // not the request, so the client can't fan out arbitrary generations.
  const { data: goalRow } = await adminClient
    .from('goals')
    .select('sphere')
    .eq('id', goal_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!goalRow) {
    return new Response(JSON.stringify({ error: 'goal not found' }), { status: 404 });
  }
  const sphere = goalRow.sphere as SphereId;
  const seed = seedFromGoalId(goal_id);
  const stages: VisionStage[] = [FINAL_STAGE];

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

    // Rate limit for regens (7-day cooldown per image).
    if (regen && existingRow?.last_regen_at) {
      const lastRegen = new Date(existingRow.last_regen_at as string).getTime();
      if (Date.now() - lastRegen < REGEN_COOLDOWN_MS) {
        results.push({ ...(existingRow ?? {}), error: 'regen_rate_limited' });
        continue;
      }
    }

    if (await consumeQuotas(adminClient, user.id, 'vision:image', IMAGE_LIMITS[plan])) {
      results.push({ goal_id, stage, status: 'pending', ...(existingRow ?? {}), error: 'image_limit' });
      continue;
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
    let failure = '';
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
        if (!imageUrl) failure = 'fal returned no image';
      } else {
        failure = `fal ${falRes.status}: ${(await falRes.text()).slice(0, 300)}`;
      }
    } catch (err) {
      failure = `fal request failed: ${(err as Error).message}`;
    }

    if (!imageUrl) {
      console.error('generate-vision', goal_id, failure);
      await adminClient.from('vision_assets').update({
        status: 'error',
        error_msg: failure || 'Image generation failed',
      }).eq('user_id', user.id).eq('goal_id', goal_id).eq('stage', stage);
      results.push({ ...(upserted ?? {}), status: 'error' });
      continue;
    }

    // Download image and upload to Supabase Storage.
    const storagePath = `${user.id}/${goal_id}/stage_${stage}.jpg`;
    let uploadOk = false;
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`image download ${imgRes.status}`);
      const imgBlob = await imgRes.blob();
      const { error: uploadErr } = await adminClient.storage
        .from('vision-assets')
        .upload(storagePath, imgBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      uploadOk = !uploadErr;
      if (uploadErr) failure = `storage upload: ${uploadErr.message}`;
    } catch (err) {
      failure = `upload failed: ${(err as Error).message}`;
    }
    if (!uploadOk) console.error('generate-vision', goal_id, failure);

    const finalStatus = uploadOk ? 'ready' : 'error';
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: finalStatus,
      storage_path: uploadOk ? storagePath : '',
      generated_at: uploadOk ? now : null,
      error_msg: uploadOk ? null : (failure || 'Storage upload failed'),
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
