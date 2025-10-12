import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '../context/SubscriptionContext';
import { SubscriptionPlan, BillingCycle } from '../services/types';
import BackButton from '../components/BackButton';

const SubscriptionScreen = () => {
  const navigation = useNavigation();
  const {
    subscription,
    currentPlan,
    subscriptionStatus,
    daysUntilRenewal,
    dailyGems,
    availablePlans,
    subscribeToPlan,
    cancelSubscription,
    isSubscriptionActive,
    isOnTrial,
    getTrialDaysRemaining,
    isLoading
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('gem_plus');
  const [selectedBilling, setSelectedBilling] = useState<BillingCycle>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    try {
      setIsProcessing(true);
      await subscribeToPlan(selectedPlan, selectedBilling);
      Alert.alert(
        'Success!',
        `You've successfully subscribed to ${selectedPlan}!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              await cancelSubscription();
              Alert.alert('Subscription Cancelled', 'Your subscription has been cancelled.');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const renderCurrentSubscription = () => {
    if (!subscription || currentPlan === 'free') {
      return (
        <View style={styles.currentSubscriptionCard}>
          <Text style={styles.currentSubscriptionTitle}>Inactive</Text>
          <Text style={styles.currentSubscriptionSubtitle}>
            {dailyGems > 0 ? `${dailyGems} gems per day` : 'No gems included'}
          </Text>
          <Text style={styles.upgradeText}>
            Upgrade to get daily gems:
          </Text>
          <Text style={styles.upgradeText}>
            Weekly: 200 gems • Monthly: 500 gems
          </Text>
        </View>
      );
    }

    return (
      <LinearGradient
        colors={['#B768FB', '#8C67D4']}
        style={styles.currentSubscriptionCard}
      >
        <View style={styles.subscriptionHeader}>
          <Text style={styles.currentSubscriptionTitle}>
            {currentPlan === 'gem_plus' ? 'Gem+' : 
             currentPlan === 'premium' ? 'Premium' : 
             currentPlan === 'vip' ? 'VIP' : 'Current Plan'}
          </Text>
          {isOnTrial() && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>TRIAL</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.currentSubscriptionSubtitle}>
          {dailyGems} gems per day
        </Text>
        
        <View style={styles.subscriptionDetails}>
          <Text style={styles.subscriptionDetailText}>
            Status: {subscriptionStatus.toUpperCase()}
          </Text>
          <Text style={styles.subscriptionDetailText}>
            {isOnTrial() 
              ? `Trial ends in ${getTrialDaysRemaining()} days`
              : `Renews in ${daysUntilRenewal} days`
            }
          </Text>
        </View>

        {isSubscriptionActive() && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isProcessing}
          >
            <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    );
  };

  const renderPlanCard = (plan: any) => {
    const isSelected = selectedPlan === plan.id;
    const isCurrent = currentPlan === plan.id;
    
    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          isCurrent && styles.planCardCurrent
        ]}
        onPress={() => setSelectedPlan(plan.id)}
        disabled={isCurrent}
      >
        {plan.isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>POPULAR</Text>
          </View>
        )}
        
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planDescription}>{plan.description}</Text>
        
        <View style={styles.planFeatures}>
          <Text style={styles.featureText}>• {plan.features.dailyGems} gems per day</Text>
          <Text style={styles.featureText}>
            • {plan.features.maxStreams === -1 ? 'Unlimited' : plan.features.maxStreams} streams
          </Text>
          {plan.features.ghostMode && (
            <Text style={styles.featureText}>• Ghost Mode</Text>
          )}
          {plan.features.profileViews && (
            <Text style={styles.featureText}>• See profile views</Text>
          )}
          {plan.features.adFree && (
            <Text style={styles.featureText}>• Ad-free experience</Text>
          )}
        </View>
        
        <View style={styles.planPricing}>
          <Text style={styles.planPrice}>
            ${selectedBilling === 'monthly' ? plan.pricing.monthly : plan.pricing.yearly}
            <Text style={styles.planPricePeriod}>
              /{selectedBilling === 'monthly' ? 'month' : 'year'}
            </Text>
          </Text>
          {plan.trialDays && !isCurrent && (
            <Text style={styles.trialText}>{plan.trialDays}-day free trial</Text>
          )}
        </View>
        
        {isCurrent && (
          <View style={styles.currentPlanBadge}>
            <Text style={styles.currentPlanBadgeText}>CURRENT PLAN</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#B768FB" />
          <Text style={styles.loadingText}>Loading subscription data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Plan</Text>
          {renderCurrentSubscription()}
        </View>

        {/* Billing Cycle Selector */}
        {currentPlan === 'free' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Billing Cycle</Text>
              <View style={styles.billingSelector}>
                <TouchableOpacity
                  style={[
                    styles.billingOption,
                    selectedBilling === 'monthly' && styles.billingOptionSelected
                  ]}
                  onPress={() => setSelectedBilling('monthly')}
                >
                  <Text style={[
                    styles.billingOptionText,
                    selectedBilling === 'monthly' && styles.billingOptionTextSelected
                  ]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.billingOption,
                    selectedBilling === 'yearly' && styles.billingOptionSelected
                  ]}
                  onPress={() => setSelectedBilling('yearly')}
                >
                  <Text style={[
                    styles.billingOptionText,
                    selectedBilling === 'yearly' && styles.billingOptionTextSelected
                  ]}>Yearly</Text>
                  <Text style={styles.savingsText}>Save 17%</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Available Plans */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Your Plan</Text>
              {availablePlans
                .filter(plan => plan.id !== 'free')
                .map(plan => renderPlanCard(plan))}
            </View>

            {/* Subscribe Button */}
            <TouchableOpacity
              style={[styles.subscribeButton, isProcessing && styles.subscribeButtonDisabled]}
              onPress={handleSubscribe}
              disabled={isProcessing}
            >
              <LinearGradient
                colors={['#B768FB', '#8C67D4']}
                style={styles.subscribeButtonGradient}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="diamond-stone" size={20} color="#FFFFFF" />
                    <Text style={styles.subscribeButtonText}>
                      Subscribe to {selectedPlan === 'gem_plus' ? 'Gem+' : 
                                   selectedPlan === 'premium' ? 'Premium' : 
                                   selectedPlan === 'vip' ? 'VIP' : 'Plan'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131318',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  currentSubscriptionCard: {
    backgroundColor: '#1C1D23',
    borderRadius: 16,
    padding: 20,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  currentSubscriptionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  currentSubscriptionSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginBottom: 12,
  },
  upgradeText: {
    color: '#B768FB',
    fontSize: 14,
    fontStyle: 'italic',
  },
  subscriptionDetails: {
    marginBottom: 16,
  },
  subscriptionDetailText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  trialBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trialBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  billingSelector: {
    flexDirection: 'row',
    backgroundColor: '#1C1D23',
    borderRadius: 12,
    padding: 4,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  billingOptionSelected: {
    backgroundColor: '#B768FB',
  },
  billingOptionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  billingOptionTextSelected: {
    color: '#FFFFFF',
  },
  savingsText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  planCard: {
    backgroundColor: '#1C1D23',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#B768FB',
  },
  planCardCurrent: {
    borderColor: '#4CAF50',
    opacity: 0.7,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 16,
  },
  planFeatures: {
    marginBottom: 16,
  },
  featureText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  planPricing: {
    alignItems: 'center',
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  planPricePeriod: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  trialText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  currentPlanBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentPlanBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  subscribeButton: {
    marginVertical: 20,
    marginBottom: 40,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default SubscriptionScreen;
