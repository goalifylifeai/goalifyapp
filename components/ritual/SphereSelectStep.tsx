import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { COLORS, SPHERE_COLORS, type SphereId } from '../../constants/theme';
import { SPHERE_LIST } from '../../constants/data';
import { F } from '../ui';

interface Props {
  selected: SphereId | null;
  onSelect: (sphere: SphereId) => void;
  preSelected?: SphereId | null;
  heading?: string;
  subheading?: string;
}

export function SphereSelectStep({ selected, onSelect, heading = "What's your One today?", subheading }: Props) {
  const scales = useRef(
    Object.fromEntries(SPHERE_LIST.map(id => [id, new Animated.Value(1)])) as Record<SphereId, Animated.Value>,
  ).current;

  const handleSelect = (id: SphereId) => {
    onSelect(id);
    Animated.spring(scales[id], {
      toValue: 1.04,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start(() => {
      Animated.spring(scales[id], { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    });
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontFamily: F.displayItalic, fontSize: 34, color: COLORS.ink1, letterSpacing: -0.6, lineHeight: 42, marginBottom: subheading ? 8 : 28 }}>
        {heading}
      </Text>
      {subheading && (
        <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink3, lineHeight: 22, marginBottom: 28 }}>
          {subheading}
        </Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {SPHERE_LIST.map(id => {
          const s = SPHERE_COLORS[id];
          const isSelected = selected === id;
          return (
            <Animated.View key={id} style={{ width: '47%', transform: [{ scale: scales[id] }] }}>
              <TouchableOpacity
                onPress={() => handleSelect(id)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: isSelected ? s.soft : COLORS.surface,
                  borderRadius: 18,
                  padding: 20,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? s.accent : COLORS.ink7,
                  alignItems: 'center',
                  minHeight: 120,
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <View style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: isSelected ? s.accent : s.soft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 22, color: isSelected ? '#fff' : s.deep, fontWeight: '700' }}>
                    {s.glyph}
                  </Text>
                </View>
                <Text style={{
                  fontFamily: F.mono,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: isSelected ? s.deep : COLORS.ink3,
                  textAlign: 'center',
                }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}
