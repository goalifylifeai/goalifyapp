import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Dimensions, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPHERE_COLORS } from '../constants/theme';
import { F } from '../components/ui';

const { width: W } = Dimensions.get('window');

type Slide = {
  glyph: string;
  glyphBg: string;
  glyphColor: string;
  label: string;
  title: string;
  body: string;
  hint?: string;
};

const SLIDES: Slide[] = [
  {
    glyph: '◎',
    glyphBg: SPHERE_COLORS.career.soft,
    glyphColor: SPHERE_COLORS.career.accent,
    label: 'Goals',
    title: 'Set goals that\nactually stick.',
    body: 'Pick a life sphere — Finance, Health, Career, Relationships — and state one goal clearly. Specificity is everything.',
    hint: 'Tip: "Save £10k by December" beats "save more money."',
  },
  {
    glyph: '✦',
    glyphBg: SPHERE_COLORS.health.soft,
    glyphColor: SPHERE_COLORS.health.accent,
    label: 'Tasks',
    title: 'Break it into\nreal steps.',
    body: 'Goals need tasks — small, concrete actions you can finish this week. Each task you check off moves your progress bar.',
    hint: 'Tip: If a task takes more than 2 hours, split it.',
  },
  {
    glyph: '○',
    glyphBg: '#E8E2D5',
    glyphColor: COLORS.ink2,
    label: 'Today',
    title: 'Check in\nevery day.',
    body: "The Today tab is your daily dashboard. You'll set a morning intention, mark tasks done, and close out in the evening.",
    hint: 'Consistency compounds — even a 5-minute check-in counts.',
  },
  {
    glyph: '▣',
    glyphBg: SPHERE_COLORS.finance.soft,
    glyphColor: SPHERE_COLORS.finance.accent,
    label: 'Habits',
    title: 'Build streaks\nthat stick.',
    body: "Habits are recurring actions that don't belong to a single goal. Track them daily and watch your streak grow.",
    hint: 'Small and boring wins: drink water, stretch, review your goals.',
  },
  {
    glyph: '✺',
    glyphBg: SPHERE_COLORS.relationships.soft,
    glyphColor: SPHERE_COLORS.relationships.accent,
    label: 'Coach',
    title: 'Your coach\nwatches patterns.',
    body: 'The AI coach reads your journal sentiment, goal progress, and habit streaks — then tells you what to do next and why.',
    hint: 'The more you use the app, the sharper the insights get.',
  },
];

export default function TourScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / W);
    setPage(p);
  };

  const goNext = () => {
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * W, animated: true });
    } else {
      router.back();
    }
  };

  const slide = SLIDES[page];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.paper }}>
      {/* Close button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: 'absolute', top: insets.top + 12, right: 20,
          zIndex: 10, padding: 8,
        }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: COLORS.ink3 }}>
          CLOSE
        </Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width: W, flex: 1, paddingTop: insets.top + 56, paddingHorizontal: 32, paddingBottom: 0 }}>
            {/* Glyph */}
            <View style={{
              width: 72, height: 72, borderRadius: 22,
              backgroundColor: s.glyphBg, alignItems: 'center', justifyContent: 'center',
              marginBottom: 32,
            }}>
              <Text style={{ fontSize: 30, color: s.glyphColor }}>{s.glyph}</Text>
            </View>

            {/* Label */}
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
              {s.label}
            </Text>

            {/* Title */}
            <Text style={{ fontFamily: F.display, fontSize: 40, color: COLORS.ink1, lineHeight: 46, letterSpacing: -0.8, marginBottom: 20 }}>
              {s.title}
            </Text>

            {/* Body */}
            <Text style={{ fontFamily: F.mono, fontSize: 13, color: COLORS.ink2, lineHeight: 22, letterSpacing: 0.1, marginBottom: 20 }}>
              {s.body}
            </Text>

            {/* Hint */}
            {s.hint && (
              <View style={{
                borderLeftWidth: 2, borderLeftColor: s.glyphColor,
                paddingLeft: 14, paddingVertical: 4,
              }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, lineHeight: 18, letterSpacing: 0.1 }}>
                  {s.hint}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View style={{
        paddingHorizontal: 32, paddingBottom: insets.bottom + 24, paddingTop: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Dots */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => scrollRef.current?.scrollTo({ x: i * W, animated: true })}
            >
              <View style={{
                width: i === page ? 18 : 6,
                height: 6, borderRadius: 3,
                backgroundColor: i === page ? COLORS.ink1 : COLORS.ink5,
              }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Next / Done */}
        <TouchableOpacity
          onPress={goNext}
          style={{
            paddingVertical: 12, paddingHorizontal: 24, borderRadius: 99,
            backgroundColor: COLORS.ink1,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: COLORS.paper }}>
            {page < SLIDES.length - 1 ? 'Next →' : 'Got it'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
