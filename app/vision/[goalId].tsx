import React, { useEffect, useRef } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet, Dimensions,
  StatusBar, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { COLORS, SPHERE_COLORS, type SphereId } from '../../constants/theme';
import { F } from '../../components/ui';
import { FilmOverlay } from '../../components/vision/FilmOverlay';
import { useStore } from '../../store';
import { useVisionAssets } from '../../store/vision';
import { FINAL_STAGE } from '../../lib/vision-stage';
import { VISION_SOUND_AVAILABLE } from '../../constants/flags';
import { PAID_PLAN_SHORT } from '../../constants/brand';
import { SPHERE_VISION_CAPTIONS } from '../../constants/data';
import { usePlan } from '../../store/plan';
import { openPaywall } from '../../lib/paywall';

// Sound cue per life area, played once when the vision opens (Beyond only).
// Clips are cropped, faded and levelled to ~-18 LUFS so none is louder than
// another; sources are listed in assets/audio/SOURCES.md.
const VISION_SOUND: Record<SphereId, number> = {
  finance:       require('../../assets/audio/vision_finance.m4a'),       // cash register, 3s
  health:        require('../../assets/audio/vision_health.m4a'),        // bells, 6.5s
  career:        require('../../assets/audio/vision_career.m4a'),        // orchestral swell, 2.7s
  relationships: require('../../assets/audio/vision_relationships.m4a'), // cinematic music, 30s
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function VisionFilmScreen() {
  const router = useRouter();
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const { state } = useStore();
  const { getSignedUrl, getAsset } = useVisionAssets();
  const { plan } = usePlan();

  const goal = state.goals.find(g => g.id === goalId);
  const caption = goal ? SPHERE_VISION_CAPTIONS[goal.sphere] : '';

  const signedUrl = getSignedUrl(goalId ?? '', FINAL_STAGE);
  const asset = getAsset(goalId ?? '', FINAL_STAGE);

  const imageAnim = useRef(new Animated.Value(0)).current;
  const prevSignedUrl = useRef<string | undefined>(undefined);

  // Cross-fade when signed URL changes (first load or regen complete).
  useEffect(() => {
    if (signedUrl && signedUrl !== prevSignedUrl.current) {
      imageAnim.setValue(0);
      Animated.timing(imageAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      prevSignedUrl.current = signedUrl;
    }
  }, [signedUrl, imageAnim]);

  // Sound cue (Beyond only): plays once, stops if the user closes the vision.
  useEffect(() => {
    if (!VISION_SOUND_AVAILABLE || plan !== 'beyond' || !goal) return;
    const audioSource = VISION_SOUND[goal.sphere];
    let sound: import('expo-av').Audio.Sound | null = null;
    import('expo-av').then(({ Audio }) => {
      Audio.Sound.createAsync(audioSource, { isLooping: false, volume: 0.6 })
        .then(({ sound: s }) => { sound = s; s.playAsync(); })
        .catch(() => {});
    }).catch(() => {});
    return () => { sound?.unloadAsync().catch(() => {}); };
  }, [goal?.sphere, plan]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Overlay: progress + caption */}
      <FilmOverlay
        goalId={goal.id}
        goalTitle={goal.title}
        sphere={goal.sphere}
        caption={caption}
        progress={goal.progress}
      />

      {/* Ambient audio teaser on Free (U5) */}
      {VISION_SOUND_AVAILABLE && plan === 'free' && (
        <TouchableOpacity
          style={s.audioBadge}
          onPress={() => openPaywall('ambient_audio')}
          accessibilityRole="button"
          accessibilityLabel="Ambient audio with Goalify Beyond"
        >
          <Text style={s.audioBadgeText}>♩ Ambient · {PAID_PLAN_SHORT}</Text>
        </TouchableOpacity>
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
