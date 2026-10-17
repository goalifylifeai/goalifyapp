// Full-screen level-up / achievement moment (spec 012, Story 1, FR-007).
//
// Mounted once in app/_layout.tsx. Shows the moment queued by XpProvider,
// only while the user is on the main tabs, never mid-ritual or in onboarding.
// One "Continue" dismisses everything shown and records it as seen.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/theme';
import { LEVELS, levelFromXp } from '../constants/data';
import { achievementFor } from '../lib/achievements';
import { canShowMomentOn } from '../lib/moments';
import { useXp } from '../store/xp';
import { F } from './ui';

const MUTED = 'rgba(255,255,255,0.55)';
const FAINT = 'rgba(255,255,255,0.4)';

export function MomentOverlay() {
  const { moment, dismissMoment, total } = useXp();
  const segments = useSegments();
  const visible = !!moment && canShowMomentOn(segments);

  if (!visible || !moment) return null;
  return <MomentCard level={moment.level} achievements={moment.achievements} total={total} onDone={dismissMoment} />;
}

function MomentCard({ level, achievements, total, onDone }: {
  level: number | null; achievements: string[]; total: number; onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [fade]);

  const lvl = level !== null ? LEVELS.find(l => l.n === level) : undefined;
  const progress = levelFromXp(total);
  const isTop = lvl?.n === LEVELS[LEVELS.length - 1].n;
  const items = achievements.map(achievementFor).filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View testID="moment-overlay" style={{ flex: 1, backgroundColor: COLORS.ink1 }}>
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <ScrollView
            contentContainerStyle={{ paddingTop: insets.top + 64, paddingHorizontal: 28, paddingBottom: 32, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {lvl && (
              <View testID="moment-level" style={{ marginBottom: items.length > 0 ? 40 : 0 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: FAINT, marginBottom: 14 }}>
                  New level
                </Text>
                <Text style={{ fontFamily: F.display, fontSize: 88, lineHeight: 92, color: COLORS.paper, letterSpacing: -2 }}>
                  {lvl.n}
                </Text>
                <Text style={{ fontFamily: F.displayItalic, fontSize: 34, lineHeight: 40, color: COLORS.paper, marginTop: 4 }}>
                  {lvl.name}.
                </Text>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: MUTED, lineHeight: 20, marginTop: 16 }}>
                  {isTop
                    ? 'The top of the ladder. Everything from here is yours to keep.'
                    : `${(progress.next.min - total).toLocaleString('en')} XP to Level ${progress.next.n}, ${progress.next.name}.`}
                </Text>
              </View>
            )}

            {items.length > 0 && (
              <View testID="moment-achievements">
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: FAINT, marginBottom: 14 }}>
                  {items.length === 1 ? 'Achievement unlocked' : `${items.length} achievements unlocked`}
                </Text>
                <View style={{ gap: 10 }}>
                  {items.map(a => (
                    <View key={a.key} testID={`moment-achievement-${a.key}`} style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
                      <Text style={{ fontFamily: F.display, fontSize: lvl ? 20 : 26, lineHeight: lvl ? 24 : 30, color: COLORS.paper }}>{a.title}</Text>
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 17 }}>{a.howTo}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 24, gap: 14 }}>
            <TouchableOpacity
              testID="moment-continue"
              onPress={onDone}
              accessibilityRole="button"
              style={{ backgroundColor: COLORS.paper, borderRadius: 99, paddingVertical: 15, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: F.monoMedium, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink1 }}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="moment-see-all"
              onPress={() => { onDone(); router.push('/level-info' as any); }}
              style={{ alignItems: 'center', paddingVertical: 4 }}
            >
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: FAINT }}>See all achievements</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
