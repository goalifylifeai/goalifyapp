import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { F, SphereChip } from '../ui';
import type { RitualAction } from '../../store/daily-ritual';

interface Props {
  actions: RitualAction[];
  onToggleMustDo: (id: string) => void;
  onSwap: (id: string) => void;
}

export function ActionPickStep({ actions, onToggleMustDo, onSwap }: Props) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontFamily: F.displayItalic, fontSize: 34, color: COLORS.ink1, letterSpacing: -0.6, lineHeight: 42, marginBottom: 8 }}>
        Today's three.
      </Text>
      <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink3, lineHeight: 22, marginBottom: 28 }}>
        Tap ★ to mark the one that must happen.
      </Text>

      <View style={{ gap: 12 }}>
        {actions.map(action => {
          const s = SPHERE_COLORS[action.sphere];
          return (
            <View
              key={action.id}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                borderLeftWidth: action.is_must_do ? 3 : 0,
                borderLeftColor: s.accent,
                overflow: 'hidden',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
                <TouchableOpacity
                  onPress={() => onToggleMustDo(action.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: action.is_must_do ? s.accent : s.soft,
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ fontSize: 16, color: action.is_must_do ? '#fff' : s.deep }}>
                    {action.is_must_do ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink1, lineHeight: 21, letterSpacing: -0.1 }}>
                    {action.text}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <SphereChip sphere={action.sphere} size={16} />
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 0.5 }}>
                      {s.label}
                    </Text>
                    {action.is_must_do && (
                      <>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4 }}>·</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: s.deep, letterSpacing: 0.5 }}>must-do</Text>
                      </>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => onSwap(action.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 16, color: COLORS.ink4 }}>↻</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
