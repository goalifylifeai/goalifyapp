import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { F, SphereChip } from '../ui';
import type { RitualAction } from '../../store/daily-ritual';

interface Props {
  actions: RitualAction[];
  onToggle: (id: string) => void;
}

export function DoneReviewStep({ actions, onToggle }: Props) {
  const sorted = [...actions].sort((a, b) => {
    if (a.is_must_do && !b.is_must_do) return -1;
    if (!a.is_must_do && b.is_must_do) return 1;
    return 0;
  });

  const doneCount = actions.filter(a => a.done).length;

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontFamily: F.displayItalic, fontSize: 34, color: COLORS.ink1, letterSpacing: -0.6, lineHeight: 42, marginBottom: 8 }}>
        Here's what you did.
      </Text>
      <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink3, lineHeight: 22, marginBottom: 28 }}>
        {doneCount} of {actions.length} completed today.
      </Text>

      <View style={{ gap: 2, backgroundColor: COLORS.surface, borderRadius: 16, overflow: 'hidden' }}>
        {sorted.map((action, i) => {
          const s = SPHERE_COLORS[action.sphere];
          return (
            <TouchableOpacity
              key={action.id}
              onPress={() => onToggle(action.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14, paddingHorizontal: 16,
                borderBottomWidth: i < sorted.length - 1 ? 0.5 : 0,
                borderBottomColor: COLORS.ink7,
                borderLeftWidth: action.is_must_do ? 3 : 0,
                borderLeftColor: s.accent,
              }}
            >
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: action.done ? s.accent : 'transparent',
                borderWidth: action.done ? 0 : 1.5,
                borderColor: COLORS.ink5,
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {action.done && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: undefined, fontSize: 15, color: action.done ? COLORS.ink4 : COLORS.ink1,
                  textDecorationLine: action.done ? 'line-through' : 'none',
                  letterSpacing: -0.1,
                }}>
                  {action.text}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <SphereChip sphere={action.sphere} size={14} />
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4 }}>{s.label}</Text>
                  {action.is_must_do && (
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: s.deep }}>★ must-do</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
