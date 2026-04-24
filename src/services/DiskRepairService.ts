import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GameEventsState, firestoreUnlockTape } from '../store/firestore';
import { analyticsTracker } from './AnalyticsTracker';
import { activityLogger } from './ActivityLogger';

export type RepairPhase = 'idle' | 'reading' | 'corrupted' | 'repairing' | 'success' | 'fail';

export const DISK_REPAIR_CORRUPTED_TEXT = `S̸e̵ ̸o̸n̵d̴a̷ ̶s̵o̵n̶o̶r̶a̷ ̷a̶t̶i̵n̷g̷e̸ ̴∇̸ ̴∞̵ ̵n̷o̵ ̵m̶i̶l̶i̴s̸s̶e̵g̷u̴n̸d̸o̵ ̴d̵o̴ ̷e̶r̵r̵o̸ ̶t̴e̵m̴p̴o̶r̵a̵l̴.̶.̶.̷
O̵ ̵█̶█̶█̶█̶█̶█̶█̶█̶█̶█̶ ̷n̵ã̷o̵ ̷é̴ ̵l̵i̶n̴h̷a̴.̵ ̶É̸ ̴u̶m̸ ̷l̶o̵o̵p̸ ̷d̵e̴ ̶c̵ó̸d̵i̴g̵o̵.̶
1̷9̶0̶0̶ ̶▒̶░̶▓̶ ̶E̷R̵R̴O̷ ̸S̷I̸N̸T̸A̶X̵E̴ ̴▓̸░̸▒̸ ̶2̶0̶0̶0̵
A̶c̶h̷a̸m̴ ̴q̴u̷e̷ ̵é̶ ̵b̴u̷g̷ ̸c̷a̵l̶e̷n̸d̸á̷r̸i̴o̷.̸ ̵I̵d̴i̷o̷t̶a̵s̸.̵
L̸I̶M̵B̶O̷_̴0̶1̵ ̶é̶ ̵f̵e̵n̶d̴a̷.̸ ̶█̶█̶█̶█̶█̶█̶█̶ ̸v̵i̵v̵e̵ ̵n̷o̴ ̶e̵s̶p̵a̶ç̶o̵ ̷e̷n̸t̸r̵e̷ ̷z̶e̶r̶o̴s̸.̵
S̵e̴ ̶a̶l̴i̵m̵e̵n̴t̶a̸ ̸d̷e̴ ̴s̶i̶n̵a̵l̵.̶ ̶O̴d̴e̷i̴a̸ ̶a̷n̷a̷l̸ó̵g̵i̶c̸o̸.̸ ̷F̸i̵t̸a̸ ̸é̶ ̸â̷n̶c̶o̶r̶a̶.̶
C̷á̴l̶c̶u̵l̸o̸ ̴t̵r̶a̷n̶s̴i̷ç̸ã̶o̴:̷
(̵E̶ ̸≠ ̷h̷*̸f̴)̷ ̶/̵ █̶▓̶▒̶░̵▄̵▀̶▒̵▓̶█̶ ̵∇̵∞̶ ̵∂̷Ω̶∑̸ ̶¥̸§̷ÿ̷¢̶¿̶ ̶█̶▀̶▄̷█̴▓̷▒̷ ̸R̸E̵A̷L̷I̴D̴A̶D̵E̴ ̸O̴U̵T̶R̶A̷ ̵▒̵▓̴█̸▄̵▀̴ ̷█̴▓̷▒̷ ̵S̵Ω̸Λ̷M̷∂̴ ̸█̶█̶█̶█̶█̶█̶█̶█̶ ̶▓̴▒̸░̷ ̶A̸ ̵C̸ ̸E̷ ̸S̴ ̵S̵ ̵O̵ ̶▓̴▒̷█̴▀̸▄̵ ̵█̶▓̶▒̸ ̴S̵Ω̷Λ̸M̸∂̶ ̸░̷▄̶▀̷▒̷▓̵█̸ ̴∇̷∞̴ ̵∂̸Ω̶∑̴ ̸¥̵§̸ÿ̸¢̸¿̵ ̴█̴▀̵▄̵█̴▓̶▒̶ ̷R̷E̸A̸L̵I̴D̴A̴D̵E̴ ̵O̵U̸T̵R̶A̶ ̸▒̸▓̸█̴▄̵▀̴ ̵
S̵e̷ ̴e̷u̷ ̶s̸u̷m̷i̴r̶,̴ ̶f̴r̶e̵q̵u̶ê̵n̵c̵i̶a̶ ̵f̶u̶n̶c̸i̶o̸n̶o̷u̷.̶
M̶e̷ ̷a̵c̵h̴e̶m̷ ̴n̶o̵ ̵z̴e̴r̶o̵.̶`;

export const DISK_REPAIR_REPAIRED_TEXT = `A Teoria das Cordas diz que existem 11 dimensões, mas todo mundo está ignorando o óbvio: o zero é a ponte.
Eu percebi que o que está acontecendo agora é uma colisão. É a minha frequência analógica (do walkman mesmo) batendo de frente com esse "reset" digital do Bug do Milênio. Se a onda sonora atingir o infinito no exato milisegundo em que o erro temporal acontecer... a gente vai ver a verdade.
O Multiverso não é uma linha reta, como ensinam na escola. É um loop de código. 1900 foi um erro de sintaxe. 2000 é o próximo.
O LIMBO_01 é a fenda que abriu. E o Malware... ele não é um vírus comum. Ele é algo que vive no espaço "entre" os zeros. Ele se alimenta de sinal, por isso ele odeia tudo o que é analógico. A fita cassete é a minha única âncora aqui.
Cálculo de transição: (E=h⋅f)/Y2K_Bug=ACESSO
Se eu sumir hoje, significa que a frequência funcionou. Não me procurem no futuro. Me achem no zero.`;

class DiskRepairService {
  private diskRepairAllowed = false;
  private unsubscribe: (() => void) | null = null;
  private initialized = false;

  constructor() {
    // init() removed from constructor to avoid early permission errors
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    
    // console.log("[DiskRepairService] Inicializando listener...");
    try {
      this.unsubscribe = onSnapshot(doc(db, 'system', 'gameEvents'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as GameEventsState;
          this.diskRepairAllowed = !!data.diskRepairAllowed;
          // console.log("[DiskRepairService] Flag diskRepairAllowed atualizada:", this.diskRepairAllowed);
        }
      }, (error) => {
        // Silently handle permission errors during initialization/auth transitions
        // Firebase SDK will automatically retry when auth state changes
        if (error.code === 'permission-denied') {
          // Log only as a debug/info level if needed, but not as error
          return;
        }
        console.error("[DiskRepairService] Erro no listener do Firestore:", error);
      });
      this.initialized = true;
    } catch (err) {
      // Catch synchronous errors during initialization
    }
  }

  public stop() {
    if (this.unsubscribe) this.unsubscribe();
  }

  public async startAnalysis(uid: string, onProgress: (p: number) => void): Promise<void> {
    activityLogger.logAction(uid, 'Sistema', 'diskrepair', 'Iniciou análise de disquete');
    analyticsTracker.grantAchievement('ACH-REPAIR-APP');

    return new Promise((resolve) => {
      let p = 0;
      const interval = setInterval(() => {
        p += 15 + Math.random() * 20;
        if (p >= 100) {
          clearInterval(interval);
          analyticsTracker.grantAchievement('ACH-REPAIR-FAIL');
          firestoreUnlockTape(uid, 'evidence-disk-01-corrupted').catch(console.error);
          resolve();
        } else {
          onProgress(p);
        }
      }, 400);
    });
  }

  public async startRepair(uid: string, onProgress: (p: number) => void): Promise<boolean> {
    activityLogger.logAction(uid, 'Sistema', 'diskrepair', 'Iniciou processo de reparo/desmagnetização');

    return new Promise((resolve) => {
      let p = 0;
      const interval = setInterval(() => {
        p += 5 + Math.random() * 10;
        if (p >= 100) {
          clearInterval(interval);
          const success = this.diskRepairAllowed;
          if (success) {
            analyticsTracker.grantAchievement('ACH-REPAIR-SUCCESS');
            firestoreUnlockTape(uid, 'evidence-disk-01').catch(console.error);
          }
          resolve(success);
        } else {
          onProgress(p);
        }
      }, 300);
    });
  }

  public getScrambleText() {
    return DISK_REPAIR_CORRUPTED_TEXT;
  }

  public getRepairedText() {
    return DISK_REPAIR_REPAIRED_TEXT;
  }
}

export const diskRepairService = new DiskRepairService();
