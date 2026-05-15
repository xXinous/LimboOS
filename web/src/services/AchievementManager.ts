import type { PlayerData, PlayerStats } from '../types/player';
import type { IntelItem } from '../types/intel';

export interface EvaluationContext {
  profile: {
    unlockedTapeIds: string[];
    achievementIds: string[];
    stats: PlayerStats;
  };
  unlockedIntel: IntelItem[];
  rapidScanCount: number;
}

export abstract class AchievementRule {
  abstract evaluate(context: EvaluationContext): boolean;
}

export class TapeCountRule extends AchievementRule {
  constructor(private targetCount: number) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return context.profile.unlockedTapeIds.length >= this.targetCount;
  }
}

export class ListenTimeRule extends AchievementRule {
  constructor(private targetSeconds: number) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return context.profile.stats.totalListenTime >= this.targetSeconds;
  }
}

export class SecretTapeRule extends AchievementRule {
  evaluate(context: EvaluationContext): boolean {
    return context.unlockedIntel.some(t => t.metadata?.isSecret);
  }
}

export class LoreRule extends AchievementRule {
  constructor(private keyword: string) { super(); }
  evaluate(context: EvaluationContext): boolean {
    const kw = this.keyword.toLowerCase();
    return context.unlockedIntel.some(t => 
      (t.metadata?.artist || '').toLowerCase().includes(kw) || 
      (t.metadata?.chapter || '').toLowerCase().includes(kw) ||
      t.title.toLowerCase().includes(kw)
    );
  }
}

export class RapidScanRule extends AchievementRule {
  constructor(private targetCount: number) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return context.rapidScanCount >= this.targetCount;
  }
}

export class MechanicsRule extends AchievementRule {
  constructor(
    private statKey: keyof PlayerStats,
    private targetValue: number
  ) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return (context.profile.stats[this.statKey] as number) >= this.targetValue;
  }
}

export class ManualRule extends AchievementRule {
  evaluate(): boolean {
    return false;
  }
}

export class Achievement {
  public id: string;
  public title: string;
  public description: string;
  public icon: string;
  public hint: string;
  public isSecret: boolean;
  public rule: AchievementRule;
  public unlockCondition: string;

  constructor(
    id: string,
    title: string,
    description: string,
    icon: string,
    hint: string, 
    rule: AchievementRule,
    unlockCondition: string = 'Nenhuma condição detalhada fornecida.',
    isSecret: boolean = true
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.icon = icon;
    this.hint = hint;
    this.rule = rule;
    this.unlockCondition = unlockCondition;
    this.isSecret = isSecret;
  }

  canUnlock(context: EvaluationContext): boolean {
    if (context.profile.achievementIds.includes(this.id)) return false;
    return this.rule.evaluate(context);
  }
}

export class AchievementManager {
  private static instance: AchievementManager;
  private achievements: Map<string, Achievement> = new Map();

  private constructor() {}

  public static getInstance(): AchievementManager {
    if (!AchievementManager.instance) {
      AchievementManager.instance = new AchievementManager();
    }
    return AchievementManager.instance;
  }

  public register(ach: Achievement) {
    this.achievements.set(ach.id, ach);
  }

  public getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  public getAll(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  public evaluateNewAchievements(context: EvaluationContext): Achievement[] {
    const newUnlocks: Achievement[] = [];
    for (const ach of this.achievements.values()) {
      if (ach.canUnlock(context)) {
        newUnlocks.push(ach);
      }
    }
    return newUnlocks;
  }
}

export const achievementManager = AchievementManager.getInstance();
