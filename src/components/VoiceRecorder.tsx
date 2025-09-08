/**
 * Voice Recorder Component
 * Handles voice message recording with waveform visualization
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useVoiceRecording } from '../hooks/useVoiceMessage';
import { VoiceMessage } from '../services/voiceMessageService';

interface VoiceRecorderProps {
  onRecordingComplete: (voiceMessage: VoiceMessage) => void;
  onCancel: () => void;
  maxDuration?: number;
  style?: any;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  maxDuration = 300,
  style,
}) => {
  const {
    recordingState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    hasPermission,
    isLoading,
    error,
    formatDuration,
    getRecordingProgress,
  } = useVoiceRecording();

  const [pulseAnim] = useState(new Animated.Value(1));
  const [waveformAnim] = useState(new Animated.Value(0));

  /**
   * Start pulse animation when recording
   */
  useEffect(() => {
    if (recordingState.isRecording && !recordingState.isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recordingState.isRecording, recordingState.isPaused, pulseAnim]);

  /**
   * Animate waveform
   */
  useEffect(() => {
    if (recordingState.isRecording) {
      Animated.timing(waveformAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(waveformAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [recordingState.isRecording, waveformAnim]);

  /**
   * Handle start recording
   */
  const handleStartRecording = async () => {
    if (hasPermission === false) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to record voice messages.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await startRecording();
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  /**
   * Handle stop recording
   */
  const handleStopRecording = async () => {
    try {
      const voiceMessage = await stopRecording();
      if (voiceMessage) {
        onRecordingComplete(voiceMessage);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  /**
   * Handle pause/resume recording
   */
  const handlePauseResume = async () => {
    try {
      if (recordingState.isPaused) {
        await resumeRecording();
      } else {
        await pauseRecording();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pause/resume recording');
    }
  };

  /**
   * Handle cancel recording
   */
  const handleCancel = async () => {
    if (recordingState.isRecording) {
      try {
        await stopRecording();
      } catch (error) {
        console.warn('Error stopping recording on cancel:', error);
      }
    }
    onCancel();
  };

  /**
   * Render waveform visualization
   */
  const renderWaveform = () => {
    const waveformData = recordingState.waveform.slice(-20); // Show last 20 samples
    
    return (
      <View style={styles.waveformContainer}>
        {Array.from({ length: 20 }, (_, index) => {
          const amplitude = waveformData[index] || 0;
          const height = Math.max(4, (amplitude / 100) * 40);
          
          return (
            <Animated.View
              key={index}
              style={[
                styles.waveformBar,
                {
                  height,
                  opacity: waveformAnim,
                  backgroundColor: recordingState.isPaused ? '#8E8E93' : '#007AFF',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.permissionText}>Checking microphone permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, style]}>
        <MaterialIcons name="mic-off" size={24} color="#FF3B30" />
        <Text style={styles.permissionText}>Microphone permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handleStartRecording}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Recording Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusIndicator}>
          <MaterialIcons
            name={recordingState.isRecording ? 'fiber-manual-record' : 'mic'}
            size={16}
            color={recordingState.isRecording ? '#FF3B30' : '#8E8E93'}
          />
          <Text style={styles.statusText}>
            {recordingState.isRecording
              ? recordingState.isPaused
                ? 'Paused'
                : 'Recording'
              : 'Ready to record'}
          </Text>
        </View>
        
        {recordingState.isRecording && (
          <Text style={styles.durationText}>
            {formatDuration(recordingState.duration)}
          </Text>
        )}
      </View>

      {/* Waveform Visualization */}
      {recordingState.isRecording && renderWaveform()}

      {/* Progress Bar */}
      {recordingState.isRecording && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${getRecordingProgress(maxDuration) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.maxDurationText}>
            Max: {Math.floor(maxDuration / 60)}:{(maxDuration % 60).toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {!recordingState.isRecording ? (
          // Start Recording Button
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={handleStartRecording}
              disabled={isLoading}
            >
              <MaterialIcons name="mic" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          // Recording Controls
          <View style={styles.recordingControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleCancel}
              disabled={isLoading}
            >
              <MaterialIcons name="close" size={24} color="#FF3B30" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={handlePauseResume}
              disabled={isLoading}
            >
              <MaterialIcons
                name={recordingState.isPaused ? 'play-arrow' : 'pause'}
                size={24}
                color="#007AFF"
              />
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={handleStopRecording}
                disabled={isLoading}
              >
                <MaterialIcons name="stop" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={16} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginBottom: 16,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#007AFF',
    borderRadius: 1.5,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  maxDurationText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
  },
  controlsContainer: {
    alignItems: 'center',
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  permissionText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginVertical: 8,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#FF3B30',
  },
});

export default VoiceRecorder;
