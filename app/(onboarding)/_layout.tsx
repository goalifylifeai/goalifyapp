import { Stack } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: COLORS.paper },
      }}
    />
  );
}
