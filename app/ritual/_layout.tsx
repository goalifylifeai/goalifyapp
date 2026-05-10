import { Stack } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function RitualLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.paper },
        presentation: 'fullScreenModal',
        animation: 'slide_from_bottom',
      }}
    />
  );
}
