import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface TypingIndicatorProps {
  userName: string;
  avatar?: string;
}

const TypingIndicator = ({ userName, avatar }: TypingIndicatorProps) => {
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDots = () => {
      const duration = 600;
      const delay = 200;

      const animateSequence = Animated.sequence([
        Animated.timing(dot1Opacity, {
          toValue: 1,
          duration: duration / 3,
          useNativeDriver: true,
        }),
        Animated.timing(dot2Opacity, {
          toValue: 1,
          duration: duration / 3,
          useNativeDriver: true,
        }),
        Animated.timing(dot3Opacity, {
          toValue: 1,
          duration: duration / 3,
          useNativeDriver: true,
        }),
        Animated.timing(dot1Opacity, {
          toValue: 0.3,
          duration: duration / 3,
          useNativeDriver: true,
        }),
        Animated.timing(dot2Opacity, {
          toValue: 0.3,
          duration: duration / 3,
          useNativeDriver: true,
        }),
        Animated.timing(dot3Opacity, {
          toValue: 0.3,
          duration: duration / 3,
          useNativeDriver: true,
        }),
      ]);

      Animated.loop(animateSequence).start();
    };

    animateDots();
  }, [dot1Opacity, dot2Opacity, dot3Opacity]);

  return (
    <View style={styles.container}>
      <View style={styles.messageContainer}>
        <View style={styles.avatarContainer}>
          {avatar ? (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
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
      
      <Text style={styles.typingText}>{userName} is typing...</Text>
    </View>
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
    marginRight: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  typingText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    marginLeft: 40,
    fontStyle: 'italic',
  },
});

export default TypingIndicator;
