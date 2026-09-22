import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, type SphereId } from '../../constants/theme';
import { SPHERE_LIST, computeSphereData } from '../../constants/data';
import { useStore } from '../../store';
import type { Goal } from '../../store';
import { F } from '../ui';
import { SphereSelectStep } from './SphereSelectStep';

interface Props {
  selected: SphereId | null;
  onSelect: (sphere: SphereId) => void;
}

// The started sphere (has goals) with the lowest progress, or null if none.
function lowestSphere(goals: Goal[]): SphereId | null {
  const data = computeSphereData(goals);
  const started = SPHERE_LIST.filter(id => data[id].count > 0);
  if (started.length === 0) return null;
  return started.reduce((low, id) => (data[id].progress < data[low].progress ? id : low));
}

export function TomorrowPickStep({ selected, onSelect }: Props) {
  const { state } = useStore();
  const suggestion = lowestSphere(state.goals);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 6 }}>
          Tomorrow
        </Text>
        {suggestion && (
          <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink4, lineHeight: 19, marginBottom: 4 }}>
            Suggested: the sphere that needs the most attention.
          </Text>
        )}
      </View>
      <SphereSelectStep
        selected={selected ?? suggestion}
        onSelect={onSelect}
        heading="Tomorrow's One."
      />
    </View>
  );
}
