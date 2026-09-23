import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { F } from '../ui';
import type { SphereId } from '../../constants/theme';
import { FINAL_STAGE } from '../../lib/vision-stage';
import { useVisionAssets } from '../../store/vision';
import { usePlan } from '../../store/plan';
import { openPaywall } from '../../lib/paywall';

type Props = {
  goalId: string;
  goalTitle: string;
  sphere: SphereId;
  caption: string;
  progress: number; // 0–1
};

export function FilmOverlay({ goalId, goalTitle, sphere, caption, progress }: Props) {
  const { requestRegen, canRegen, getAsset } = useVisionAssets();
  const { plan } = usePlan();
  const locked = plan !== 'beyond';
  const currentAsset = getAsset(goalId, FINAL_STAGE);
  const isGenerating = currentAsset?.status === 'generating';

  const handleRegen = () => {
    if (isGenerating) return;
    if (locked) {
      openPaywall('vision_regen', () => requestRegen(goalId, FINAL_STAGE, goalTitle, sphere));
      return;
    }
    if (!canRegen(goalId, FINAL_STAGE)) {
      Alert.alert('Regen limit reached', 'You can regenerate this image once a week.', [{ text: 'OK' }]);
      return;
    }
    Alert.alert(
      'Regenerate vision?',
      'This will create a new image for this goal. Takes about 10 seconds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: () => requestRegen(goalId, FINAL_STAGE, goalTitle, sphere),
        },
      ],
    );
  };

  return (
    <>
      {/* Progress + regen row. Free: tapping opens the paywall (U2). */}
      <View style={s.stageRow}>
        <Text style={s.stageLabel}>{Math.round(progress * 100)}% of the way there</Text>

        <TouchableOpacity
          onPress={handleRegen}
          style={[s.regenBtn, isGenerating && s.regenBtnDisabled]}
          disabled={isGenerating}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={locked ? 'Regenerate vision (Goalify Beyond)' : 'Regenerate vision'}
        >
          {isGenerating ? (
            <Text style={s.regenText}>…</Text>
          ) : (
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Path
                d="M13.5 8a5.5 5.5 0 1 1-1.5-3.79M13.5 2v3.5H10"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
          {locked && !isGenerating && <Text style={s.lock}>🔒</Text>}
        </TouchableOpacity>
      </View>

      {/* Caption card */}
      <View style={s.captionCard}>
        <Text style={s.captionText}>{caption}</Text>
        <Text style={s.goalTitle} numberOfLines={1}>{goalTitle}</Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  stageRow: {
    position: 'absolute',
    bottom: 200,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageLabel: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  regenBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenBtnDisabled: {
    opacity: 0.5,
  },
  regenText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  lock: { position: 'absolute', right: -2, bottom: -2, fontSize: 8 },
  captionCard: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(20,15,10,0.55)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  captionText: {
    fontFamily: F.displayItalic,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.paper,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  goalTitle: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(244,239,230,0.55)',
  },
});
