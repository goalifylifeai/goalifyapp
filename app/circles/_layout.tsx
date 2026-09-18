import { Stack } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function CirclesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.paper },
      }}
    />
  );
}
