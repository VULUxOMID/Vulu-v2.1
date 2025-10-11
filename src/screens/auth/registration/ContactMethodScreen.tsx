import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TextInput } from 'react-native';
import {
  RegistrationHeader,
  RegistrationCard,
  RegistrationFooter
} from '../../../components/auth/RegistrationComponents';
import { AuthColors } from '../../../components/auth/AuthDesignSystem';
import { DiscordSegmentedControl } from '../../../components/onboarding/DiscordSegmentedControl';
import { PhoneNumberInput } from '../../../components/auth/PhoneNumberInput';
import { useRegistration } from '../../../context/RegistrationContext';
import { Country } from '../../../data/countries';
import { smsVerificationService } from '../../../services/smsVerificationService';
import { createSafeStateSetter } from '../../../utils/safePropertySet';

interface ContactMethodScreenProps {
  onBackToLanding?: () => void;
  isGuestUpgrade?: boolean;
}

const ContactMethodScreen: React.FC<ContactMethodScreenProps> = ({ onBackToLanding, isGuestUpgrade = false }) => {
  const {
    registrationData,
    updateRegistrationData,
    setCurrentStep,
    validateStep,
    isLoading,
    setIsLoading,
    error,
    setError
  } = useRegistration();

  const [contactMethod, setContactMethod] = useState<'phone' | 'email'>(
    registrationData.contactMethod || 'email'
  );
  const [contactValue, setContactValue] = useState(registrationData.contactValue || '');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Create safe setters to prevent Hermes crashes
  const safeSetError = (value: string | null) => {
    try {
      setError(value);
    } catch (error) {
      console.error('Safe setError failed:', error);
    }
  };

  const safeSetEmailError = (value: string | null) => {
    try {
      setEmailError(value);
    } catch (error) {
      console.error('Safe setEmailError failed:', error);
    }
  };

  const safeSetCheckingEmail = (value: boolean) => {
    try {
      setCheckingEmail(value);
    } catch (error) {
      console.error('Safe setCheckingEmail failed:', error);
    }
  };

  const safeSetContactValue = (value: string) => {
    try {
      setContactValue(value);
    } catch (error) {
      console.error('Safe setContactValue failed:', error);
    }
  };

  const safeSetPhoneValidationError = (value: string | null) => {
    try {
      setPhoneValidationError(value);
    } catch (error) {
      console.error('Safe setPhoneValidationError failed:', error);
    }
  };

  React.useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

  // COMPREHENSIVE real-time email validation with debug logging
  useEffect(() => {
    console.log('🔍 Email validation useEffect triggered:', { contactValue, contactMethod });

    if (contactValue && contactMethod === 'email') {
      // Validate email format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactValue)) {
        console.log('❌ Invalid email format:', contactValue);
        safeSetEmailError('Please enter a valid email address');
        safeSetError(null);
        return;
      }

      // Debounce email checking
      const timeoutId = setTimeout(async () => {
        console.log('🔄 Starting email availability check for:', contactValue);
        safeSetCheckingEmail(true);
        safeSetEmailError(null);

        try {
          console.log('🔍 Importing authService...');
          const { default: authService } = await import('../../../services/authService');
          console.log('🔍 Calling isEmailRegistered for:', contactValue);
          const isEmailRegistered = await authService.isEmailRegistered(contactValue);
          console.log('📧 Email registration check result:', { email: contactValue, isRegistered: isEmailRegistered });

          if (isEmailRegistered) {
            console.log('❌ Email is already registered, setting error:', contactValue);
            safeSetEmailError('This email is already registered. Please sign in instead.');
            // Don't set the main error - only use emailError for email-specific validation
          } else {
            console.log('✅ Email is available, clearing errors:', contactValue);
            safeSetEmailError(null);
            safeSetError(null);
          }
        } catch (err: any) {
          console.error('❌ Email validation failed:', err);
          safeSetEmailError('Unable to verify email. Please try again.');
          // Don't set the main error - only use emailError for email-specific validation
        } finally {
          console.log('🔄 Email check completed, setting checkingEmail to false');
          safeSetCheckingEmail(false);
        }
      }, 1000); // 1 second debounce

      return () => clearTimeout(timeoutId);
    } else {
      console.log('🔄 Clearing email error (no contact value or not email method)');
      safeSetEmailError(null);
    }
  }, [contactValue, contactMethod]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 Email validation state update:', {
      contactValue,
      contactMethod,
      emailError,
      checkingEmail,
      buttonDisabled: !contactValue.trim() || checkingEmail || !!emailError || isLoading
    });
  }, [contactValue, contactMethod, emailError, checkingEmail, isLoading]);

  const handleContactMethodChange = (method: 'phone' | 'email') => {
    setContactMethod(method);
    setContactValue(''); // Clear input when switching methods
    setError(null);
    setPhoneValidationError(null);
  };

  const handleContactValueChange = (value: string) => {
    safeSetContactValue(value);
    safeSetError(null);
    safeSetPhoneValidationError(null);
    safeSetEmailError(null);
  };

  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
  };

  const handlePhoneValidationChange = (isValid: boolean, error?: string) => {
    setPhoneValidationError(error || null);
    // Clear the main error if phone validation passes
    if (isValid) {
      setError(null);
    }
  };

  const handleNext = async () => {
    console.log('🔄 handleNext called with state:', {
      contactValue: contactValue.trim(),
      contactMethod,
      emailError,
      checkingEmail,
      isLoading
    });

    setIsLoading(true);
    safeSetError(null);

    // Validate current input
    const trimmedValue = contactValue.trim();

    if (!trimmedValue) {
      console.log('❌ No contact value provided');
      safeSetError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    // Check if email validation is still in progress
    if (checkingEmail) {
      console.log('❌ Email validation still in progress');
      safeSetError('Please wait while we verify your email...');
      setIsLoading(false);
      return;
    }

    // Check if email has validation errors
    if (emailError) {
      console.log('❌ Email has validation error:', emailError);
      safeSetError(emailError);
      setIsLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (contactMethod === 'email' && !emailRegex.test(trimmedValue)) {
      console.log('❌ Invalid email format:', trimmedValue);
      safeSetError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    console.log('✅ All validations passed, proceeding to next step');

    // Update registration data
    updateRegistrationData({
      contactMethod,
      contactValue: trimmedValue,
    });

    try {
      // For email registration - proceed to next step
      console.log('📧 Email registration validated - proceeding to next step');

      // Simulate brief processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Move to next step (display name)
      setCurrentStep(2);
    } catch (err: any) {
      safeSetError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getInputPlaceholder = () => {
    return contactMethod === 'email' 
      ? 'Enter your email address'
      : 'Enter your phone number';
  };

  const getInputKeyboardType = () => {
    return contactMethod === 'email' ? 'email-address' : 'phone-pad';
  };

  const handleBack = () => {
    if (onBackToLanding) {
      onBackToLanding();
    }
  };

  return (
    <View style={styles.container}>
      <RegistrationHeader
        title={isGuestUpgrade ? "Upgrade Account" : "Sign up"}
        currentStep={1}
        totalSteps={5}
        onBackPress={handleBack}
        showBackButton={true}
      />

      {/* Simplified layout - no complex nesting */}
      <View style={styles.content}>
        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {isGuestUpgrade
            ? "Choose your preferred method to upgrade your guest account to a full VuluGO account"
            : "Choose your preferred method to create your VuluGO account"
          }
        </Text>

        {/* Discord-style segmented control */}
        <View style={styles.selectorContainer}>
          <DiscordSegmentedControl
            options={[
              { value: 'email', label: 'Email' },
              { value: 'phone', label: 'Phone' }
            ]}
            selectedValue={contactMethod}
            onValueChange={(value) => handleContactMethodChange(value as 'email' | 'phone')}
          />
        </View>

        {/* Contact Input */}
        <View style={styles.inputSection}>
          {contactMethod === 'email' ? (
            // Email Input
            <>
              <Text style={styles.inputLabel}>EMAIL ADDRESS *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.textInput,
                    emailError && styles.textInputError,
                    checkingEmail && styles.textInputChecking
                  ]}
                  value={contactValue}
                  onChangeText={handleContactValueChange}
                  placeholder={getInputPlaceholder()}
                  placeholderTextColor="#9AA3B2"
                  keyboardType={getInputKeyboardType()}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading && !checkingEmail}
                />
                {checkingEmail && (
                  <Text style={styles.checkingText}>Checking availability...</Text>
                )}
              </View>
              {emailError && <Text style={styles.errorText}>{emailError}</Text>}
              {!emailError && error && <Text style={styles.errorText}>{error}</Text>}
            </>
          ) : (
            // Phone Number Input with Country Code Selector
            <PhoneNumberInput
              value={contactValue}
              onChangeText={handleContactValueChange}
              onCountryChange={handleCountryChange}
              onValidationChange={handlePhoneValidationChange}
              error={phoneValidationError || error}
              disabled={isLoading}
              showValidation={true}
            />
          )}
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            {contactMethod === 'email'
              ? `We'll send you a verification email to ${isGuestUpgrade ? 'upgrade your account' : 'confirm your account'}`
              : `We'll send you a verification code via SMS to ${isGuestUpgrade ? 'upgrade your account' : 'confirm your account'}`
            }
          </Text>
          {contactMethod === 'phone' && selectedCountry && (
            <Text style={styles.countryHelpText}>
              Selected: {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.dialCode})
            </Text>
          )}
        </View>
      </View>

      <RegistrationFooter
        primaryButtonText={checkingEmail ? "Verifying..." : "Next"}
        onPrimaryPress={handleNext}
        primaryButtonDisabled={
          !contactValue.trim() ||
          checkingEmail ||
          !!emailError ||
          isLoading
        }
        primaryButtonLoading={isLoading || checkingEmail}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117', // Exact dark mode background
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#151924', // Card background
    marginHorizontal: 24,
    marginVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252A3A',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  selectorContainer: {
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    backgroundColor: '#1e2230',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#252A3A',
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  textInputError: {
    borderColor: '#FF6B6B',
  },
  textInputChecking: {
    borderColor: '#FFA500',
  },
  checkingText: {
    fontSize: 12,
    color: '#FFA500',
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    marginTop: 8,
  },
  helpContainer: {
    backgroundColor: '#0f1117',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#252A3A',
  },
  helpText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9AA3B2',
    textAlign: 'center',
    lineHeight: 20,
  },
  countryHelpText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6E69F4',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ContactMethodScreen;
