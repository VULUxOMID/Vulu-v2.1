/**
 * Hook for backup and export functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { backupService, BackupOptions, RestoreOptions } from '../services/backupService';

export interface UseBackupReturn {
  // Backup operations
  createBackup: (userId: string, options?: BackupOptions) => Promise<string>;
  importBackup: (options?: RestoreOptions) => Promise<void>;
  shareBackup: (filePath: string) => Promise<void>;
  deleteBackup: (filePath: string) => Promise<void>;
  
  // Backup management
  getStoredBackups: () => Promise<any[]>;
  cleanupOldBackups: (maxAge?: number) => Promise<void>;
  getBackupSize: (filePath: string) => Promise<number>;
  
  // State
  isCreatingBackup: boolean;
  isImportingBackup: boolean;
  backupProgress: number;
  storedBackups: any[];
  error: string | null;
}

export const useBackup = (): UseBackupReturn => {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [storedBackups, setStoredBackups] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load stored backups on mount
   */
  useEffect(() => {
    loadStoredBackups();
  }, []);

  /**
   * Load stored backups
   */
  const loadStoredBackups = useCallback(async () => {
    try {
      const backups = await backupService.getStoredBackups();
      setStoredBackups(backups);
    } catch (err: any) {
      console.error('Error loading stored backups:', err);
      setError(err.message || 'Failed to load backups');
    }
  }, []);

  /**
   * Create backup
   */
  const createBackup = useCallback(async (
    userId: string,
    options?: BackupOptions
  ): Promise<string> => {
    try {
      setIsCreatingBackup(true);
      setBackupProgress(0);
      setError(null);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const filePath = await backupService.createBackup(userId, options);
      
      clearInterval(progressInterval);
      setBackupProgress(100);
      
      // Reload stored backups
      await loadStoredBackups();
      
      return filePath;
    } catch (err: any) {
      console.error('Error creating backup:', err);
      setError(err.message || 'Failed to create backup');
      throw err;
    } finally {
      setIsCreatingBackup(false);
      setBackupProgress(0);
    }
  }, [loadStoredBackups]);

  /**
   * Import backup
   */
  const importBackup = useCallback(async (options?: RestoreOptions): Promise<void> => {
    try {
      setIsImportingBackup(true);
      setError(null);

      await backupService.importBackup(options);
      
      // Reload stored backups
      await loadStoredBackups();
    } catch (err: any) {
      console.error('Error importing backup:', err);
      setError(err.message || 'Failed to import backup');
      throw err;
    } finally {
      setIsImportingBackup(false);
    }
  }, [loadStoredBackups]);

  /**
   * Share backup
   */
  const shareBackup = useCallback(async (filePath: string): Promise<void> => {
    try {
      setError(null);
      await backupService.shareBackup(filePath);
    } catch (err: any) {
      console.error('Error sharing backup:', err);
      setError(err.message || 'Failed to share backup');
      throw err;
    }
  }, []);

  /**
   * Delete backup
   */
  const deleteBackup = useCallback(async (filePath: string): Promise<void> => {
    try {
      setError(null);
      await backupService.deleteBackup(filePath);
      
      // Reload stored backups
      await loadStoredBackups();
    } catch (err: any) {
      console.error('Error deleting backup:', err);
      setError(err.message || 'Failed to delete backup');
      throw err;
    }
  }, [loadStoredBackups]);

  /**
   * Get stored backups
   */
  const getStoredBackups = useCallback(async (): Promise<any[]> => {
    try {
      setError(null);
      const backups = await backupService.getStoredBackups();
      setStoredBackups(backups);
      return backups;
    } catch (err: any) {
      console.error('Error getting stored backups:', err);
      setError(err.message || 'Failed to get backups');
      return [];
    }
  }, []);

  /**
   * Cleanup old backups
   */
  const cleanupOldBackups = useCallback(async (maxAge?: number): Promise<void> => {
    try {
      setError(null);
      await backupService.cleanupOldBackups(maxAge);
      
      // Reload stored backups
      await loadStoredBackups();
    } catch (err: any) {
      console.error('Error cleaning up backups:', err);
      setError(err.message || 'Failed to cleanup backups');
      throw err;
    }
  }, [loadStoredBackups]);

  /**
   * Get backup size
   */
  const getBackupSize = useCallback(async (filePath: string): Promise<number> => {
    try {
      setError(null);
      return await backupService.getBackupSize(filePath);
    } catch (err: any) {
      console.error('Error getting backup size:', err);
      setError(err.message || 'Failed to get backup size');
      return 0;
    }
  }, []);

  return {
    createBackup,
    importBackup,
    shareBackup,
    deleteBackup,
    getStoredBackups,
    cleanupOldBackups,
    getBackupSize,
    isCreatingBackup,
    isImportingBackup,
    backupProgress,
    storedBackups,
    error,
  };
};

/**
 * Hook for backup options management
 */
export const useBackupOptions = () => {
  const [options, setOptions] = useState<BackupOptions>({
    includeMedia: false,
    includeDeleted: false,
    format: 'json',
    compression: true,
  });

  const updateOptions = useCallback((newOptions: Partial<BackupOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  const resetOptions = useCallback(() => {
    setOptions({
      includeMedia: false,
      includeDeleted: false,
      format: 'json',
      compression: true,
    });
  }, []);

  return {
    options,
    updateOptions,
    resetOptions,
  };
};

/**
 * Hook for restore options management
 */
export const useRestoreOptions = () => {
  const [options, setOptions] = useState<RestoreOptions>({
    overwriteExisting: false,
    mergeConversations: true,
    skipDuplicates: true,
  });

  const updateOptions = useCallback((newOptions: Partial<RestoreOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  const resetOptions = useCallback(() => {
    setOptions({
      overwriteExisting: false,
      mergeConversations: true,
      skipDuplicates: true,
    });
  }, []);

  return {
    options,
    updateOptions,
    resetOptions,
  };
};
