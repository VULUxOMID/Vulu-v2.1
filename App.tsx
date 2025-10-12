/**
 * Main App Component
 * Migrated from expo-router to React Navigation
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

// Context Providers
import { AuthProvider } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { UserStatusProvider } from './src/context/UserStatusContext';
import { MusicProvider } from './src/context/MusicContext';
import { GamingProvider } from './src/context/GamingContext';
import { ShopProvider } from './src/context/ShopContext';
import { LiveStreamProvider } from './src/context/LiveStreamContext';
import { MiniPlayerProvider } from './src/context/MiniPlayerContext';
import { MenuPositionProvider } from './src/context/MenuPositionContext';

// Navigation
import RootNavigator from './src/navigation/RootNavigator';

// Error Handling
import ErrorBoundary from './src/components/ErrorBoundary';
import { setupGlobalErrorHandling } from './src/utils/globalErrorHandler';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded] = useFonts({
    SpaceMono: require('./assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Set up additional crash prevention
  useEffect(() => {
    setupGlobalErrorHandling();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <MenuPositionProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <NotificationProvider>
                  <UserStatusProvider>
                    <MusicProvider>
                      <GamingProvider>
                        <ShopProvider>
                          <LiveStreamProvider>
                            <MiniPlayerProvider>
                              <StatusBar style="light" />
                              <NavigationContainer>
                                <RootNavigator />
                              </NavigationContainer>
                            </MiniPlayerProvider>
                          </LiveStreamProvider>
                        </ShopProvider>
                      </GamingProvider>
                    </MusicProvider>
                  </UserStatusProvider>
                </NotificationProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </MenuPositionProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
} 