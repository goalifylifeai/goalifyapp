import { View, Text } from 'react-native';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';

export function Progress({ step, of }: { step: number; of: number }) {
  return (
    <View>
      <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, color: COLORS.ink3, textTransform: 'uppercase' }}>
        Step {step} of {of}
      </Text>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
        {Array.from({ length: of }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              backgroundColor: i < step ? COLORS.ink1 : COLORS.ink6,
            }}
          />
        ))}
      </View>
    </View>
  );
}
