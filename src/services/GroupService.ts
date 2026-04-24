import { 
  db 
} from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { Group } from '../types/player';

export class GroupService {
  private static instance: GroupService;
  private constructor() {}

  public static getInstance(): GroupService {
    if (!GroupService.instance) {
      GroupService.instance = new GroupService();
    }
    return GroupService.instance;
  }

  public subscribeToGroups(callback: (groups: Group[]) => void): () => void {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      callback(groups);
    });
  }

  public async createGroup(name: string, playerUids: string[], sessions: string[]): Promise<string> {
    const groupRef = doc(collection(db, 'groups'));
    const now = Timestamp.now();
    
    const newGroup: Group = {
      id: groupRef.id,
      name,
      playerUids,
      sessions,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(groupRef, newGroup);
    return groupRef.id;
  }

  public async updateGroup(groupId: string, data: Partial<Group>): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  public async deleteGroup(groupId: string): Promise<void> {
    await deleteDoc(doc(db, 'groups', groupId));
  }

  public async addSessionDate(groupId: string, date: string): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    // Nota: Em uma refatoração futura, poderíamos usar arrayUnion aqui
    // Por enquanto, assumiremos que o componente enviará o array atualizado via updateGroup
  }
}

export const groupService = GroupService.getInstance();
