import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SphereId } from '../../constants/theme';
import { F } from '../ui';
import { useVisionAssets } from '../../store/vision';
import { FINAL_STAGE } from '../../lib/vision-stage';
import { usePlan } from '../../store/plan';
import { openPaywall } from '../../lib/paywall';
import { imageLimitCaption } from '../../lib/vision-limit';

type Props = {
  goalId: string;
  goalTitle: string;
  sphere: SphereId;
  caption: string;
  fallbackColors: [string, string];
  onPress: () => void;
};

export function VisionBanner({ goalId, goalTitle, sphere, caption, fallbackColors, onPress }: Props) {
  const { assetsLoaded, getAsset, getSignedUrl, requestGeneration, isGenerating, isImageLimited, retryGeneration } = useVisionAssets();
  const { plan } = usePlan();
  const stage = FINAL_STAGE;
  const asset = getAsset(goalId, stage);
  const signedUrl = getSignedUrl(goalId, stage);
  const limited = isImageLimited(goalId);

  // Generate once the saved images have loaded and this goal still has none.
  useEffect(() => {
    if (assetsLoaded && !asset && !limited) requestGeneration(goalId, goalTitle, sphere);
  }, [goalId, assetsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const isLoadingImage = !signedUrl && (asset?.status === 'pending' || asset?.status === 'generating' || isGenerating(goalId));

  useEffect(() => {
    if (!isLoadingImage) { shimmerAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLoadingImage, shimmerAnim]);

  const chipLabel = asset?.status === 'generating' || isGenerating(goalId) ? 'Generating…' : 'Vision';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
      <View style={s.container}>
        {/* Base: gradient fallback, always rendered */}
        <LinearGradient
          colors={fallbackColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Generated image on top when ready */}
        {signedUrl ? (
          <Image
            source={{ uri: signedUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}

        {/* Shimmer overlay while generating */}
        {isLoadingImage && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(255,255,255,0.18)', opacity: shimmerAnim },
            ]}
          />
        )}

        {/* Vision chip */}
        <View style={s.chipWrap}>
          <View style={s.chip}>
            <Text style={s.chipText}>{chipLabel}</Text>
          </View>
        </View>

        {/* Caption, or the image-cap note (U4) */}
        <View style={s.captionWrap}>
          {limited ? (
            <TouchableOpacity
              disabled={plan !== 'free'}
              onPress={() => openPaywall('vision_limit', () => retryGeneration(goalId, goalTitle, sphere))}
            >
              <Text style={s.limitText}>{imageLimitCaption(plan)}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={s.caption} numberOfLines={2}>{caption}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    height: 130,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  chipWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(30,25,20,0.72)',
  },
  captionWrap: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  caption: {
    fontFamily: F.displayItalic,
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(20,15,10,0.92)',
    letterSpacing: -0.1,
  },
  limitText: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(20,15,10,0.8)',
  },
});
