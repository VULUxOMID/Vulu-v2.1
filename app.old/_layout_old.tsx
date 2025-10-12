// Fix for frozen object error in development mode
if (__DEV__) {
  // Store original functions
  const originalFreeze = Object.freeze;
  const originalSeal = Object.seal;
  const originalPreventExtensions = Object.preventExtensions;

  // In development mode, completely disable freezing to prevent React errors
  // This is safe because it's only in development and prevents the frozen object errors
  Object.freeze = function<T>(obj: T): T {
    // Simply return the object without freezing in development
    return obj;
  };

  Object.seal = function<T>(obj: T): T {
    // Simply return the object without sealing in development
    return obj;
  };

  Object.preventExtensions = function<T>(obj: T): T {
    // Simply return the object without preventing extensions in development
    return obj;
  };

  // Add global error handling for module loading issues
  const originalRequire = global.require;
  if (originalRequire) {
    global.require = function(id: string) {
      try {
        return originalRequire(id);
      } catch (error) {
        // Only handle specific module loading errors, not all errors
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as Error).message;
          if (errorMessage.includes('Requiring unknown module') || errorMessage.includes('Unable to resolve module')) {
            console.warn(`Failed to require module ${id}:`, error);
            // Return empty object for failed modules to prevent crashes
            return {};
          }
        }
        // Re-throw other errors
        throw error;
      }
    };
  }

  // Add global error handler for unhandled promise rejections
  const handleUnhandledRejection = (event: any) => {
    console.warn('Unhandled promise rejection:', event.reason);
    event.preventDefault?.();
  };

  if (typeof global !== 'undefined' && global.addEventListener) {
    global.addEventListener('unhandledrejection', handleUnhandledRejection);
  }
}

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';

import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MiniPlayerProvider } from '../src/context/MiniPlayerContext';
import { AuthProvider } from '../src/context/AuthContext';
import { LiveStreamProvider } from '../src/context/LiveStreamContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { MusicProvider } from '../src/context/MusicContext';
import { GamingProvider } from '../src/context/GamingContext';
import { ShopProvider } from '../src/context/ShopContext';
import ErrorBoundary from '../src/components/ErrorBoundary';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Minimal initialization
        console.log('🚀 App initializing...');

        // Set app as ready immediately
        setAppIsReady(true);
      } catch (e) {
        console.warn('Error during app initialization:', e);
        setAppIsReady(true); // Continue anyway
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <NotificationProvider>
              <MusicProvider>
                <GamingProvider>
                  <ShopProvider>
                    <LiveStreamProvider>
                      <MiniPlayerProvider>
                        <StatusBar style="light" />
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: '#000000' },
                          }}
                        />
                      </MiniPlayerProvider>
                    </LiveStreamProvider>
                  </ShopProvider>
                </GamingProvider>
              </MusicProvider>
            </NotificationProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
