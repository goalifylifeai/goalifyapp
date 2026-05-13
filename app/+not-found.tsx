import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';

export default function NotFound() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.paper, paddingTop: insets.top + 48, paddingHorizontal: 28 }}>
      <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
        404
      </Text>
      <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginBottom: 16 }}>
        Page not{'\n'}found.
      </Text>
      <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink3, lineHeight: 21, marginBottom: 40 }}>
        This route doesn't exist. You may have followed a broken link or typed the URL incorrectly.
      </Text>
      <TouchableOpacity
        onPress={() => router.replace('/(tabs)' as any)}
        style={{ backgroundColor: COLORS.ink1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
          Go home
        </Text>
      </TouchableOpacity>
    </View>
  );
}
