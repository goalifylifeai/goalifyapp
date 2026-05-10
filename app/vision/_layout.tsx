import { Stack } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function VisionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'fullScreenModal',
        contentStyle: { backgroundColor: COLORS.ink1 },
        animation: 'fade',
      }}
    />
  );
}
