/**
 * Interface for cleanup service operations
 * Used to break circular dependencies between services
 */
export interface ICleanupService {
  startCleanupService(): void;
  stopCleanupService(): void;
  isRunning(): boolean;
}

/**
 * Registry for cleanup service instances
 * Allows services to register themselves without creating circular dependencies
 */
class CleanupServiceRegistry {
  private static instance: CleanupServiceRegistry;
  private cleanupService: ICleanupService | null = null;

  static getInstance(): CleanupServiceRegistry {
    if (!CleanupServiceRegistry.instance) {
      CleanupServiceRegistry.instance = new CleanupServiceRegistry();
    }
    return CleanupServiceRegistry.instance;
  }

  register(service: ICleanupService): void {
    this.cleanupService = service;
  }

  getService(): ICleanupService | null {
    return this.cleanupService;
  }
}

export { CleanupServiceRegistry };
