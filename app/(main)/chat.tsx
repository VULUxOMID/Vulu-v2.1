import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, BackHandler, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation, useFocusEffect } from 'expo-router';
import ChatScreen from '../../src/screens/ChatScreen';

export default function Chat() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();

  // Extract and validate parameters with proper defaults
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const name = typeof params.name === 'string' ? params.name : '';
  const avatar = typeof params.avatar === 'string' ? params.avatar : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || 'User') + '&background=6E69F4&color=FFFFFF&size=150';
  const source = typeof params.source === 'string' ? params.source : 'direct-messages';

  // Validate required parameters immediately
  const isValidParams = Boolean(userId && name);

  // Log parameters for debugging
  useEffect(() => {
    console.log('Chat screen params:', { userId, name, avatar, source, isValidParams });
  }, [userId, name, avatar, source, isValidParams]);

  // Simplified navigation handlers
  const handleGoBack = useCallback(() => {
    try {
      if (source === 'notifications') {
        router.push('/(main)/notifications');
      } else if (source === 'live') {
        router.push('/(main)');
      } else {
        // Default to direct messages
        router.push('/(main)/directmessages');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to main screen
      router.push('/(main)');
    }
  }, [source, router]);

  const goToDMs = () => {
    try {
      router.push('/(main)/directmessages');
    } catch (error) {
      console.error('Navigation error:', error);
      router.push('/(main)');
    }
  };

  // Set up hardware back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoBack();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [source, handleGoBack]);

  // Show error state if parameters are invalid
  if (!isValidParams) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Error loading chat</Text>
        <Text style={styles.subErrorText}>Missing required information (userId: {userId}, name: {name})</Text>
        <Text style={styles.backButton} onPress={handleGoBack}>
          Go back to messages
        </Text>
      </View>
    );
  }

  // Render chat screen with valid parameters
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: true,
        }}
      />

      <ChatScreen
        userId={userId}
        name={name}
        avatar={avatar}
        goBack={handleGoBack}
        goToDMs={goToDMs}
        source={source}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131318',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subErrorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    color: '#6E69F4',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    padding: 12,
    marginTop: 16,
  }
});