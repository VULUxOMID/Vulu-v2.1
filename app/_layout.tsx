import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import React, { useEffect, useState, createContext, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { MenuPositionProvider } from '../src/components/SidebarMenu';
import { View, ActivityIndicator, Platform, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { UserProfileProvider } from '../src/context/UserProfileContext';
import { UserStatusProvider } from '../src/context/UserStatusContext';
import { LiveStreamProvider } from '../src/context/LiveStreamContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { MusicProvider } from '../src/context/MusicContext';
import { GamingProvider } from '../src/context/GamingContext';
import { ShopProvider } from '../src/context/ShopContext';
import { AuthProvider, useAuthSafe } from '../src/context/AuthContext';
import { MiniPlayerProvider } from '../src/context/MiniPlayerContext';
import ErrorBoundary from '../src/components/ErrorBoundary';
import WebResponsiveWrapper from '../src/components/WebResponsiveWrapper';

import { analyticsService } from '../src/services/analyticsService';
import { messageSchedulingService } from '../src/services/messageSchedulingService';
import { offlineMessageService } from '../src/services/offlineMessageService';
import { pushNotificationService, setupQuickReplyActions } from '../src/services/pushNotificationService';
import { encryptionService } from '../src/services/encryptionService';
import { voiceMessageService } from '../src/services/voiceMessageService';
import { messageCacheService } from '../src/services/messageCacheService';
import { contentModerationService } from '../src/services/contentModerationService';
import { bundleOptimizer } from '../src/utils/bundleOptimization';
import { performanceService } from '../src/services/performanceService';
import { messagingAnalyticsService } from '../src/services/messagingAnalyticsService';

// Import debug utilities (development only)
if (process.env.NODE_ENV !== 'production') {
  import('../src/utils/debugPhantomStreams');
}

// Create a custom Material theme
const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#6E69F4',
    background: '#131318',
    surface: '#1C1D23',
    surfaceVariant: '#2C2D35',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#AAAAAB',
  },
};

// Create a custom Navigation theme based on the dark theme
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#6E69F4',
    background: '#131318',
    card: '#1C1D23',
    text: '#FFFFFF',
    border: '#2C2D35',
    notification: '#F23535',
  },
};

// Create a simple context to share font loading status across the app
interface AppContextType {
  fontsLoaded: boolean;
}

export const AppContext = createContext<AppContextType>({ fontsLoaded: false });

export function useAppContext() {
  return useContext(AppContext);
}

// Component to render icon fallbacks when fonts aren't loaded
export const IconFallback = ({ size, color }: { size: number; color: string }) => (
  <View
    style={{
      width: size,
      height: size,
      backgroundColor: color === '#FFFFFF' ? '#666' : '#333',
      borderRadius: size / 2,
    }}
  />
);

// Error handler for the ErrorBoundary
const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
  // Report error to analytics service
  analyticsService.reportError({
    error,
    componentStack: errorInfo.componentStack || '',
    metadata: {
      component: 'RootLayout',
      timestamp: Date.now()
    }
  });
  
  console.error('Error caught by ErrorBoundary:', error, errorInfo);
};

// Loading state wrapper component to handle auth initialization
// This component must be inside AuthProvider to access useAuth
const AppLoadingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Safely get auth context - returns null if provider not ready
  const authContext = useAuthSafe();

  // Safety check - if auth context is not available, show loading
  if (!authContext) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#131318' }}>
        <ActivityIndicator size="large" color="#6E69F4" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>
          Loading authentication...
        </Text>
      </View>
    );
  }

  const { loading } = authContext;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#131318' }}>
        <ActivityIndicator size="large" color="#6E69F4" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>
          Initializing...
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [fontsLoaded] = useState(false); // Keep for AppContext compatibility

  // Skip font loading for now
  useFonts({
    // Add any custom fonts here if needed
  });

  useEffect(() => {
    // Initialize all services in an async sequence
    const initializeServices = async () => {
      try {
        // Initialize analytics service
        await analyticsService.initialize();
      } catch (error) {
        console.error('Failed to initialize analytics:', error);
      }

      try {
        // Initialize message scheduling service
        await messageSchedulingService.initialize();
      } catch (error) {
        console.error('Failed to initialize message scheduling:', error);
      }

      try {
        // Initialize offline message service
        await offlineMessageService.initialize();
      } catch (error) {
        console.error('Failed to initialize offline messages:', error);
      }

      try {
        // Initialize push notification service
        await pushNotificationService.initialize();
        setupQuickReplyActions();
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }

      try {
        // Initialize voice message service
        await voiceMessageService.initialize();
      } catch (error) {
        console.error('Failed to initialize voice messages:', error);
      }

      try {
        // Initialize message cache service
        await messageCacheService.initialize();
      } catch (error) {
        console.error('Failed to initialize message cache:', error);
      }

      try {
        // Initialize content moderation service
        await contentModerationService.initialize();
      } catch (error) {
        console.error('Failed to initialize content moderation:', error);
      }

      try {
        // Initialize bundle optimizer and performance service
        await bundleOptimizer.initialize();
        await performanceService.initialize();
      } catch (error) {
        console.error('Failed to initialize performance services:', error);
      }

      try {
        // Initialize messaging analytics service
        await messagingAnalyticsService.initialize();
      } catch (error) {
        console.error('Failed to initialize messaging analytics:', error);
      }

      try {
        // Initialize monitoring service lazily to avoid circular dependencies
        const { monitoringService } = await import('../src/services/monitoringService');
        await monitoringService.initialize();
      } catch (error) {
        console.error('Failed to initialize monitoring:', error);
      }

      // Set app as ready after all services are initialized
      setIsReady(true);
    };

    // Start service initialization
    initializeServices();

    // Cleanup services on unmount
    return () => {
      try {
        analyticsService.shutdown();
      } catch (error) {
        console.error('Error shutting down analytics:', error);
      }
      try {
        messageSchedulingService.cleanup();
      } catch (error) {
        console.error('Error cleaning up message scheduling:', error);
      }
      try {
        offlineMessageService.cleanup();
      } catch (error) {
        console.error('Error cleaning up offline messages:', error);
      }
      try {
        pushNotificationService.cleanup();
      } catch (error) {
        console.error('Error cleaning up push notifications:', error);
      }
      try {
        encryptionService.cleanup();
      } catch (error) {
        console.error('Error cleaning up encryption:', error);
      }
      try {
        voiceMessageService.cleanup();
      } catch (error) {
        console.error('Error cleaning up voice messages:', error);
      }
    };
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#131318' }}>
        <ActivityIndicator size="large" color="#6E69F4" />
      </View>
    );
  }

  return (
    <ErrorBoundary onError={handleError}>
      <WebResponsiveWrapper>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <PaperProvider theme={paperTheme}>
              <AppContext.Provider value={{ fontsLoaded }}>
                <MenuPositionProvider>
                  {/* AuthProvider must be the outermost context provider for user-dependent contexts */}
                  <ErrorBoundary onError={(error, errorInfo) => {
                    console.error('Auth Provider Error:', error, errorInfo);
                    analyticsService.reportError({
                      error,
                      componentStack: errorInfo.componentStack || '',
                      metadata: { component: 'AuthProvider', timestamp: Date.now() }
                    });
                  }}>
                    <AuthProvider>
                      <AppLoadingWrapper>
                        {/* UserStatusProvider depends on AuthProvider */}
                        <ErrorBoundary onError={(error, errorInfo) => {
                          console.error('UserStatus Provider Error:', error, errorInfo);
                        }}>
                          <UserStatusProvider>
                            {/* UserProfileProvider depends on AuthProvider */}
                            <ErrorBoundary onError={(error, errorInfo) => {
                              console.error('UserProfile Provider Error:', error, errorInfo);
                            }}>
                              <UserProfileProvider>
                                {/* NotificationProvider depends on AuthProvider and UserProfileProvider */}
                                <ErrorBoundary onError={(error, errorInfo) => {
                                  console.error('Notification Provider Error:', error, errorInfo);
                                }}>
                                  <NotificationProvider>
                                    {/* LiveStreamProvider depends on AuthProvider */}
                                    <ErrorBoundary onError={(error, errorInfo) => {
                                      console.error('LiveStream Provider Error:', error, errorInfo);
                                    }}>
                                      <LiveStreamProvider>
                                        {/* MusicProvider depends on AuthProvider */}
                                        <ErrorBoundary onError={(error, errorInfo) => {
                                          console.error('Music Provider Error:', error, errorInfo);
                                        }}>
                                          <MusicProvider>
                                            {/* GamingProvider depends on AuthProvider */}
                                            <ErrorBoundary onError={(error, errorInfo) => {
                                              console.error('Gaming Provider Error:', error, errorInfo);
                                            }}>
                                              <GamingProvider>
                                                {/* ShopProvider depends on AuthProvider */}
                                                <ErrorBoundary onError={(error, errorInfo) => {
                                                  console.error('Shop Provider Error:', error, errorInfo);
                                                }}>
                                                  <ShopProvider>
                                                    {/* MiniPlayerProvider for global mini player overlay */}
                                                    <ErrorBoundary onError={(error, errorInfo) => {
                                                      console.error('MiniPlayer Provider Error:', error, errorInfo);
                                                    }}>
                                                      <MiniPlayerProvider>
                                                        <StatusBar style="light" backgroundColor="#131318" />
                                                        <Stack
                                                          screenOptions={{
                                                            headerShown: false,
                                                            contentStyle: { backgroundColor: '#0f1117' },
                                                          }}
                                                        />
                                                      </MiniPlayerProvider>
                                                    </ErrorBoundary>
                                                  </ShopProvider>
                                                </ErrorBoundary>
                                              </GamingProvider>
                                            </ErrorBoundary>
                                          </MusicProvider>
                                        </ErrorBoundary>
                                      </LiveStreamProvider>
                                    </ErrorBoundary>
                                  </NotificationProvider>
                                </ErrorBoundary>
                              </UserProfileProvider>
                            </ErrorBoundary>
                          </UserStatusProvider>
                        </ErrorBoundary>
                      </AppLoadingWrapper>
                    </AuthProvider>
                  </ErrorBoundary>
                </MenuPositionProvider>
              </AppContext.Provider>
            </PaperProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </WebResponsiveWrapper>
    </ErrorBoundary>
  );
}


