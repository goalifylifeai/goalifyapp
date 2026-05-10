import type { SphereId } from '../constants/theme';
import type { VisionStage } from './vision-stage';

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
