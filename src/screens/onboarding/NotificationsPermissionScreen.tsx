import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { OnboardingCenteredCard } from '../../components/onboarding/OnboardingCard';
import { OnboardingHeader } from '../../components/onboarding/OnboardingHeader';
import { OnboardingFooter } from '../../components/onboarding/OnboardingFooter';
import { AuthColors, AuthTypography } from '../../components/auth/AuthDesignSystem';
import { useOnboarding } from '../../context/OnboardingContext';
import { pushNotificationService, NotificationPermissionError } from '../../services/pushNotificationService';

type NotificationsPermissionScreenNavigationProp = StackNavigationProp<OnboardingStackParamList, 'NotificationsPermission'>;

const NotificationsPermissionScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsPermissionScreenNavigationProp>();
  const { updateOnboardingData, markStepCompleted, currentStep } = useOnboarding();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleBack = () => navigation.goBack();

  const handleAllow = async () => {
    try {
      setIsRequesting(true);
      // Actually request notification permissions from the system
      const token = await pushNotificationService.registerForPushNotifications();
      
      updateOnboardingData({ notificationsEnabled: !!token });
      markStepCompleted(8);
      navigation.navigate('AvatarPicker');
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      
      // Handle specific error types
      if (error instanceof NotificationPermissionError) {
        let errorMessage = '';
        switch (error.reason) {
          case 'denied':
            errorMessage = 'Notification permission was denied. You can enable it later in Settings.';
            break;
          case 'device_not_supported':
            errorMessage = 'Notifications are only available on physical devices.';
            break;
          case 'network_error':
            errorMessage = 'Network error occurred. Please check your connection and try again.';
            break;
          case 'token_error':
            errorMessage = 'Failed to register for notifications. You can try again later in Settings.';
            break;
        }
        
        Alert.alert('Notification Setup', errorMessage, [
          {
            text: 'Continue',
            onPress: () => {
              updateOnboardingData({ notificationsEnabled: false });
              markStepCompleted(8);
              navigation.navigate('AvatarPicker');
            },
          },
        ]);
      } else {
        // Unknown error - continue anyway
        updateOnboardingData({ notificationsEnabled: false });
        markStepCompleted(8);
        navigation.navigate('AvatarPicker');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleNotNow = () => {
    updateOnboardingData({ notificationsEnabled: false });
    markStepCompleted(8);
    navigation.navigate('AvatarPicker');
  };

  return (
    <View style={styles.container}>
      <OnboardingHeader onBackPress={handleBack} />
      <OnboardingCenteredCard
        illustration={
          <View style={styles.iconCircle}>
            <Ionicons name="notifications" size={48} color="#FFFFFF" />
          </View>
        }
        title={<Text style={styles.title}>Stay Updated</Text>}
        subtitle={<Text style={styles.subtitle}>Get notified about messages, friend requests, and important updates</Text>}
      >
        <View style={styles.benefitsList}>
          <View style={styles.benefit}>
            <Ionicons name="chatbubble" size={16} color={AuthColors.primaryButton} />
            <Text style={styles.benefitText}>New messages from friends</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="person-add" size={16} color={AuthColors.primaryButton} />
            <Text style={styles.benefitText}>Friend requests and connections</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="trophy" size={16} color={AuthColors.primaryButton} />
            <Text style={styles.benefitText}>Game achievements and challenges</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="musical-notes" size={16} color={AuthColors.primaryButton} />
            <Text style={styles.benefitText}>New music recommendations</Text>
          </View>
        </View>
      </OnboardingCenteredCard>
      <OnboardingFooter
        primaryButtonText={isRequesting ? "Requesting..." : "Allow Notifications"}
        onPrimaryPress={handleAllow}
        secondaryText="Not now"
        onSecondaryPress={handleNotNow}
        currentStep={currentStep}
        primaryButtonDisabled={isRequesting}
      />
      {isRequesting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={AuthColors.primaryButton} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AuthColors.background },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: AuthColors.primaryButton,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: AuthColors.primaryButton,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: { ...AuthTypography.onboardingTitle, marginBottom: 8 },
  subtitle: { ...AuthTypography.bodyText, textAlign: 'center', paddingHorizontal: 16 },
  benefitsList: {
    marginTop: 24,
    gap: 12,
    alignSelf: 'stretch',
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: AuthColors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AuthColors.divider,
  },
  benefitText: {
    ...AuthTypography.bodyText,
    fontSize: 14,
    color: AuthColors.secondaryText,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationsPermissionScreen;
