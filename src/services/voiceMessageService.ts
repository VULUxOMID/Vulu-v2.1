/**
 * Voice Message Service
 * Handles voice message recording, playback, and audio processing
 */

import { Audio } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Voice message interfaces
export interface VoiceMessage {
  id: string;
  uri: string;
  duration: number;
  waveform: number[];
  size: number;
  timestamp: number;
  isPlaying?: boolean;
  currentPosition?: number;
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  uri?: string;
  waveform: number[];
  isPaused: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentPosition: number;
  duration: number;
  messageId?: string;
}

export interface VoiceSettings {
  quality: 'low' | 'medium' | 'high';
  maxDuration: number; // in seconds
  autoStop: boolean;
  compressionEnabled: boolean;
  noiseReduction: boolean;
}

class VoiceMessageService {
  private static instance: VoiceMessageService;
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private isExpoGo: boolean = false;
  private recordingState: RecordingState = {
    isRecording: false,
    duration: 0,
    waveform: [],
    isPaused: false,
  };
  private playbackState: PlaybackState = {
    isPlaying: false,
    currentPosition: 0,
    duration: 0,
  };
  private settings: VoiceSettings = {
    quality: 'medium',
    maxDuration: 300, // 5 minutes
    autoStop: true,
    compressionEnabled: true,
    noiseReduction: true,
  };
  private recordingTimer: NodeJS.Timeout | null = null;
  private waveformTimer: NodeJS.Timeout | null = null;
  private playbackTimer: NodeJS.Timeout | null = null;
  private stateChangeListeners: Set<() => void> = new Set();

  static getInstance(): VoiceMessageService {
    if (!VoiceMessageService.instance) {
      VoiceMessageService.instance = new VoiceMessageService();
    }
    return VoiceMessageService.instance;
  }

  constructor() {
    // Detect if we're running in Expo Go
    this.isExpoGo = Constants.appOwnership === 'expo' ||
                    (Constants.executionEnvironment === 'storeClient' && __DEV__);
  }

  /**
   * Add state change listener
   */
  addStateChangeListener(listener: () => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Notify state change listeners
   */
  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Initialize voice message service
   */
  async initialize(): Promise<void> {
    try {
      // Load settings
      await this.loadSettings();

      // Check if we're in Expo Go environment
      if (this.isExpoGo) {
        console.log('🎭 Voice message service: Running in Expo Go - audio features limited');
        console.log('✅ Voice message service initialized (mock mode)');
        return;
      }

      // Configure audio mode (only in development builds or production)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      console.log('✅ Voice message service initialized');
    } catch (error) {
      console.error('❌ Voice message service initialization failed:', error);
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
      // Don't throw error - allow app to continue with limited functionality
    }
  }

  /**
   * Request audio permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Check if we're in Expo Go environment
      if (this.isExpoGo) {
        console.log('🎭 Voice message service: Permissions not available in Expo Go');
        return false; // Return false to indicate permissions not available
      }

      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.warn('⚠️ Error requesting audio permissions (likely Expo Go):', error.message);
      return false;
    }
  }

  /**
   * Start recording voice message
   */
  async startRecording(): Promise<void> {
    try {
      // Check if we're in Expo Go environment
      if (this.isExpoGo) {
        console.log('🎭 Voice message service: Recording not available in Expo Go');
        throw new Error('Voice recording not available in development environment');
      }

      // Check permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Audio recording permission not granted');
      }

      // Stop any existing recording or playback
      await this.stopRecording();
      await this.stopPlayback();

      // Configure recording options
      const recordingOptions = this.getRecordingOptions();

      // Create and start recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();

      // Update state
      this.recordingState = {
        isRecording: true,
        duration: 0,
        waveform: [],
        isPaused: false,
      };

      // Start timers
      this.startRecordingTimer();
      this.startWaveformTimer();

      // Notify listeners of state change
      this.notifyStateChange();

      console.log('🎤 Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      // Unload recording resources if they exist
      if (this.recording) {
        try {
          await this.recording.unloadAsync();
        } catch (unloadError) {
          console.warn('Error unloading recording during cleanup:', unloadError);
        }
      }
      // Reset recording state on error
      this.recordingState = {
        isRecording: false,
        duration: 0,
        waveform: [],
        isPaused: false,
      };
      this.recording = null;
      this.clearRecordingTimers();
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Stop recording voice message
   */
  async stopRecording(): Promise<VoiceMessage | null> {
    try {
      if (!this.recording || !this.recordingState.isRecording) {
        return null;
      }

      // Stop recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();

      // Clear timers
      this.clearRecordingTimers();

      if (!uri) {
        throw new Error('Recording URI not available');
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const duration = this.recordingState.duration;
      const waveform = this.recordingState.waveform;

      // Create voice message object
      const voiceMessage: VoiceMessage = {
        id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uri,
        duration,
        waveform,
        size: fileInfo.exists ? fileInfo.size || 0 : 0,
        timestamp: Date.now(),
      };

      // Reset state
      this.recordingState = {
        isRecording: false,
        duration: 0,
        waveform: [],
        isPaused: false,
      };
      this.recording = null;

      // Notify listeners of state change
      this.notifyStateChange();

      console.log('🎤 Recording stopped:', voiceMessage);
      return voiceMessage;
    } catch (error) {
      console.error('Error stopping recording:', error);
      // Try to unload recording resources before clearing state
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch (unloadError) {
          console.warn('Error unloading recording during cleanup:', unloadError);
        }
      }
      // Reset recording state on error
      this.recordingState = {
        isRecording: false,
        duration: 0,
        waveform: [],
        isPaused: false,
      };
      this.recording = null;
      this.clearRecordingTimers();
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Pause recording
   */
  async pauseRecording(): Promise<void> {
    try {
      if (!this.recording || !this.recordingState.isRecording) {
        return;
      }

      await this.recording.pauseAsync();
      this.recordingState.isPaused = true;
      this.clearRecordingTimers();

      // Notify listeners of state change
      this.notifyStateChange();

      console.log('⏸️ Recording paused');
    } catch (error) {
      console.error('Error pausing recording:', error);
      // Unload recording resources if they exist
      if (this.recording) {
        try {
          await this.recording.unloadAsync();
        } catch (unloadError) {
          console.warn('Error unloading recording during cleanup:', unloadError);
        }
      }
      // Reset recording state on error
      this.recordingState = {
        isRecording: false,
        duration: 0,
        waveform: [],
        isPaused: false,
      };
      this.recording = null;
      this.clearRecordingTimers();
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Resume recording
   */
  async resumeRecording(): Promise<void> {
    try {
      if (!this.recording || !this.recordingState.isPaused) {
        return;
      }

      await this.recording.startAsync();
      this.recordingState.isPaused = false;
      this.startRecordingTimer();
      this.startWaveformTimer();

      // Notify listeners of state change
      this.notifyStateChange();

      console.log('▶️ Recording resumed');
    } catch (error) {
      console.error('Error resuming recording:', error);
      // Unload recording resources if they exist
      if (this.recording) {
        try {
          await this.recording.unloadAsync();
        } catch (unloadError) {
          console.warn('Error unloading recording during cleanup:', unloadError);
        }
      }
      // Reset recording state on error
      this.recordingState = {
        isRecording: false,
        duration: 0,
        waveform: [],
        isPaused: false,
      };
      this.recording = null;
      this.clearRecordingTimers();
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Play voice message
   */
  async playVoiceMessage(voiceMessage: VoiceMessage): Promise<void> {
    try {
      // Stop any existing playback
      await this.stopPlayback();

      // Create and load sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: voiceMessage.uri },
        { shouldPlay: true, isLooping: false }
      );

      this.sound = sound;

      // Update state
      this.playbackState = {
        isPlaying: true,
        currentPosition: 0,
        duration: voiceMessage.duration,
        messageId: voiceMessage.id,
      };

      // Notify listeners of state change
      this.notifyStateChange();

      // Set up playback status update
      this.sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          this.playbackState.currentPosition = status.positionMillis || 0;
          this.playbackState.isPlaying = status.isPlaying || false;

          if (status.didJustFinish) {
            this.stopPlayback();
          }
        }
      });

      // Start playback timer
      this.startPlaybackTimer();

      console.log('🔊 Playback started for:', voiceMessage.id);
    } catch (error) {
      console.error('Error playing voice message:', error);
      throw error;
    }
  }

  /**
   * Stop playback
   */
  async stopPlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      if (this.playbackTimer) {
        clearInterval(this.playbackTimer);
        this.playbackTimer = null;
      }

      this.playbackState = {
        isPlaying: false,
        currentPosition: 0,
        duration: 0,
      };

      // Notify listeners of state change
      this.notifyStateChange();

      console.log('⏹️ Playback stopped');
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  }

  /**
   * Pause playback
   */
  async pausePlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.pauseAsync();
        this.playbackState.isPlaying = false;

        // Notify listeners of state change
        this.notifyStateChange();
      }
    } catch (error) {
      console.error('Error pausing playback:', error);
    }
  }

  /**
   * Resume playback
   */
  async resumePlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.playAsync();
        this.playbackState.isPlaying = true;

        // Notify listeners of state change
        this.notifyStateChange();
      }
    } catch (error) {
      console.error('Error resuming playback:', error);
    }
  }

  /**
   * Seek to position in playback
   */
  async seekTo(positionMillis: number): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.setPositionAsync(positionMillis);
        this.playbackState.currentPosition = positionMillis;

        // Notify listeners of state change
        this.notifyStateChange();
      }
    } catch (error) {
      console.error('Error seeking playback:', error);
    }
  }

  /**
   * Get recording options based on quality setting
   */
  private getRecordingOptions(): Audio.RecordingOptions {
    const baseOptions: Audio.RecordingOptions = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };

    // Adjust quality based on settings
    switch (this.settings.quality) {
      case 'low':
        if (baseOptions.android) {
          baseOptions.android.sampleRate = 22050;
          baseOptions.android.bitRate = 64000;
        }
        if (baseOptions.ios) {
          baseOptions.ios.sampleRate = 22050;
          baseOptions.ios.bitRate = 64000;
          baseOptions.ios.audioQuality = Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW;
        }
        break;
      case 'high':
        if (baseOptions.android) {
          baseOptions.android.sampleRate = 48000;
          baseOptions.android.bitRate = 256000;
        }
        if (baseOptions.ios) {
          baseOptions.ios.sampleRate = 48000;
          baseOptions.ios.bitRate = 256000;
          baseOptions.ios.audioQuality = Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX;
        }
        break;
    }

    return baseOptions;
  }

  /**
   * Start recording timer
   */
  private startRecordingTimer(): void {
    this.recordingTimer = setInterval(() => {
      this.recordingState.duration += 100;

      // Auto-stop if max duration reached
      if (this.settings.autoStop && this.recordingState.duration >= this.settings.maxDuration * 1000) {
        this.stopRecording();
      }

      // Notify listeners for smooth UI updates during recording
      this.notifyStateChange();
    }, 100);
  }

  /**
   * Start waveform timer (simplified waveform generation)
   */
  private startWaveformTimer(): void {
    this.waveformTimer = setInterval(() => {
      // Generate mock waveform data (in real implementation, use audio analysis)
      const amplitude = Math.random() * 100;
      this.recordingState.waveform.push(amplitude);

      // Keep only last 100 samples for performance
      if (this.recordingState.waveform.length > 100) {
        this.recordingState.waveform.shift();
      }
    }, 100);
  }

  /**
   * Start playback timer
   */
  private startPlaybackTimer(): void {
    this.playbackTimer = setInterval(() => {
      // Timer is mainly for UI updates, actual position comes from sound status
    }, 100);
  }

  /**
   * Clear recording timers
   */
  private clearRecordingTimers(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.waveformTimer) {
      clearInterval(this.waveformTimer);
      this.waveformTimer = null;
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState(): RecordingState {
    return { ...this.recordingState };
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Update voice settings
   */
  async updateSettings(newSettings: Partial<VoiceSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem('voice_settings', JSON.stringify(this.settings));
      
      // Notify listeners of settings change
      this.notifyStateChange();
      
      console.log('✅ Voice settings updated');
    } catch (error) {
      console.error('Error updating voice settings:', error);
    }
  }

  /**
   * Get current voice settings
   */
  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('voice_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading voice settings:', error);
    }
  }

  /**
   * Cleanup the service
   */
  async cleanup(): Promise<void> {
    try {
      await this.stopRecording();
      await this.stopPlayback();
      this.clearRecordingTimers();

      console.log('✅ Voice message service cleaned up');
    } catch (error) {
      console.error('Error cleaning up voice message service:', error);
    }
  }
}

export const voiceMessageService = VoiceMessageService.getInstance();
