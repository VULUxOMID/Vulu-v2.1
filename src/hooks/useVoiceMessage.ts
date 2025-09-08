/**
 * Hook for voice message functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  voiceMessageService, 
  VoiceMessage, 
  RecordingState, 
  PlaybackState, 
  VoiceSettings 
} from '../services/voiceMessageService';

export interface UseVoiceMessageReturn {
  // Recording
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceMessage | null>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  
  // Playback
  playbackState: PlaybackState;
  playVoiceMessage: (voiceMessage: VoiceMessage) => Promise<void>;
  stopPlayback: () => Promise<void>;
  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
  seekTo: (positionMillis: number) => Promise<void>;
  
  // Settings
  settings: VoiceSettings;
  updateSettings: (newSettings: Partial<VoiceSettings>) => Promise<void>;
  
  // Permissions
  requestPermissions: () => Promise<boolean>;
  
  // State
  isLoading: boolean;
  error: string | null;
}

export const useVoiceMessage = (): UseVoiceMessageReturn => {
  const [recordingState, setRecordingState] = useState<RecordingState>(
    voiceMessageService.getRecordingState()
  );
  const [playbackState, setPlaybackState] = useState<PlaybackState>(
    voiceMessageService.getPlaybackState()
  );
  const [settings, setSettings] = useState<VoiceSettings>(
    voiceMessageService.getSettings()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update states from service
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingState(voiceMessageService.getRecordingState());
      setPlaybackState(voiceMessageService.getPlaybackState());
      setSettings(voiceMessageService.getSettings());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  /**
   * Start recording
   */
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await voiceMessageService.startRecording();
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Failed to start recording');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async (): Promise<VoiceMessage | null> => {
    try {
      setIsLoading(true);
      setError(null);
      return await voiceMessageService.stopRecording();
    } catch (err: any) {
      console.error('Error stopping recording:', err);
      setError(err.message || 'Failed to stop recording');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await voiceMessageService.pauseRecording();
    } catch (err: any) {
      console.error('Error pausing recording:', err);
      setError(err.message || 'Failed to pause recording');
      throw err;
    }
  }, []);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await voiceMessageService.resumeRecording();
    } catch (err: any) {
      console.error('Error resuming recording:', err);
      setError(err.message || 'Failed to resume recording');
      throw err;
    }
  }, []);

  /**
   * Play voice message
   */
  const playVoiceMessage = useCallback(async (voiceMessage: VoiceMessage): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await voiceMessageService.playVoiceMessage(voiceMessage);
    } catch (err: any) {
      console.error('Error playing voice message:', err);
      setError(err.message || 'Failed to play voice message');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Stop playback
   */
  const stopPlayback = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await voiceMessageService.stopPlayback();
    } catch (err: any) {
      console.error('Error stopping playback:', err);
      setError(err.message || 'Failed to stop playback');
    }
  }, []);

  /**
   * Pause playback
   */
  const pausePlayback = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await voiceMessageService.pausePlayback();
    } catch (err: any) {
      console.error('Error pausing playback:', err);
      setError(err.message || 'Failed to pause playback');
    }
  }, []);

  /**
   * Resume playback
   */
  const resumePlayback = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await voiceMessageService.resumePlayback();
    } catch (err: any) {
      console.error('Error resuming playback:', err);
      setError(err.message || 'Failed to resume playback');
    }
  }, []);

  /**
   * Seek to position
   */
  const seekTo = useCallback(async (positionMillis: number): Promise<void> => {
    try {
      setError(null);
      await voiceMessageService.seekTo(positionMillis);
    } catch (err: any) {
      console.error('Error seeking playback:', err);
      setError(err.message || 'Failed to seek playback');
    }
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback(async (newSettings: Partial<VoiceSettings>): Promise<void> => {
    try {
      setError(null);
      await voiceMessageService.updateSettings(newSettings);
    } catch (err: any) {
      console.error('Error updating settings:', err);
      setError(err.message || 'Failed to update settings');
      throw err;
    }
  }, []);

  /**
   * Request permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      return await voiceMessageService.requestPermissions();
    } catch (err: any) {
      console.error('Error requesting permissions:', err);
      setError(err.message || 'Failed to request permissions');
      return false;
    }
  }, []);

  return {
    recordingState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    playbackState,
    playVoiceMessage,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    seekTo,
    settings,
    updateSettings,
    requestPermissions,
    isLoading,
    error,
  };
};

/**
 * Hook for voice message recording UI
 */
export const useVoiceRecording = () => {
  const {
    recordingState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    requestPermissions,
    isLoading,
    error,
  } = useVoiceMessage();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  /**
   * Initialize permissions
   */
  useEffect(() => {
    const checkPermissions = async () => {
      const granted = await requestPermissions();
      setHasPermission(granted);
    };
    checkPermissions();
  }, [requestPermissions]);

  /**
   * Format duration for display
   */
  const formatDuration = useCallback((milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Get recording progress (0-1)
   */
  const getRecordingProgress = useCallback((maxDuration: number): number => {
    return Math.min(recordingState.duration / (maxDuration * 1000), 1);
  }, [recordingState.duration]);

  return {
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
  };
};

/**
 * Hook for voice message playback UI
 */
export const useVoicePlayback = () => {
  const {
    playbackState,
    playVoiceMessage,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    seekTo,
    isLoading,
    error,
  } = useVoiceMessage();

  /**
   * Format duration for display
   */
  const formatDuration = useCallback((milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Get playback progress (0-1)
   */
  const getPlaybackProgress = useCallback((): number => {
    if (playbackState.duration === 0) return 0;
    return playbackState.currentPosition / playbackState.duration;
  }, [playbackState.currentPosition, playbackState.duration]);

  /**
   * Toggle playback
   */
  const togglePlayback = useCallback(async (voiceMessage?: VoiceMessage): Promise<void> => {
    if (playbackState.isPlaying) {
      await pausePlayback();
    } else if (voiceMessage) {
      await playVoiceMessage(voiceMessage);
    } else {
      await resumePlayback();
    }
  }, [playbackState.isPlaying, playVoiceMessage, pausePlayback, resumePlayback]);

  return {
    playbackState,
    playVoiceMessage,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    seekTo,
    togglePlayback,
    isLoading,
    error,
    formatDuration,
    getPlaybackProgress,
  };
};
