import type { SphereId } from '../constants/theme';
import type { VisionStage } from './vision-stage';

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

export type PromptContext = {
  sphere: SphereId;
  stage: VisionStage;
};

export function buildPrompt(ctx: PromptContext): string {
  return `${SCENES[ctx.sphere][ctx.stage]}, ${STYLE}`;
}

export function promptHash(prompt: string): string {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) {
    h = Math.imul(31, h) + prompt.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
