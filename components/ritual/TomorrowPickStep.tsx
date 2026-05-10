import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, type SphereId } from '../../constants/theme';
import { SPHERE_SCORES, SPHERE_LIST } from '../../constants/data';
import { F } from '../ui';
import { SphereSelectStep } from './SphereSelectStep';

interface Props {
  selected: SphereId | null;
  onSelect: (sphere: SphereId) => void;
}

function lowestSphere(): SphereId {
  return SPHERE_LIST.reduce((low, id) =>
    SPHERE_SCORES[id] < SPHERE_SCORES[low] ? id : low,
  ) as SphereId;
}

export function TomorrowPickStep({ selected, onSelect }: Props) {
  const suggestion = lowestSphere();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 6 }}>
          Tomorrow
        </Text>
        <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink4, lineHeight: 19, marginBottom: 4 }}>
          Suggested: the sphere that needs the most attention.
        </Text>
      </View>
      <SphereSelectStep
        selected={selected ?? suggestion}
        onSelect={onSelect}
        heading="Tomorrow's One."
      />
    </View>
  );
}
