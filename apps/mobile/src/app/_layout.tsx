import { Stack } from 'expo-router';
import AppTabs from '@/components/app-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native/Libraries/Utilities/Appearance';
import { DarkTheme } from 'expo-router/build/react-navigation/native/theming/DarkTheme';
import { DefaultTheme } from 'expo-router/build/react-navigation/native/theming/DefaultTheme';
import { ThemeProvider } from 'expo-router/build/react-navigation/core/theming/ThemeProvider';
import { UserRole } from '@food-xpress/types';



SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="health" />

      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>

      <Stack.Protected guard={!!user && user.role === UserRole.CUSTOMER}>
        <Stack.Screen name='(customer)' />
      </Stack.Protected>

      <Stack.Protected guard={!!user && user.role === UserRole.RESTAURANT_OWNER}>
        <Stack.Screen name='(owner)' />
      </Stack.Protected>

      <Stack.Protected guard={!!user && user.role === UserRole.DRIVER}>
        <Stack.Screen name='(driver)' />
      </Stack.Protected>
    </Stack>
  )
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
