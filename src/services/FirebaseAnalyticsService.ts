/**
 * FirebaseAnalyticsService — Behavioral Intelligence Layer
 * 
 * Wraps Firebase Analytics (GA4) to track user behavior across 3 layers:
 *   1. Navigation/Funnel — screen flow, drop-offs, loading times
 *   2. Interaction/Engagement — content consumption, QR scans, achievements
 *   3. UX/Friction — rage taps, errors, slow loads
 * 
 * This feeds Firebase ML (Predictions) to enable churn prediction,
 * engagement scoring, and smart audience segmentation.
 */

import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getFirebaseAnalytics } from '../lib/firebase';
import type { AppScreen } from '../types/player';

// ─── Funnel Definition ───
const ONBOARDING_FUNNEL: AppScreen[] = [
  'login',
  'characterSelection',
  'campaignSelection',
  'player',
];

class FirebaseAnalyticsService {
  private static instance: FirebaseAnalyticsService;
  private analytics: Analytics | null = null;
  private initialized = false;

  // Screen timing state
  private currentScreen: string | null = null;
  private screenEnteredAt: number = 0;

  // Rage-tap detection state
  private tapLog: Map<string, number[]> = new Map();
  private readonly RAGE_TAP_THRESHOLD = 3;
  private readonly RAGE_TAP_WINDOW_MS = 500;

  private constructor() {}

  static getInstance(): FirebaseAnalyticsService {
    if (!FirebaseAnalyticsService.instance) {
      FirebaseAnalyticsService.instance = new FirebaseAnalyticsService();
    }
    return FirebaseAnalyticsService.instance;
  }

  /**
   * Must be called once after Firebase is ready.
   * Safe to call multiple times — only initializes once.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.analytics = await getFirebaseAnalytics();
    this.initialized = true;
  }

  /**
   * Set the current user identity for all subsequent events.
   */
  setUser(uid: string, characterId?: string, codinome?: string): void {
    if (!this.analytics) return;
    setUserId(this.analytics, uid);
    setUserProperties(this.analytics, {
      character_id: characterId || 'none',
      codinome: codinome || 'unknown',
    });
  }

  clearUser(): void {
    if (!this.analytics) return;
    setUserId(this.analytics, '');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LAYER 1: Navigation & Funnel Events
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Track screen view and time-on-previous-screen.
   * Also fires funnel_step if the screen is part of the onboarding funnel.
   */
  logScreenView(screenName: AppScreen, previousScreen?: string): void {
    if (!this.analytics) return;

    // Measure time on previous screen
    if (this.currentScreen && this.screenEnteredAt > 0) {
      const durationSecs = Math.round((Date.now() - this.screenEnteredAt) / 1000);
      if (durationSecs > 0 && durationSecs < 3600) { // Ignore >1h (tab left open)
        this.log('session_duration', {
          screen_name: this.currentScreen,
          duration_secs: durationSecs,
        });
      }
    }

    // Log screen view (standard GA4 event)
    this.log('screen_view', {
      screen_name: screenName,
      screen_class: 'Player',
    });

    // Check if this is a funnel step
    const funnelIndex = ONBOARDING_FUNNEL.indexOf(screenName);
    if (funnelIndex >= 0) {
      this.log('funnel_step', {
        funnel_id: 'onboarding',
        step_name: screenName,
        step_index: funnelIndex,
      });
    }

    // Track back-navigation
    if (previousScreen) {
      this.log('back_navigation', {
        from_screen: previousScreen,
        to_screen: screenName,
      });
    }

    // Update current screen state
    this.currentScreen = screenName;
    this.screenEnteredAt = Date.now();
  }

  /**
   * Track loading time for lazy-loaded screens or data fetches.
   */
  logLoadingTime(screenName: string, durationMs: number): void {
    this.log('loading_time', {
      screen_name: screenName,
      duration_ms: durationMs,
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LAYER 2: Interaction & Engagement Events
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  logTapePlay(intelId: string, intelType: string, campaignId?: string): void {
    this.log('tape_play', {
      intel_id: intelId,
      intel_type: intelType,
      campaign_id: campaignId || 'none',
    });
  }

  logTapeCompleted(intelId: string, listenDurationSecs: number): void {
    this.log('tape_completed', {
      intel_id: intelId,
      listen_duration_secs: listenDurationSecs,
    });
  }

  logTapeAbandoned(intelId: string, listenedSecs: number, totalSecs: number): void {
    this.log('tape_abandoned', {
      intel_id: intelId,
      listened_secs: listenedSecs,
      total_secs: totalSecs,
      completion_pct: totalSecs > 0 ? Math.round((listenedSecs / totalSecs) * 100) : 0,
    });
  }

  logQrScan(result: 'success' | 'fail' | 'duplicate'): void {
    this.log('qr_scan', { result });
  }

  logEvidenceViewed(intelId: string, intelType: string, viewDurationSecs?: number): void {
    this.log('evidence_viewed', {
      intel_id: intelId,
      intel_type: intelType,
      view_duration_secs: viewDurationSecs ?? 0,
    });
  }

  logAchievementUnlocked(achievementId: string, sessionNumber?: number): void {
    // GA4 built-in event name
    this.log('unlock_achievement', {
      achievement_id: achievementId,
      session_number: sessionNumber ?? 0,
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LAYER 3: UX / Friction Events
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Track a UI interaction and detect rage-taps.
   * Call this from onClick handlers on key interactive elements.
   */
  logInteraction(element: string, action: 'tap' | 'swipe' | 'long_press' = 'tap'): void {
    this.log('ui_interaction', { element, action });

    // Rage-tap detection
    if (action === 'tap') {
      const now = Date.now();
      const taps = this.tapLog.get(element) || [];
      taps.push(now);

      // Keep only taps within the detection window
      const recentTaps = taps.filter(t => now - t < this.RAGE_TAP_WINDOW_MS);
      this.tapLog.set(element, recentTaps);

      if (recentTaps.length >= this.RAGE_TAP_THRESHOLD) {
        this.log('rage_tap', {
          element,
          tap_count: recentTaps.length,
          interval_ms: now - recentTaps[0],
        });
        // Reset after detecting to avoid repeated events
        this.tapLog.set(element, []);
      }
    }
  }

  logError(errorType: string, screenName: string, message: string): void {
    this.log('error_encountered', {
      error_type: errorType,
      screen_name: screenName,
      message: message.slice(0, 100), // GA4 param limit
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Internal helper
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private log(eventName: string, params: Record<string, string | number>): void {
    if (!this.analytics) return;
    try {
      logEvent(this.analytics, eventName, params);
    } catch {
      // Silently fail — analytics should never break the app
    }
  }
}

export const firebaseAnalytics = FirebaseAnalyticsService.getInstance();
