import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { F } from '../ui';
import type { SphereId } from '../../constants/theme';
import type { VisionStage } from '../../lib/vision-stage';
import { STAGE_LABELS } from '../../lib/vision-stage';
import { useVisionAssets } from '../../store/vision';
import { PRO_VISION_REGEN } from '../../constants/flags';

type Props = {
  goalId: string;
  goalTitle: string;
  sphere: SphereId;
  caption: string;
  currentStage: VisionStage;
  onStageSelect: (stage: VisionStage) => void;
};

const ALL_STAGES: VisionStage[] = [0, 1, 2, 3];

export function FilmOverlay({ goalId, goalTitle, sphere, caption, currentStage, onStageSelect }: Props) {
  const { requestRegen, canRegen, getAsset } = useVisionAssets();
  const currentAsset = getAsset(goalId, currentStage);
  const isGenerating = currentAsset?.status === 'generating';

  const handleRegen = () => {
    if (isGenerating) return;
    if (!canRegen(goalId, currentStage) && !PRO_VISION_REGEN) {
      Alert.alert(
        'Regen limit reached',
        'Free plan allows one regeneration per week. Upgrade to Pro for unlimited.',
        [{ text: 'OK' }],
      );
      return;
    }
    Alert.alert(
      'Regenerate vision?',
      'This will create a new image for this stage. Takes about 10 seconds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: () => requestRegen(goalId, currentStage, goalTitle, sphere),
        },
      ],
    );
  };

  return (
    <>
      {/* Stage pills row */}
      <View style={s.stageRow}>
        <View style={s.stageDots}>
          {ALL_STAGES.map(stage => (
            <TouchableOpacity
              key={stage}
              onPress={() => onStageSelect(stage)}
              style={[s.dot, currentStage === stage ? s.dotActive : s.dotInactive]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            />
          ))}
          <Text style={s.stageLabel}>{STAGE_LABELS[currentStage]}</Text>
        </View>

        <TouchableOpacity
          onPress={handleRegen}
          style={[s.regenBtn, isGenerating && s.regenBtnDisabled]}
          disabled={isGenerating}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
  stageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stageLabel: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 4,
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
