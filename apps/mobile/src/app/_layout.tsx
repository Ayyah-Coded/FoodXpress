import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

export default function TabLayout() {

  return (
    <QueryClientProvider client={queryClient}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </QueryClientProvider>
  );
}
