import type { PlayerStats } from '../types/player';
import type { IntelItem } from '../types/intel';
import {
  Achievement,
  TapeCountRule,
  ListenTimeRule,
  SecretTapeRule,
  LoreRule,
  RapidScanRule,
  MechanicsRule,
  ManualRule,
  achievementManager,
  EvaluationContext
} from '../services/AchievementManager';

const registerAchievements = () => {
  achievementManager.register(new Achievement('ACH-FIRST', 'Primeiro Contato', 'Deu o primeiro passo neste abismo.', '📼', '???', new TapeCountRule(1), 'Encontrar e escanear 1 fita pela primeira vez.'));
  achievementManager.register(new Achievement('ACH-THREE', 'Colecionador', 'Uma pequena amostra do que está por vir.', '🗂️', '???', new TapeCountRule(3), 'Encontrar e escanear um total de 3 fitas diferentes.'));
  achievementManager.register(new Achievement('ACH-FIVE', 'Arquivista', 'A busca pelo conhecimento nunca termina.', '🏛️', '???', new TapeCountRule(4), 'Encontrar e escanear um total de 4 fitas diferentes.'));
  achievementManager.register(new Achievement('ACH-ALL', 'Biblioteca Completa', 'Nada mais escapa da sua percepção.', '👑', '???', new TapeCountRule(5), 'Encontrar e escanear todas as 5 fitas normais da primeira temporada.'));
  achievementManager.register(new Achievement('ACH-LISTENER', 'Agente Ativo', 'Apenas escutando os recados.', '🎧', '???', new ListenTimeRule(120), 'Ouvir a qualquer áudio por pelo menos 2 minutos totais.'));
  achievementManager.register(new Achievement('ACH-TIME-1', 'Ouvinte Assíduo', 'Sons começam a fazer parte do silêncio.', '⏱️', '???', new ListenTimeRule(3600), 'Acumular o tempo total de escuta de 1 hora.'));
  achievementManager.register(new Achievement('ACH-TIME-10', 'Audiófilo', 'Vozes ecos pela cabeça.', '📻', '???', new ListenTimeRule(36000), 'Acumular o tempo total de escuta de 10 horas.'));
  achievementManager.register(new Achievement('ACH-TIME-50', 'Fita Gasta', 'Você já esqueceu como era a vida antes.', '🫠', '???', new ListenTimeRule(180000), 'Acumular o tempo insano de 50 horas de reprodução.'));
  achievementManager.register(new Achievement('ACH-SECRET', 'Você Não Deveria Estar Aqui', 'Algumas coisas devem permanecer ocultas.', '☠️', '???', new SecretTapeRule(), 'Encontrar e escanear qualquer fita marcada como "Secreta" no banco de dados.'));
  achievementManager.register(new Achievement('ACH-LORE-ANALOG', 'Leviatã Analógico', 'A entidade na fita magnetizada.', '🎸', '???', new LoreRule('analog leviathan'), 'Desbloquear uma fita do artista ou capítulo que mencione "Analog Leviathan".'));
  achievementManager.register(new Achievement('ACH-FAST-SCAN', 'Data Miner', 'Rápido demais para o sistema.', '⚡', '???', new RapidScanRule(3), 'Escanear pelo menos 3 fitas muito rápido, em curto período de tempo de uma única vez.'));
  achievementManager.register(new Achievement('ACH-MECH-SCREW', 'Mecânico', 'Curiosidade desmontada.', '🪛', '???', new MechanicsRule('screwClicks', 15), 'Clicar compulsivamente na textura de parafusos do walkman (min 15 cliques).'));
  achievementManager.register(new Achievement('ACH-MECH-MARRETA', 'Eu vou pegar a minha marreeeeeta', 'Como os botões podem ser fidget toys.', '🔨', '???', new MechanicsRule('fidgetClicks', 1000), 'Clicar intensamente em botões, scroll e parafusos até 1000 vezes.'));
  achievementManager.register(new Achievement('ACH-MECH-INDECISIVE', 'Indeciso', 'A ilusão da escolha.', '🤔', '???', new MechanicsRule('ejectWithoutPlay', 10), 'Ejetar a fita seguidamente pelo menos 10 vezes sem dar o play.'));
  achievementManager.register(new Achievement('ACH-VOL-MAX', 'Tímpanos de Aço', 'Gritos abafados pelo ruído.', '🤘', '???', new MechanicsRule('maxVolumeTime', 300), 'Manter o áudio no volume em 100% (máximo) por mais de 5 minutos cumulativos.'));
  achievementManager.register(new Achievement('ACH-VOL-ZERO', 'Silêncio Tático', 'Apenas o silêncio.', '🤫', '???', new MechanicsRule('zeroVolumeTime', 180), 'Manter o áudio com volume no mudo (zero absoluto) tocando por mais de 3 minutos.'));
  achievementManager.register(new Achievement('ACH-VETERAN', 'Veterano da Agência', 'Uma honra concedida apenas pelo Alto Escalão.', '🏅', '???', new ManualRule(), 'Entregue diretamente e manualmente pelo Administrador através do painel.'));
  achievementManager.register(new Achievement('ACH-LIMBO-FOUND', 'Despertar', 'Onde nós realmente estamos?', '👁️', '???', new ManualRule(), 'Burlar os sistemas do Walkman para descobrir o acesso ao BBS secreto (Limbo_01).'));
  achievementManager.register(new Achievement('ACH-LIMBO-READ', 'O Ponto Zero', 'Agora você não pode mais fechar os olhos.', '🌀', '???', new ManualRule(), 'Ler todas as threads secretas no arquivo do BBS até acionar o protocolo de bloqueio militar.'));
  achievementManager.register(new Achievement('ACH-REPAIR-APP', 'Engenheiro de Software', 'Interfaces visuais em um mundo CLI.', '🖥️', '???', new ManualRule(), 'Encontrar e iniciar o aplicativo de reparo de discos no terminal.'));
  achievementManager.register(new Achievement('ACH-REPAIR-FAIL', 'Setor Defeituoso', 'A agulha não consegue ler o caos de primeira.', '🛑', '???', new ManualRule(), 'Inserir o disquete corrompido no computador para diagnóstico.'));
  achievementManager.register(new Achievement('ACH-REPAIR-SUCCESS', 'A Verdade no Zero', 'O conteúdo da fenda foi restaurado.', '💾', '???', new ManualRule(), 'Reparar com sucesso o disquete magnético e descobrir a mensagem oculta.'));
};

registerAchievements();

export interface AchievableProfile {
  unlockedIntelIds: string[];
  achievementIds: string[];
  stats: PlayerStats;
}

export const ALL_ACHIEVEMENTS = achievementManager.getAll();

export function checkNewAchievements(profile: AchievableProfile, unlockedIntel: IntelItem[], rapidScanCount: number = 0) {
  const context: EvaluationContext = {
    profile,
    unlockedIntel,
    rapidScanCount
  };
  return achievementManager.evaluateNewAchievements(context);
}
