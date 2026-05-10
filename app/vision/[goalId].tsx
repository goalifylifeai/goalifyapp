import React, { useEffect, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet, Dimensions,
  StatusBar, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { FilmOverlay } from '../../components/vision/FilmOverlay';
import { useStore } from '../../store';
import { useVisionAssets } from '../../store/vision';
import { stageFromProgress, type VisionStage } from '../../lib/vision-stage';
import { PRO_VISION_AUDIO } from '../../constants/flags';
import { VISION_CAPTIONS } from '../../constants/data';

// Ambient audio map — files must exist in assets/audio/ once sourced.
// Require calls are guarded so a missing file doesn't crash a non-Pro build.
const AMBIENT: Partial<Record<string, number>> = {
  // finance:       require('../../assets/audio/ambient_finance.m4a'),
  // health:        require('../../assets/audio/ambient_health.m4a'),
  // career:        require('../../assets/audio/ambient_career.m4a'),
  // relationships: require('../../assets/audio/ambient_relationships.m4a'),
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function VisionFilmScreen() {
  const router = useRouter();
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const { state } = useStore();
  const { getSignedUrl, getAsset } = useVisionAssets();

  const goal = state.goals.find(g => g.id === goalId);
  const caption = VISION_CAPTIONS[goalId ?? ''] ?? '';

  const goalProgress = goal?.progress ?? 0;
  const defaultStage = stageFromProgress(goalProgress);
  const [selectedStage, setSelectedStage] = useState<VisionStage>(defaultStage);

  const signedUrl = getSignedUrl(goalId ?? '', selectedStage);
  const asset = getAsset(goalId ?? '', selectedStage);

  const imageAnim = useRef(new Animated.Value(0)).current;
  const prevSignedUrl = useRef<string | undefined>(undefined);

  // Cross-fade when signed URL changes (new stage or regen complete).
  useEffect(() => {
    if (signedUrl && signedUrl !== prevSignedUrl.current) {
      imageAnim.setValue(0);
      Animated.timing(imageAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      prevSignedUrl.current = signedUrl;
    }
  }, [signedUrl, imageAnim]);

  // Ambient audio (Pro only, audio files not yet bundled — guarded).
  useEffect(() => {
    if (!PRO_VISION_AUDIO || !goal) return;
    const audioSource = AMBIENT[goal.sphere];
    if (!audioSource) return;
    let sound: import('expo-av').Audio.Sound | null = null;
    import('expo-av').then(({ Audio }) => {
      Audio.Sound.createAsync(audioSource, { isLooping: true, volume: 0.25 })
        .then(({ sound: s }) => { sound = s; s.playAsync(); })
        .catch(() => {});
    }).catch(() => {});
    return () => { sound?.unloadAsync().catch(() => {}); };
  }, [goal?.sphere]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!goal) {
    return (
      <View style={s.fill}>
        <Text style={{ color: COLORS.paper, fontFamily: F.mono, marginTop: 60, textAlign: 'center' }}>
          Goal not found.
        </Text>
      </View>
    );
  }

  const sphereColors = SPHERE_COLORS[goal.sphere];
  // Fallback gradient while image loads.
  const showImage = !!(signedUrl && (asset?.status === 'ready' || prevSignedUrl.current));

  return (
    <View style={s.fill}>
      <StatusBar barStyle="light-content" />

      {/* Fallback color wash */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: sphereColors.deep }]} />

      {/* Generated image */}
      {showImage && (
        <Animated.Image
          source={{ uri: signedUrl ?? prevSignedUrl.current }}
          style={[StyleSheet.absoluteFill, { opacity: imageAnim }]}
          resizeMode="cover"
        />
      )}

      {/* Dark gradient scrim for legibility at bottom */}
      <View style={s.scrim} pointerEvents="none" />

      {/* Close button */}
      <TouchableOpacity
        style={s.closeBtn}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Path d="M2 2l14 14M16 2L2 16" stroke="rgba(255,255,255,0.8)" strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>

      {/* Overlay: stage dots + caption */}
      <FilmOverlay
        goalId={goal.id}
        goalTitle={goal.title}
        sphere={goal.sphere}
        caption={caption}
        currentStage={selectedStage}
        onStageSelect={setSelectedStage}
      />

      {/* Pro audio lock badge (if audio not active) */}
      {!PRO_VISION_AUDIO && (
        <View style={s.audioBadge} pointerEvents="none">
          <Text style={s.audioBadgeText}>♩ Ambient · Pro</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fill: {
    flex: 1,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    // Manual gradient via opacity on a solid color block.
    backgroundColor: 'rgba(20,15,10,0.55)',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBadge: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  audioBadgeText: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
});
