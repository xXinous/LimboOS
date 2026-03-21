import type { Tape } from './tapes';
import type { PlayerStats } from '../store/firestore';

export interface AchievableProfile {
  unlockedTapeIds: string[];
  achievementIds: string[];
  stats: PlayerStats;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  hint: string; // shown while locked
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // Old ones
  { id: 'ACH-FIRST', title: 'Primeiro Contato', description: 'Desbloqueou sua primeira fita.', icon: '📼', hint: 'Escaneie seu primeiro QR code.' },
  { id: 'ACH-THREE', title: 'Colecionador', description: 'Acumulou 3 fitas no acervo.', icon: '🗂️', hint: 'Desbloqueie 3 fitas.' },
  { id: 'ACH-FIVE', title: 'Arquivista', description: 'Acumulou 5 fitas — você está obcecado.', icon: '🏛️', hint: 'Desbloqueie 5 fitas.' },
  { id: 'ACH-ALL', title: 'Biblioteca Completa', description: 'Encontrou todas as 9 fitas originais.', icon: '👑', hint: 'Colete todas as fitas.' },
  { id: 'ACH-SECRET', title: 'Você Não Deveria Estar Aqui', description: 'Encontrou a fita secreta.', icon: '☠️', hint: 'Existe algo que não deveria existir...' },
  { id: 'ACH-LISTENER', title: 'Agente Ativo', description: 'Tocou uma fita por mais de 2 minutos.', icon: '🎧', hint: 'Ouça uma fita por 2 minutos.' },

  // New ones
  { id: 'ACH-TIME-1', title: 'Ouvinte Assíduo', description: 'Ouviu 1 hora de áudio total.', icon: '⏱️', hint: 'Ouça fitas por 1 hora.' },
  { id: 'ACH-TIME-10', title: 'Audiófilo', description: 'Passou 10 horas ouvindo as gravações.', icon: '📻', hint: 'Ouça fitas por 10 horas.' },
  { id: 'ACH-TIME-50', title: 'Fita Gasta', description: 'Atingiu monstruosas 50 horas de reprodução.', icon: '🫠', hint: 'Ouça fitas por 50 horas.' },
  
  { id: 'ACH-LORE-ANALOG', title: 'Leviatã Analógico', description: 'Coletou registros da banda Analog Leviathan.', icon: '🎸', hint: 'Encontre músicas da banda.' },
  { id: 'ACH-FAST-SCAN', title: 'Data Miner', description: 'Baixou 3 fitas rapidamente de uma só vez.', icon: '⚡', hint: 'Escaneie fitas muito rápido.' },
  
  { id: 'ACH-MECH-SCREW', title: 'Mecânico', description: 'Fuçou nos parafusos do aparelho.', icon: '🪛', hint: 'Desmonte o que não deve.' },
  { id: 'ACH-MECH-INDECISIVE', title: 'Indeciso', description: 'Ejetou e inseriu fitas dezenas de vezes sem tocar nada.', icon: '🤔', hint: 'Não decida o que ouvir.' },
  { id: 'ACH-VOL-MAX', title: 'Tímpanos de Aço', description: 'Tocou o rádio no volume máximo.', icon: '🤘', hint: 'Faça barulho.' },
  { id: 'ACH-VOL-ZERO', title: 'Silêncio Tático', description: 'Tocou o rádio no mudo por um logo período.', icon: '🤫', hint: 'Agentes andam em silêncio.' },
];

export function checkNewAchievements(profile: AchievableProfile, unlockedTapes: Tape[], rapidScanCount: number = 0): Achievement[] {
  const earned = new Set(profile.achievementIds);
  const newlyEarned: Achievement[] = [];
  
  const add = (id: string) => {
    if (!earned.has(id)) {
      newlyEarned.push(ALL_ACHIEVEMENTS.find(a => a.id === id)!);
    }
  };

  const tapesCount = profile.unlockedTapeIds.length;
  const stats = profile.stats;

  // Collection
  if (tapesCount >= 1) add('ACH-FIRST');
  if (tapesCount >= 3) add('ACH-THREE');
  if (tapesCount >= 5) add('ACH-FIVE');
  if (tapesCount >= 9) add('ACH-ALL');
  
  // Listen Time (Old 2 mins = 120s)
  if (stats.totalListenTime >= 120) add('ACH-LISTENER');
  if (stats.totalListenTime >= 3600) add('ACH-TIME-1');
  if (stats.totalListenTime >= 36000) add('ACH-TIME-10');
  if (stats.totalListenTime >= 180000) add('ACH-TIME-50');

  // Lore / Tapes
  if (unlockedTapes.some(t => t.isSecret)) {
    add('ACH-SECRET');
  }
  if (unlockedTapes.some(t => t.artist.toLowerCase().includes('analog leviathan') || t.chapter.toLowerCase().includes('analog leviathan'))) {
    add('ACH-LORE-ANALOG');
  }
  if (rapidScanCount >= 3) {
    add('ACH-FAST-SCAN');
  }

  // Mechanics
  if (stats.screwClicks >= 15) add('ACH-MECH-SCREW');
  if (stats.ejectWithoutPlay >= 10) add('ACH-MECH-INDECISIVE');
  if (stats.maxVolumeTime >= 300) add('ACH-VOL-MAX');
  if (stats.zeroVolumeTime >= 180) add('ACH-VOL-ZERO');

  return newlyEarned;
}
