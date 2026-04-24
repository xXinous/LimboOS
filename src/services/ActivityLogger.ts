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
  
  // Internal User State
  private currentUid: string | null = null;
  private currentUsername: string | null = null;

  private constructor() {}

  static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  /**
   * Initializes the logger with user context.
   * This allows subsequent log calls to omit uid and username.
   */
  public setUser(uid: string, username: string): void {
    this.currentUid = uid;
    this.currentUsername = username;
  }

  public clearUser(): void {
    this.currentUid = null;
    this.currentUsername = null;
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

  private humanize(message: string, type?: ActivityType): string {
    if (type === 'navigation' && message.includes('→')) {
      const screens: Record<string, string> = {
        'player':     'Walkman MK-III',
        'profile':    'Perfil Usuário',
        'bios':       'Terminal BIOS',
        'limbo':      'Limbo (Firewall)',
        'diskRepair': 'Reparador de Disco',
        'macos':      'System 7.5',
        'windows95':  'Windows 95',
        'login':      'Acesso',
      };
      const [from, to] = message.split('→').map(s => s.trim());
      return `Navegação: ${screens[from] || from} → ${screens[to] || to}`;
    }

    if (message.includes('WebChannelConnection')) return "SINC_DB: Oscilação na conexão em tempo real";
    if (message.includes('Failed to fetch')) return "REDE: Falha ao carregar recurso externo";
    
    const actionMap: Record<string, string> = {
      'Iniciado Play':      '▶️ Reprodução iniciada',
      'Pausado':            '⏸️ Reprodução pausada',
      'Retroceder fita':    '⏪ Retrocedendo fita',
      'Interação tátil (parafuso)': '🛠️ Interação com hardware (Parafuso)',
      'Reprodução finalizada': '⏹️ Fita chegou ao fim',
    };

    for (const [key, val] of Object.entries(actionMap)) {
      if (message.includes(key)) return val;
    }
    return message;
  }

  private async write(event: Omit<ActivityEvent, 'timestamp' | 'uid' | 'username'>): Promise<void> {
    const uid = this.currentUid || 'unknown';
    const username = this.currentUsername || 'System';

    try {
      const humanizedMessage = this.humanize(event.message, event.type);
      const metadata = { ...(event.metadata || {}), original_message: event.message };

      const cleanEvent = this.sanitizeData({ 
        ...event, 
        uid,
        username,
        message: humanizedMessage,
        metadata 
      }) as Record<string, unknown>;

      await addDoc(collection(db, 'activityLog'), {
        ...cleanEvent,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('[ActivityLogger] write failed:', err);
    }
  }

  logNavigation(fromScreen: string, toScreen: string, metadata?: Record<string, unknown>): void {
    const now = Date.now();
    if (now - this.lastNavTimestamp < this.NAV_THROTTLE_MS) return;
    this.lastNavTimestamp = now;
    this.write({
      type: 'navigation',
      category: 'screen_change',
      message: `${fromScreen} → ${toScreen}`,
      metadata: { fromScreen, toScreen, ...metadata },
      source: 'player',
    });
  }

  logAction(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.write({ type: 'action', category, message, metadata, source: 'player' });
  }

  logSystem(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.write({ type: 'system', category, message, metadata, source: 'player' });
  }

  logError(message: string, errorStack?: string, metadata?: Record<string, unknown>): void {
    this.write({ type: 'error', category: 'error', message, metadata: { errorStack, ...metadata }, source: 'player' });
  }

  logAuth(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.write({ type: 'auth', category, message, metadata, source: 'player' });
  }

  logAdmin(adminName: string, category: string, message: string, metadata?: Record<string, unknown>): void {
    // Admin logs are different as they usually happen in the admin panel
    this.setUser('admin', adminName);
    this.write({ type: 'admin', category, message, metadata, source: 'admin' });
  }
}

export const activityLogger = ActivityLogger.getInstance();
