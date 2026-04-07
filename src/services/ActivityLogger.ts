/**
 * ActivityLogger — writes structured activity events to Firestore `activityLog`.
 *
 * Event shape:
 *   uid, username, type, category, message, metadata?, timestamp, source
 *
 * Throttle: max 1 navigation event per 2 s per user to control Firestore costs.
 * Errors are always flushed immediately.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ── Types ────────────────────────────────────────────────────────────────────

export type ActivityType = 'navigation' | 'action' | 'system' | 'error' | 'admin' | 'auth' | 'trace';

export interface ActivityEvent {
  uid: string;
  username: string;
  type: ActivityType;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: ReturnType<typeof serverTimestamp>;
  source: 'player' | 'admin';
}

// ── Service ──────────────────────────────────────────────────────────────────

class ActivityLogger {
  private static instance: ActivityLogger;
  private lastNavTimestamp = 0;
  private readonly NAV_THROTTLE_MS = 2000;

  private constructor() {}

  static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  // ── Private write ──────────────────────────────────────────────────────────

  private sanitizeData(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((v) => this.sanitizeData(v));
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        result[k] = this.sanitizeData(v);
      }
    }
    return result;
  }

  private async write(event: Omit<ActivityEvent, 'timestamp'>): Promise<void> {
    try {
      const cleanEvent = this.sanitizeData(event);
      await addDoc(collection(db, 'activityLog'), {
        ...cleanEvent,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      // Silently fail to avoid cascading errors — log locally only
      console.error('[ActivityLogger] write failed:', err);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Screen transitions (throttled: max 1 per 2 s per user). */
  logNavigation(
    uid: string,
    username: string,
    fromScreen: string,
    toScreen: string,
    metadata?: Record<string, unknown>,
  ): void {
    const now = Date.now();
    if (now - this.lastNavTimestamp < this.NAV_THROTTLE_MS) return;
    this.lastNavTimestamp = now;

    this.write({
      uid,
      username,
      type: 'navigation',
      category: 'screen_change',
      message: `${fromScreen} → ${toScreen}`,
      metadata: { fromScreen, toScreen, ...metadata },
      source: 'player',
    });
  }

  /** Player actions (tape play, QR scan, eject, etc). */
  logAction(
    uid: string,
    username: string,
    category: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.write({
      uid,
      username,
      type: 'action',
      category,
      message,
      metadata,
      source: 'player',
    });
  }

  /** System-level events (login, logout, sync). */
  logSystem(
    uid: string,
    username: string,
    category: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.write({
      uid,
      username,
      type: 'system',
      category,
      message,
      metadata,
      source: 'player',
    });
  }

  /** Network errors or connectivity events. */
  logNetwork(
    uid: string,
    username: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.write({
      uid,
      username,
      type: 'error',
      category: 'network',
      message: `[NETWORK] ${message}`,
      metadata,
      source: 'player',
    });
  }

  /** Errors — always immediate, never throttled. */
  logError(
    uid: string,
    username: string,
    message: string,
    errorStack?: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.write({
      uid,
      username,
      type: 'error',
      category: 'error',
      message,
      metadata: { errorStack, ...metadata },
      source: 'player',
    });
  }

  /** Admin-initiated actions. */
  logAdmin(
    adminName: string,
    category: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.write({
      uid: 'admin',
      username: adminName,
      type: 'admin',
      category,
      message,
      metadata,
      source: 'admin',
    });
  }

  /** Auth events (login, logout) */
  logAuth(
    uid: string,
    username: string,
    category: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.write({
      uid,
      username,
      type: 'auth',
      category,
      message,
      metadata,
      source: 'player',
    });
  }

  /** Detailed execution steps (trace level) */
  logTrace(
    adminName: string,
    category: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.write({
      uid: 'admin',
      username: adminName,
      type: 'trace',
      category,
      message,
      metadata,
      source: 'admin',
    });
  }
}

export const activityLogger = ActivityLogger.getInstance();
