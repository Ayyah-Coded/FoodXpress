import { Stack } from 'expo-router';


export default function OwnerIndexLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create-restaurant" />
      <Stack.Screen name="edit-restaurant" />
    </Stack>
  );
}