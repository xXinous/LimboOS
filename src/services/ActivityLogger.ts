
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  private sanitizeData(obj: unknown): unknown {
    if (obj === undefined) return undefined;
    if (obj === null) return null;
    if (typeof obj === 'function') return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj
        .map((item) => this.sanitizeData(item))
        .filter((item) => item !== undefined);
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue;
      const cleaned = this.sanitizeData(v);
      if (cleaned !== undefined) {
        result[k] = cleaned;
      }
    }
    return result;
  }
  private async write(event: Omit<ActivityEvent, 'timestamp'>): Promise<void> {
    try {
      const cleanEvent = this.sanitizeData(event) as Record<string, unknown>;
      if (
        cleanEvent.metadata !== undefined &&
        typeof cleanEvent.metadata === 'object' &&
        cleanEvent.metadata !== null &&
        Object.keys(cleanEvent.metadata).length === 0
      ) {
        delete cleanEvent.metadata;
      }
      await addDoc(collection(db, 'activityLog'), {
        ...cleanEvent,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('[ActivityLogger] write failed:', err);
    }
  }
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
