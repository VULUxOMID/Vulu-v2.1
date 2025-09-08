/**
 * Offline Status Indicator Component
 * Shows network status and pending message count
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useOfflineMessages } from '../hooks/useOfflineMessages';

interface OfflineStatusIndicatorProps {
  onPress?: () => void;
  style?: any;
}

const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  onPress,
  style,
}) => {
  const { syncStats } = useOfflineMessages();
  const [pulseAnim] = React.useState(new Animated.Value(1));

  // Animate when syncing
  React.useEffect(() => {
    if (syncStats.isSyncing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [syncStats.isSyncing, pulseAnim]);

  // Don't show if online and no pending messages
  if (syncStats.isOnline && syncStats.totalPending === 0 && !syncStats.isSyncing) {
    return null;
  }

  const getStatusColor = () => {
    if (!syncStats.isOnline) return '#FF3B30'; // Red for offline
    if (syncStats.isSyncing) return '#FF9500'; // Orange for syncing
    if (syncStats.totalPending > 0) return '#007AFF'; // Blue for pending
    return '#34C759'; // Green for all good
  };

  const getStatusIcon = () => {
    if (!syncStats.isOnline) return 'wifi-off';
    if (syncStats.isSyncing) return 'sync';
    if (syncStats.totalPending > 0) return 'schedule';
    return 'wifi';
  };

  const getStatusText = () => {
    if (!syncStats.isOnline) {
      return syncStats.totalPending > 0 
        ? `Offline • ${syncStats.totalPending} pending`
        : 'Offline';
    }
    if (syncStats.isSyncing) {
      return 'Syncing messages...';
    }
    if (syncStats.totalPending > 0) {
      return `${syncStats.totalPending} message${syncStats.totalPending === 1 ? '' : 's'} pending`;
    }
    return 'All messages sent';
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: getStatusColor() }, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.content, { opacity: pulseAnim }]}>
        <MaterialIcons
          name={getStatusIcon() as any}
          size={16}
          color="#FFFFFF"
          style={styles.icon}
        />
        <Text style={styles.text}>{getStatusText()}</Text>
        {syncStats.totalFailed > 0 && (
          <View style={styles.failedBadge}>
            <Text style={styles.failedText}>{syncStats.totalFailed}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  failedBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  failedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default OfflineStatusIndicator;
