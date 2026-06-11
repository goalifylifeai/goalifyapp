import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from '../lib/widget-snapshot';

// Mirrors constants/theme.ts.
const PAPER = '#F4EFE6';
const INK1 = '#1F1B17';
const INK3 = '#7C7166';

const SPHERE_ACCENT: Record<string, `#${string}`> = {
  finance: '#4E7A56',
  health: '#A86432',
  career: '#4C5E9C',
  relationships: '#964060',
};

export function GoalifyMediumWidget({ snapshot }: { snapshot: WidgetSnapshot | null }) {
  const one = snapshot?.oneText;
  const accent = SPHERE_ACCENT[snapshot?.focusSphere ?? ''] ?? '#B5703B';

  return (
    <FlexWidget
      clickAction="OPEN_RITUAL"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: PAPER,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget text="TODAY'S ONE" style={{ fontSize: 10, letterSpacing: 2, color: INK3, fontFamily: 'monospace' }} />
        {snapshot && snapshot.streak > 0 ? (
          <TextWidget text={`${snapshot.streak}🔥`} style={{ fontSize: 12, color: INK1, fontFamily: 'monospace' }} />
        ) : (
          <FlexWidget />
        )}
      </FlexWidget>

      <TextWidget
        text={one && one.length > 0 ? one : "Open Goalify to set today's One."}
        style={{ fontSize: one ? 20 : 15, color: one ? INK1 : INK3, fontFamily: 'serif' }}
      />

      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <FlexWidget style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: accent, marginRight: 6 }} />
        <TextWidget
          text={snapshot?.oneDone ? 'Done for today' : 'Tap to complete'}
          style={{ fontSize: 11, color: INK3, fontFamily: 'monospace' }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
