/**
 * Voice Message Player Component
 * Handles voice message playback with waveform visualization and controls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { useVoicePlayback } from '../hooks/useVoiceMessage';
import { VoiceMessage } from '../services/voiceMessageService';

interface VoiceMessagePlayerProps {
  voiceMessage: VoiceMessage;
  isCurrentUser?: boolean;
  style?: any;
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  voiceMessage,
  isCurrentUser = false,
  style,
}) => {
  const {
    playbackState,
    togglePlayback,
    seekTo,
    formatDuration,
    getPlaybackProgress,
    isLoading,
    error,
  } = useVoicePlayback();

  const [waveformWidth, setWaveformWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

  const isCurrentlyPlaying = playbackState.isPlaying && 
    playbackState.messageId === voiceMessage.id;

  /**
   * Handle play/pause toggle
   */
  const handleTogglePlayback = async () => {
    try {
      await togglePlayback(voiceMessage);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  /**
   * Handle waveform tap/drag for seeking
   */
  const handleWaveformGesture = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      setIsDragging(true);
    } else if (event.nativeEvent.state === State.ACTIVE) {
      const x = Math.max(0, Math.min(event.nativeEvent.x, waveformWidth));
      setDragPosition(x);
    } else if (event.nativeEvent.state === State.END) {
      const progress = dragPosition / waveformWidth;
      const seekPosition = progress * voiceMessage.duration;
      seekTo(seekPosition);
      setIsDragging(false);
    }
  };

  /**
   * Render waveform with progress
   */
  const renderWaveform = () => {
    const waveformData = voiceMessage.waveform || [];
    const progress = isDragging 
      ? dragPosition / waveformWidth 
      : getPlaybackProgress();

    return (
      <PanGestureHandler onHandlerStateChange={handleWaveformGesture}>
        <View
          style={styles.waveformContainer}
          onLayout={(event) => setWaveformWidth(event.nativeEvent.layout.width)}
        >
          {waveformData.map((amplitude, index) => {
            const barProgress = index / waveformData.length;
            const isPlayed = barProgress <= progress;
            const height = Math.max(4, (amplitude / 100) * 30);

            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: isPlayed
                      ? isCurrentUser
                        ? '#FFFFFF'
                        : '#007AFF'
                      : isCurrentUser
                        ? 'rgba(255, 255, 255, 0.5)'
                        : '#E5E5EA',
                  },
                ]}
              />
            );
          })}
          
          {/* Progress Indicator */}
          <View
            style={[
              styles.progressIndicator,
              {
                left: `${progress * 100}%`,
                backgroundColor: isCurrentUser ? '#FFFFFF' : '#007AFF',
              },
            ]}
          />
        </View>
      </PanGestureHandler>
    );
  };

  /**
   * Get current time display
   */
  const getCurrentTimeDisplay = () => {
    if (isDragging) {
      const progress = dragPosition / waveformWidth;
      return formatDuration(progress * voiceMessage.duration);
    }
    
    if (isCurrentlyPlaying) {
      return formatDuration(playbackState.currentPosition);
    }
    
    return formatDuration(voiceMessage.duration);
  };

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
        ]}
      >
        {/* Play/Pause Button */}
        <TouchableOpacity
          style={[
            styles.playButton,
            isCurrentUser ? styles.currentUserButton : styles.otherUserButton,
          ]}
          onPress={handleTogglePlayback}
          disabled={isLoading}
        >
          {isLoading ? (
            <MaterialIcons
              name="hourglass-empty"
              size={20}
              color={isCurrentUser ? '#007AFF' : '#FFFFFF'}
            />
          ) : (
            <MaterialIcons
              name={isCurrentlyPlaying ? 'pause' : 'play-arrow'}
              size={20}
              color={isCurrentUser ? '#007AFF' : '#FFFFFF'}
            />
          )}
        </TouchableOpacity>

        {/* Waveform and Duration */}
        <View style={styles.contentContainer}>
          {renderWaveform()}
          
          <View style={styles.durationContainer}>
            <Text
              style={[
                styles.durationText,
                { color: isCurrentUser ? '#FFFFFF' : '#8E8E93' },
              ]}
            >
              {getCurrentTimeDisplay()}
            </Text>
            
            {voiceMessage.size && (
              <Text
                style={[
                  styles.sizeText,
                  { color: isCurrentUser ? 'rgba(255, 255, 255, 0.7)' : '#8E8E93' },
                ]}
              >
                {(voiceMessage.size / 1024).toFixed(1)}KB
              </Text>
            )}
          </View>
        </View>

        {/* Voice Message Icon */}
        <View style={styles.iconContainer}>
          <MaterialIcons
            name="keyboard-voice"
            size={16}
            color={isCurrentUser ? 'rgba(255, 255, 255, 0.7)' : '#8E8E93'}
          />
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={12} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 280,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    gap: 12,
  },
  currentUserMessage: {
    backgroundColor: '#007AFF',
  },
  otherUserMessage: {
    backgroundColor: '#F2F2F7',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentUserButton: {
    backgroundColor: '#FFFFFF',
  },
  otherUserButton: {
    backgroundColor: '#007AFF',
  },
  contentContainer: {
    flex: 1,
    gap: 8,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    gap: 1,
    position: 'relative',
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
    flex: 1,
  },
  progressIndicator: {
    position: 'absolute',
    width: 2,
    height: '100%',
    borderRadius: 1,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  sizeText: {
    fontSize: 10,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  errorText: {
    marginLeft: 4,
    fontSize: 10,
    color: '#FF3B30',
  },
});

export default VoiceMessagePlayer;
