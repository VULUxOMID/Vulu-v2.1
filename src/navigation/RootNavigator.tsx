/**
 * Root Navigator
 * Handles auth flow and main app navigation
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth, useAuthSafe } from '../context/AuthContext';

// Auth Screens
import OnboardingNavigator from './OnboardingNavigator';
import AuthSelectionScreen from '../screens/auth/AuthSelectionScreen';
import NewAuthScreen from '../screens/auth/NewAuthScreen';

// Main App
import MainNavigator from './MainNavigator';

export type RootStackParamList = {
  AuthSelection: undefined;
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  // Safely get auth context
  const authContext = useAuthSafe();
  const user = authContext?.user;
  const loading = authContext?.loading;

  // Auth flow state
  const [authFlow, setAuthFlow] = useState<'selection' | 'login' | 'register' | null>(null);

  // Loading screen while auth initializes
  if (!authContext || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#131318' }}>
        <ActivityIndicator size="large" color="#6E69F4" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>
          Loading...
        </Text>
      </View>
    );
  }

  // If user is authenticated, show main app
  if (user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainNavigator} />
      </Stack.Navigator>
    );
  }

  // No user - show auth flow
  return (
    <Stack.Navigator 
      initialRouteName="AuthSelection"
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#131318' }
      }}
    >
      <Stack.Screen name="AuthSelection">
        {({ navigation }) => (
          <AuthSelectionScreen
            onSignUpPress={() => {
              setAuthFlow('register');
              navigation.navigate('Register');
            }}
            onLoginPress={() => {
              setAuthFlow('login');
              navigation.navigate('Login');
            }}
            onGuestContinue={async () => {
              // Handle guest sign in via AuthContext
              if (authContext?.signInAsGuest) {
                try {
                  await authContext.signInAsGuest();
                } catch (error) {
                  console.error('Guest sign in failed:', error);
                }
              }
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Register">
        {({ navigation }) => (
          <OnboardingNavigator
            onComplete={() => {
              // Registration complete, user will be auto-navigated to main
            }}
            onBack={() => {
              navigation.goBack();
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Login">
        {({ navigation }) => (
          <NewAuthScreen
            onBackPress={() => {
              navigation.goBack();
            }}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

