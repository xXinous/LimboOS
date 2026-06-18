import { 
  db 
} from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  onSnapshot, 
  serverTimestamp, 
  query, 
  orderBy,
  Timestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Group, GroupCharacterSlot } from '../types/player';

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

  public async createGroup(name: string, characterSlots: GroupCharacterSlot[], sessions: string[], campaignId?: string, unlockedCampaigns?: string[]): Promise<string> {
    const groupRef = doc(collection(db, 'groups'));
    const now = Timestamp.now();
    
    // Keep playerUids for backwards compat
    const playerUids = [...new Set(characterSlots.map(s => s.uid))];

    const newGroup: Group = {
      id: groupRef.id,
      name,
      playerUids,
      characterSlots,
      campaignId: campaignId || undefined,
      unlockedCampaigns: unlockedCampaigns || [],
      sessions,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(groupRef, newGroup);
    return groupRef.id;
  }

  public async updateGroup(groupId: string, data: Partial<Group>): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    
    // Keep playerUids in sync with characterSlots
    if (data.characterSlots) {
      data.playerUids = [...new Set(data.characterSlots.map(s => s.uid))];
    }
    
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
    await updateDoc(groupRef, {
      sessions: arrayUnion(date),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Add a character slot to an existing group
   */
  public async addCharacterToGroup(groupId: string, uid: string, characterId: string): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) throw new Error('Group not found');

    const group = snap.data() as Group;
    const slots = group.characterSlots || [];
    
    // Prevent duplicate
    if (slots.some(s => s.characterId === characterId)) return;

    const newSlot: GroupCharacterSlot = {
      uid,
      characterId,
      joinedAt: Timestamp.now(),
    };

    await updateDoc(groupRef, {
      characterSlots: [...slots, newSlot],
      playerUids: arrayUnion(uid),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Remove a character slot from a group
   */
  public async removeCharacterFromGroup(groupId: string, characterId: string): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) throw new Error('Group not found');

    const group = snap.data() as Group;
    const newSlots = (group.characterSlots || []).filter(s => s.characterId !== characterId);
    const newUids = [...new Set(newSlots.map(s => s.uid))];

    await updateDoc(groupRef, {
      characterSlots: newSlots,
      playerUids: newUids,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Get all groups that a specific character belongs to.
   */
  public async getGroupsForCharacter(characterId: string): Promise<Group[]> {
    const q = query(collection(db, 'groups'));
    const snap = await getDocs(q);
    return snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Group))
      .filter(g => g.characterSlots?.some(slot => slot.characterId === characterId));
  }

  /**
   * Subscribe to all groups that a specific character belongs to.
   */
  public subscribeToGroupsForCharacter(characterId: string, callback: (groups: Group[]) => void): () => void {
    const q = query(collection(db, 'groups'));
    return onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Group))
        .filter(g => g.characterSlots?.some(slot => slot.characterId === characterId));
      callback(groups);
    }, (error) => {
      console.warn('[GroupService] subscribeToGroupsForCharacter error:', error);
      callback([]); // Prevent indefinite loading
    });
  }

  /**
   * Grant intel to all (or only alive) characters in a group.
   * Returns the count of characters that received the intel.
   */
  public async grantIntelToGroup(groupId: string, intelId: string, aliveOnly: boolean = true): Promise<number> {
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    if (!groupSnap.exists()) throw new Error('Group not found');

    const group = groupSnap.data() as Group;
    const slots = group.characterSlots || [];
    let grantCount = 0;

    for (const slot of slots) {
      // Check character status if aliveOnly
      if (aliveOnly) {
        const charSnap = await getDoc(doc(db, 'users', slot.uid, 'characters', slot.characterId));
        if (!charSnap.exists()) continue;
        const charData = charSnap.data();
        if (charData.agentStatus !== 'vivo') continue;
      }

      await setDoc(doc(db, 'users', slot.uid, 'characters', slot.characterId, 'intel', intelId), {
        intelId,
        unlockedAt: serverTimestamp(),
        campaignId: group.campaignId || null
      }, { merge: true });
      grantCount++;
    }

    return grantCount;
  }

  /**
   * Subscribe to messages in a specific group.
   */
  public subscribeToGroupMessages(groupId: string, callback: (messages: any[]) => void): () => void {
    const q = query(
      collection(db, 'groups', groupId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(messages);
    }, (error) => {
      console.warn('[GroupService] subscribeToGroupMessages error:', error);
      callback([]);
    });
  }

  /**
   * Send a message to a specific group.
   */
  public async sendGroupMessage(
    groupId: string,
    senderId: string,
    senderName: string,
    senderNumber: string,
    text: string,
    recipientId?: string,
    recipientName?: string,
    recipientNumber?: string
  ): Promise<void> {
    const messageRef = doc(collection(db, 'groups', groupId, 'messages'));
    const data: any = {
      id: messageRef.id,
      senderId,
      senderName,
      senderNumber,
      text,
      createdAt: serverTimestamp()
    };
    if (recipientId) data.recipientId = recipientId;
    if (recipientName) data.recipientName = recipientName;
    if (recipientNumber) data.recipientNumber = recipientNumber;
    
    await setDoc(messageRef, data);
  }

  /**
   * Send a parsed NPC dialogue to a specific character.
   */
  public async sendNpcDialogueToCharacter(
    groupId: string,
    characterId: string,
    characterCodename: string,
    characterPhoneNumber: string,
    dialogue: {
      npcId: string;
      npcName: string;
      npcNumber: string;
      messages: { speaker: 'npc' | 'player'; text: string }[];
    }
  ): Promise<void> {
    const baseTime = Date.now();
    for (let i = 0; i < dialogue.messages.length; i++) {
      const msg = dialogue.messages[i];
      const messageRef = doc(collection(db, 'groups', groupId, 'messages'));
      
      const isPlayer = msg.speaker === 'player';
      
      await setDoc(messageRef, {
        id: messageRef.id,
        senderId: isPlayer ? characterId : dialogue.npcId,
        senderName: isPlayer ? characterCodename : dialogue.npcName,
        senderNumber: isPlayer ? characterPhoneNumber : dialogue.npcNumber,
        text: msg.text,
        recipientId: isPlayer ? dialogue.npcId : characterId,
        recipientName: isPlayer ? dialogue.npcName : characterCodename,
        recipientNumber: isPlayer ? dialogue.npcNumber : characterPhoneNumber,
        createdAt: Timestamp.fromMillis(baseTime + i * 2000)
      });
    }
  }
}

export const groupService = GroupService.getInstance();

