import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

export const useGuestRestrictions = () => {
  const authContext = useAuth();
  const isGuest = authContext?.isGuest || false;
  const signOut = authContext?.signOut || (() => Promise.resolve());
  const router = useRouter();

  const navigateToAuthSelection = () => {
    console.log('🔄 Guest user navigating to auth selection screen');
    router.push('/auth/selection');
  };

  const handleGuestRestriction = (feature: string) => {
    // Navigate directly to auth selection page (which has login option) instead of showing popup
    console.log(`🎭 Guest user trying to access ${feature}, redirecting to auth selection`);
    router.push('/auth/selection');
  };

  const canSendMessages = () => {
    if (isGuest) {
      handleGuestRestriction('messaging');
      return false;
    }
    return true;
  };

  const canCreateContent = () => {
    if (isGuest) {
      handleGuestRestriction('content creation');
      return false;
    }
    return true;
  };

  const canMakePurchases = () => {
    if (isGuest) {
      handleGuestRestriction('purchases');
      return false;
    }
    return true;
  };

  const canAddFriends = () => {
    if (isGuest) {
      handleGuestRestriction('adding friends');
      return false;
    }
    return true;
  };

  const canAccessPremiumFeatures = () => {
    if (isGuest) {
      handleGuestRestriction('premium features');
      return false;
    }
    return true;
  };

  const canSaveData = () => {
    if (isGuest) {
      // Guest data is temporary and not saved
      return false;
    }
    return true;
  };

  const canEditProfile = () => {
    if (isGuest) {
      handleGuestRestriction('profile editing');
      return false;
    }
    return true;
  };

  const canManagePhotos = () => {
    if (isGuest) {
      handleGuestRestriction('photo management');
      return false;
    }
    return true;
  };

  const canChangeStatus = () => {
    if (isGuest) {
      handleGuestRestriction('status changes');
      return false;
    }
    return true;
  };

  const canUseSpotlight = () => {
    if (isGuest) {
      handleGuestRestriction('spotlight features');
      return false;
    }
    return true;
  };

  const canBoostOthers = () => {
    if (isGuest) {
      handleGuestRestriction('boosting other users');
      return false;
    }
    return true;
  };

  const canViewFriends = () => {
    if (isGuest) {
      handleGuestRestriction('viewing friends');
      return false;
    }
    return true;
  };

  const canViewActiveStatus = () => {
    if (isGuest) {
      handleGuestRestriction('viewing active status');
      return false;
    }
    return true;
  };

  const getGuestGoldLimit = () => 500;
  const getGuestGemsLimit = () => 10;

  const isAtGoldLimit = (currentGold: number) => {
    return isGuest && currentGold >= getGuestGoldLimit();
  };

  const isAtGemsLimit = (currentGems: number) => {
    return isGuest && currentGems >= getGuestGemsLimit();
  };

  return {
    isGuest,
    canSendMessages,
    canCreateContent,
    canMakePurchases,
    canAddFriends,
    canAccessPremiumFeatures,
    canSaveData,
    canEditProfile,
    canManagePhotos,
    canChangeStatus,
    canUseSpotlight,
    canBoostOthers,
    canViewFriends,
    canViewActiveStatus,
    getGuestGoldLimit,
    getGuestGemsLimit,
    isAtGoldLimit,
    isAtGemsLimit,
    handleGuestRestriction,
  };
}; 