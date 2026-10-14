import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { COLORS, SPHERE_COLORS } from '../constants/theme';
import type { SphereId } from '../constants/theme';
import { SPHERE_EMPTY_NUDGES, sphereNudge } from '../constants/data';
import { getSphereNudgeSnoozedUntil, isSphereNudgeSnoozed, snoozeSphereNudge } from '../lib/sphere-nudge-snooze';
import { track } from '../lib/analytics';
import { Card, SphereChip, F } from './ui';

type Props = {
  sphereData: Record<SphereId, { count: number }>;
  onAddGoal: (sphere: SphereId) => void;
};

// Home-screen nudge toward spheres that have no goal yet. Renders nothing
// unless at least one sphere is started and at least one is empty, so the
// zero-goals state stays owned by the overview card. "Not now" hides it for
// SPHERE_NUDGE_SNOOZE_DAYS (persisted per device).
export function SphereNudge({ sphereData, onAddGoal }: Props) {
  const nudge = sphereNudge(sphereData);
  // undefined = not loaded yet; render nothing until we know, to avoid a flash.
  const [snoozedUntil, setSnoozedUntil] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getSphereNudgeSnoozedUntil().then(v => { if (alive) setSnoozedUntil(v); });
    return () => { alive = false; };
  }, []);

  const variant = nudge.kind === 'none' ? null : nudge.kind;
  const remaining = nudge.kind === 'single' ? 1 : nudge.kind === 'many' ? nudge.spheres.length : 0;
  const visible = variant !== null && snoozedUntil !== undefined && !isSphereNudgeSnoozed(snoozedUntil);

  // One view event per mount while visible (the home tab stays mounted, so
  // this is roughly "once per app session").
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!visible || viewedRef.current || variant === null) return;
    viewedRef.current = true;
    track('sphere_nudge_viewed', { variant, remaining_count: remaining });
  }, [visible, variant, remaining]);

  if (!visible || nudge.kind === 'none') return null;

  const addGoal = (sphere: SphereId) => {
    track('sphere_nudge_tapped', { sphere, remaining_count: remaining });
    onAddGoal(sphere);
  };

  const notNow = () => {
    track('sphere_nudge_snoozed', { remaining_count: remaining });
    const until = Date.now() + 1; // hide immediately; the persisted value replaces it
    setSnoozedUntil(until);
    snoozeSphereNudge().then(setSnoozedUntil).catch(() => {});
  };

  const NotNow = () => (
    <TouchableOpacity onPress={notNow} hitSlop={8} testID="sphere-nudge-not-now">
      <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: COLORS.ink4 }}>NOT NOW</Text>
    </TouchableOpacity>
  );

  if (nudge.kind === 'single') {
    const s = SPHERE_COLORS[nudge.sphere];
    return (
      <View style={{ paddingHorizontal: 22, marginTop: 12 }} testID="sphere-nudge">
        <Card pad={14} style={{ borderWidth: 1, borderColor: s.soft }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => addGoal(nudge.sphere)}
            testID={`sphere-nudge-${nudge.sphere}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <SphereChip sphere={nudge.sphere} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink2, lineHeight: 18 }}>
                {SPHERE_EMPTY_NUDGES[nudge.sphere]}
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: s.accent, marginTop: 6 }}>
                Add a {s.label.toLowerCase()} goal →
              </Text>
            </View>
          </TouchableOpacity>
          <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
            <NotNow />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 22, marginTop: 12 }} testID="sphere-nudge">
      <Card pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ flex: 1, fontFamily: undefined, fontSize: 13, color: COLORS.ink2, lineHeight: 18 }}>
            Would you like to add goals for your other spheres?
          </Text>
          <NotNow />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {nudge.spheres.map(id => {
            const s = SPHERE_COLORS[id];
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.8}
                onPress={() => addGoal(id)}
                testID={`sphere-nudge-${id}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99,
                  backgroundColor: s.soft,
                }}
              >
                <SphereChip sphere={id} size={18} />
                <Text style={{ fontFamily: undefined, fontSize: 12, color: s.deep, fontWeight: '500' }}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>
    </View>
  );
}
