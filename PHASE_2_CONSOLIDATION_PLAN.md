# Phase 2: Architecture Consolidation Plan

**Status**: Ready to Implement  
**Estimated Time**: Weeks 3-4  
**Prerequisites**: Phase 0 & Phase 1 Complete ✅

---

## Overview

Phase 2 focuses on consolidating duplicate services, standardizing logging, and cleaning up navigation patterns. This phase reduces technical debt and creates a cleaner architecture foundation.

---

## 🎯 Task 1: Consolidate Performance Services (Week 3, Days 1-2)

### Current State
Three overlapping performance monitoring services exist:
- `src/services/performanceMonitor.ts` (465 lines, 3 imports) ⭐ Most used
- `src/services/performanceMonitoringService.ts` (674 lines, 1 import)
- `src/services/performanceService.ts` (480 lines, 1 import)

### Analysis Required
```bash
# Check what each service provides
grep "export" src/services/performanceMonitor.ts
grep "export" src/services/performanceMonitoringService.ts  
grep "export" src/services/performanceService.ts

# Find all imports
grep -r "performanceMonitor\|performanceMonitoringService\|performanceService" src --include="*.ts" --include="*.tsx"
```

### Consolidation Strategy
1. **Keep**: `performanceMonitor.ts` as canonical (most used)
2. **Merge In**: Unique features from the other two services
3. **Rename**: To `PerformanceService` class with singleton pattern
4. **Update**: All imports to use unified service
5. **Delete**: `performanceMonitoringService.ts` and `performanceService.ts`

### Implementation Steps
```typescript
// New unified src/services/performanceService.ts
class PerformanceService {
  // Minimal API:
  startMonitoring(): void
  stopMonitoring(): void
  recordMetric(name: string, value: number): void
  getMetrics(): PerformanceMetrics
  reset(): void
}

export const performanceService = new PerformanceService();
```

**Files to Update**:
- `src/hooks/usePerformanceMonitor.ts`
- `src/hooks/useAppPerformance.ts`  
- `src/hooks/usePerformanceOptimization.ts`
- Any component using performance monitoring

---

## 🎯 Task 2: Merge Host Control Services (Week 3, Day 3)

### Current State
Two services with overlapping functionality:
- `src/services/hostControlService.ts` (502 lines)
- `src/services/hostControlsService.ts` (378 lines)

### Analysis Required
```bash
# Check differences
diff src/services/hostControlService.ts src/services/hostControlsService.ts

# Find all imports
grep -r "hostControlService\|hostControlsService" src --include="*.ts" --include="*.tsx"
```

### Consolidation Strategy
1. Compare APIs and choose the more complete implementation
2. Merge unique methods from both
3. Keep one service, delete the other
4. Update all imports

**Target**: Single `src/services/hostControlService.ts` with unified API

---

## 🎯 Task 3: Define Analytics Service Contracts (Week 3, Days 4-5)

### Current State
Two analytics services with unclear boundaries:
- `src/services/analyticsService.ts` - Purpose unclear
- `src/services/profileAnalyticsService.ts` - User-specific analytics

### Clarification Needed
```typescript
// analyticsService.ts - App-wide events
class AnalyticsService {
  // Track app-level events
  trackEvent(event: string, properties?: object): void
  trackScreen(screenName: string): void
  trackError(error: Error): void
  setUserId(userId: string): void
}

// profileAnalyticsService.ts - User profile metrics
class ProfileAnalyticsService {
  // User-specific metrics
  recordProfileView(viewerId: string, profileId: string): Promise<void>
  getProfileViews(profileId: string): Promise<ProfileViewer[]>
  getViewerCount(profileId: string): Promise<number>
}
```

### Implementation
1. Document clear service boundaries in each file header
2. Move misplaced methods to correct service
3. Create `ANALYTICS_ARCHITECTURE.md` documenting the pattern
4. Standardize error handling between both services

---

## 🎯 Task 4: Replace Console Logging (Week 4, Days 1-3)

### Current State
- 3,486 `console.log/warn/error` statements across codebase
- No environment-based filtering in production
- New logger created in Phase 0: `src/utils/logger.ts` ✅

### Migration Strategy

**Priority 1 - Services** (Day 1):
```bash
# Target files (highest impact)
src/services/profileSyncService.ts
src/services/presenceService.ts
src/services/messagingService.ts
src/services/streamingService.ts
src/services/firestoreService.ts
```

**Priority 2 - Contexts** (Day 2):
```bash
src/context/AuthContext.tsx
src/context/LiveStreamContext.tsx
src/context/UserProfileContext.tsx
src/contexts/StreamConnectionContext.tsx
```

**Priority 3 - Screens** (Day 3):
```bash
src/screens/HomeScreen.tsx
src/screens/LiveScreen.tsx
src/screens/ChatScreen.tsx
```

### Replacement Pattern
```typescript
// BEFORE
console.log('User logged in:', userId);
console.warn('Deprecated feature used');
console.error('Failed to load:', error);

// AFTER
import { logger } from '../utils/logger';

logger.info('User logged in:', userId);  // DEV only
logger.warn('Deprecated feature used');  // DEV + PROD
logger.error('Failed to load:', error);  // DEV + PROD
```

### Automation Script
```bash
# Create helper script: scripts/migrate-to-logger.sh
#!/bin/bash
for file in src/services/*.ts; do
  # Add import if not present
  if ! grep -q "from.*logger" "$file"; then
    sed -i '' "1i\\
import { logger } from '../utils/logger';\\
" "$file"
  fi
  
  # Replace console calls
  sed -i '' 's/console\.log(/logger.debug(/g' "$file"
  sed -i '' 's/console\.warn(/logger.warn(/g' "$file"  
  sed -i '' 's/console\.error(/logger.error(/g' "$file"
done
```

### Expected Impact
- **Production logs reduced by 80%** (only warn+error)
- **Better debugging** with timestamps in dev
- **Performance improvement** from reduced logging overhead

---

## 🎯 Task 5: Navigation Consolidation (Week 4, Days 4-5)

### Current State
- Mix of `expo-router` and `React Navigation`
- Confusion in `src/navigation/MainNavigator.tsx`
- Some screens use router, others use navigation prop

### Analysis Required
```bash
# Find expo-router usage
grep -r "from 'expo-router'" src --include="*.tsx"

# Find React Navigation usage  
grep -r "from '@react-navigation" src --include="*.tsx"

# Check navigation setup
cat app/_layout.tsx
cat src/navigation/MainNavigator.tsx
```

### Consolidation Strategy

**Option A**: Standardize on expo-router (file-based routing)
- Pros: Modern, simpler config, type-safe
- Cons: Migration effort, learning curve

**Option B**: Standardize on React Navigation
- Pros: More mature, familiar to team
- Cons: More boilerplate, manual type definitions

**Recommendation**: Keep expo-router for app structure, use React Navigation for complex flows (like registration wizard)

### Implementation
1. Audit all navigation calls
2. Create navigation utility: `src/utils/navigation.ts`
3. Standardize screen transitions
4. Update all components to use unified API
5. Remove unused navigation code

```typescript
// src/utils/navigation.ts - Unified API
export const navigation = {
  navigate: (screen: string, params?: object) => {
    // Use expo-router by default
    router.push({ pathname: screen, params });
  },
  goBack: () => {
    router.back();
  },
  // ... other methods
};
```

---

## 📊 Success Metrics

| Metric | Before | Target | Verification |
|--------|--------|--------|--------------|
| Performance services | 3 | 1 | File count |
| Host control services | 2 | 1 | File count |
| Console logs (prod) | ~3,500 | ~700 | Grep count |
| Analytics services | Unclear | Documented | Architecture doc exists |
| Navigation patterns | 2 | 1 | Code audit |

---

## 🧪 Testing Checklist

After each consolidation:

### Performance Service Consolidation
- [ ] All hooks using performance monitoring still work
- [ ] Performance metrics are collected correctly
- [ ] No runtime errors from missing imports
- [ ] Memory monitoring functions as before

### Host Control Service Merge
- [ ] Stream hosts can mute/unmute viewers
- [ ] Stream hosts can kick/ban users
- [ ] Permission checks work correctly
- [ ] No regressions in host features

### Logger Migration
- [ ] Development logs show debug messages
- [ ] Production builds filter to warn+error only
- [ ] Timestamps appear in dev mode
- [ ] No console.* calls remain in migrated files

### Navigation Cleanup
- [ ] All screens reachable via navigation
- [ ] Back button works on all screens
- [ ] Deep links function correctly
- [ ] No navigation crashes

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing code during merge | High | Incremental changes, test after each |
| Logger migration introduces bugs | Medium | Start with low-risk files |
| Navigation changes break flows | High | Keep both patterns temporarily |
| Performance regression from consolidation | Low | Benchmark before/after |

---

## 📝 Implementation Order

**Week 3:**
1. Monday: Consolidate performance services (8h)
2. Tuesday: Test performance consolidation, update docs (4h)
3. Wednesday: Merge host control services (4h)
4. Thursday: Define analytics contracts (4h)
5. Friday: Document analytics architecture (2h)

**Week 4:**
1. Monday: Migrate services to logger (8h)
2. Tuesday: Migrate contexts to logger (6h)
3. Wednesday: Migrate screens to logger (6h)
4. Thursday: Navigation audit and planning (4h)
5. Friday: Begin navigation consolidation (4h)

---

## 🚀 Next Steps

1. **Review this plan** with team
2. **Create feature branch**: `feature/phase-2-consolidation`
3. **Start with performance services** (lowest risk)
4. **Test thoroughly** after each consolidation
5. **Document changes** in `STABILIZATION_PROGRESS.md`

---

**Plan Created**: October 11, 2025  
**Estimated Completion**: End of Week 4  
**Dependencies**: Phase 0 & Phase 1 must be complete and tested

