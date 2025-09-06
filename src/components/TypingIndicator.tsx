import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface TypingUser {
  id: string;
  name: string;
  avatar?: string;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  maxDisplayUsers?: number;
}

const TypingIndicator = ({ typingUsers, maxDisplayUsers = 3 }: TypingIndicatorProps) => {
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  // Don't render if no users are typing
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  const getTypingText = (): string => {
    const displayUsers = typingUsers.slice(0, maxDisplayUsers);
    const remainingCount = typingUsers.length - maxDisplayUsers;

    if (displayUsers.length === 1) {
      return `${displayUsers[0].name} is typing...`;
    } else if (displayUsers.length === 2) {
      return `${displayUsers[0].name} and ${displayUsers[1].name} are typing...`;
    } else if (displayUsers.length === 3) {
      return `${displayUsers[0].name}, ${displayUsers[1].name}, and ${displayUsers[2].name} are typing...`;
    } else {
      const names = displayUsers.slice(0, 2).map(user => user.name).join(', ');
      return `${names}, and ${remainingCount + 1} others are typing...`;
    }
  };

  useEffect(() => {
    // Fade in the container
    Animated.timing(containerOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const animateDots = () => {
      const animateSequence = Animated.sequence([
        Animated.timing(dot1Opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dot2Opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dot3Opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dot1Opacity, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dot2Opacity, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dot3Opacity, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
      ]);

      Animated.loop(animateSequence).start();
    };

    animateDots();

    // Cleanup animation on unmount
    return () => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };
  }, [dot1Opacity, dot2Opacity, dot3Opacity, containerOpacity, typingUsers.length]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.messageContainer}>
        <View style={styles.avatarContainer}>
          {typingUsers.slice(0, 2).map((user, index) => (
            <View
              key={user.id}
              style={[
                styles.avatar,
                index > 0 && styles.overlappingAvatar
              ]}
            >
              <Text style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          ))}
          {typingUsers.length > 2 && (
            <View style={[styles.avatar, styles.overlappingAvatar, styles.moreUsersAvatar]}>
              <Text style={styles.avatarText}>+{typingUsers.length - 2}</Text>
            </View>
          )}
        </View>

        <View style={styles.bubble}>
          <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
            <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
            <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
          </View>
        </View>
      </View>

      <Text style={styles.typingText}>{getTypingText()}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '80%',
  },
  avatarContainer: {
    flexDirection: 'row',
    marginRight: 8,
    marginBottom: 4,
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bubble: {
    backgroundColor: '#2D2E38',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 2,
  },
  overlappingAvatar: {
    marginLeft: -8,
  },
  moreUsersAvatar: {
    backgroundColor: '#666',
  },
  typingText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    marginLeft: 40,
    fontStyle: 'italic',
  },
});

export default TypingIndicator;
