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
            const height = Math.max(3, (amplitude / 100) * 24); // Reduced max height

            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: isPlayed
                      ? isCurrentUser
                        ? '#8E8E93' // Darker tone for played bars
                        : '#6D6D70' // Darker tone for played bars
                      : isCurrentUser
                        ? 'rgba(142, 142, 147, 0.3)' // Darker tone for unplayed bars
                        : 'rgba(109, 109, 112, 0.3)', // Darker tone for unplayed bars
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
                backgroundColor: isCurrentUser ? '#8E8E93' : '#6D6D70', // Darker tones
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
              size={18} // Reduced from 20
              color={isCurrentUser ? '#E5E5E7' : '#E5E5E7'} // Lighter color for better contrast
            />
          ) : (
            <MaterialIcons
              name={isCurrentlyPlaying ? 'pause' : 'play-arrow'}
              size={18} // Reduced from 20
              color={isCurrentUser ? '#E5E5E7' : '#E5E5E7'} // Lighter color for better contrast
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
                { color: isCurrentUser ? '#E5E5E7' : '#8E8E93' }, // Lighter color for better contrast
              ]}
            >
              {getCurrentTimeDisplay()}
            </Text>

            {voiceMessage.size && (
              <Text
                style={[
                  styles.sizeText,
                  { color: isCurrentUser ? 'rgba(229, 229, 231, 0.7)' : '#8E8E93' }, // Lighter color
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
            size={14} // Reduced from 16
            color={isCurrentUser ? 'rgba(229, 229, 231, 0.7)' : '#8E8E93'} // Lighter color
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
    maxWidth: 240, // Reduced from 280
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10, // Reduced from 12
    borderRadius: 16, // Reduced from 18
    gap: 10, // Reduced from 12
  },
  currentUserMessage: {
    backgroundColor: '#2C2C2E', // Darker tone instead of #007AFF
  },
  otherUserMessage: {
    backgroundColor: '#1C1C1E', // Darker tone instead of #F2F2F7
  },
  playButton: {
    width: 32, // Reduced from 36
    height: 32, // Reduced from 36
    borderRadius: 16, // Reduced from 18
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentUserButton: {
    backgroundColor: '#48484A', // Darker tone instead of white
  },
  otherUserButton: {
    backgroundColor: '#3A3A3C', // Darker tone instead of #007AFF
  },
  contentContainer: {
    flex: 1,
    gap: 6, // Reduced from 8
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24, // Reduced from 30
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
    fontSize: 11, // Reduced from 12
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  sizeText: {
    fontSize: 9, // Reduced from 10
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
