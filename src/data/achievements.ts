/** Minimal profile shape needed for achievement checks. */
interface AchievableProfile {
  unlockedTapeIds: string[];
  achievementIds: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  hint: string; // shown while locked
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ACH-FIRST',
    title: 'Primeiro Contato',
    description: 'Desbloqueou sua primeira fita.',
    icon: '📼',
    hint: 'Escaneie seu primeiro QR code.',
  },
  {
    id: 'ACH-THREE',
    title: 'Colecionador',
    description: 'Acumulou 3 fitas no acervo.',
    icon: '🗂️',
    hint: 'Desbloqueie 3 fitas.',
  },
  {
    id: 'ACH-FIVE',
    title: 'Arquivista',
    description: 'Acumulou 5 fitas — você está obcecado.',
    icon: '🏛️',
    hint: 'Desbloqueie 5 fitas.',
  },
  {
    id: 'ACH-ALL',
    title: 'Biblioteca Completa',
    description: 'Encontrou todas as 9 fitas principais.',
    icon: '👑',
    hint: 'Colete todas as fitas.',
  },
  {
    id: 'ACH-SECRET',
    title: 'Você Não Deveria Estar Aqui',
    description: 'Encontrou a fita secreta.',
    icon: '☠️',
    hint: 'Existe algo que não deveria existir...',
  },
  {
    id: 'ACH-LISTENER',
    title: 'Agente Ativo',
    description: 'Tocou uma fita por mais de 2 minutos.',
    icon: '🎧',
    hint: 'Ouça uma fita por 2 minutos.',
  },
];

/** Returns achievements that are newly earned based on the current profile state. */
export function checkNewAchievements(profile: AchievableProfile): Achievement[] {
  const earned = new Set(profile.achievementIds);
  const newlyEarned: Achievement[] = [];

  const tapesCount = profile.unlockedTapeIds.length;

  if (tapesCount >= 1 && !earned.has('ACH-FIRST')) newlyEarned.push(ALL_ACHIEVEMENTS.find(a => a.id === 'ACH-FIRST')!);
  if (tapesCount >= 3 && !earned.has('ACH-THREE')) newlyEarned.push(ALL_ACHIEVEMENTS.find(a => a.id === 'ACH-THREE')!);
  if (tapesCount >= 5 && !earned.has('ACH-FIVE'))  newlyEarned.push(ALL_ACHIEVEMENTS.find(a => a.id === 'ACH-FIVE')!);
  if (tapesCount >= 9 && !earned.has('ACH-ALL'))   newlyEarned.push(ALL_ACHIEVEMENTS.find(a => a.id === 'ACH-ALL')!);

  if (profile.unlockedTapeIds.includes('TAPE-SECRET') && !earned.has('ACH-SECRET')) {
    newlyEarned.push(ALL_ACHIEVEMENTS.find(a => a.id === 'ACH-SECRET')!);
  }

  return newlyEarned;
}
