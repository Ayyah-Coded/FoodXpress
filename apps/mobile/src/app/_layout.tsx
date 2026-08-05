import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { useColorScheme } from 'react-native/Libraries/Utilities/Appearance';
import { DefaultTheme } from 'expo-router/build/react-navigation/native/theming/DefaultTheme';
import { DarkTheme } from 'expo-router/build/react-navigation/native/theming/DarkTheme';
import { ThemeProvider } from 'expo-router/build/react-navigation/core/theming/ThemeProvider';

SplashScreen.preventAutoHideAsync();
const colorScheme = useColorScheme();

const queryClient = new QueryClient();

export default function TabLayout() {

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
