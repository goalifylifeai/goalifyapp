import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Share, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPHERE_COLORS, type SphereId } from '../../constants/theme';
import { F } from '../ui';
import { USER, SPHERE_SCORES } from '../../constants/data';

interface Props {
  sphere: SphereId;
  journalLine: string;
  saving: boolean;
  error: string | null;
}

const BASE_STREAK = USER.streak;
const SPHERE_GAIN = 3;

export function CloseCelebrationStep({ sphere, journalLine, saving, error }: Props) {
  const s = SPHERE_COLORS[sphere];
  const streakAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [displayStreak, setDisplayStreak] = useState(BASE_STREAK);

  useEffect(() => {
    if (saving) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(streakAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
    ]).start();

    const id = streakAnim.addListener(({ value }) => {
      setDisplayStreak(Math.round(BASE_STREAK + value));
    });
    return () => streakAnim.removeListener(id);
  }, [saving]);

  const handleShare = async () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const message = [
      `Goalify · ${dateStr}`,
      `${s.glyph} ${s.label} focus`,
      journalLine ? `"${journalLine}"` : '',
      `${BASE_STREAK + 1} day streak`,
      '— closed with intention',
    ].filter(Boolean).join('\n');

    await Share.share({ message }).catch(() => {});
  };

  if (saving) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.ink1} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 24, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: contentOpacity, gap: 20 }}>
        {/* Streak */}
        <View style={{ backgroundColor: COLORS.ink1, borderRadius: 20, padding: 28, alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(244,239,230,0.5)' }}>
            Streak
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ fontFamily: F.display, fontSize: 72, color: COLORS.paper, lineHeight: 80 }}>
              {displayStreak}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 16, color: 'rgba(244,239,230,0.55)' }}>days</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: 'rgba(244,239,230,0.55)' }}>
              {s.glyph} {s.label}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: s.soft }}>
              +{SPHERE_GAIN} pts
            </Text>
          </View>
        </View>

        {/* Journal echo */}
        {journalLine ? (
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderLeftWidth: 3, borderLeftColor: s.accent }}>
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink4, marginBottom: 8 }}>
              Today in your words
            </Text>
            <Text style={{ fontFamily: F.displayItalic, fontSize: 18, color: COLORS.ink1, lineHeight: 26, letterSpacing: -0.1 }}>
              "{journalLine}"
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.displayItalic, fontSize: 22, color: COLORS.ink1, textAlign: 'center', letterSpacing: -0.2 }}>
              Day closed with intention.
            </Text>
          </View>
        )}

        {/* Share card button */}
        <TouchableOpacity
          onPress={handleShare}
          style={{
            borderWidth: 1, borderColor: COLORS.ink6, borderRadius: 50,
            paddingVertical: 12, paddingHorizontal: 24,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink2 }}>
            Share today's close
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}
