import { Stack } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function WelcomeLayout() {
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
