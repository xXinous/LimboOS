import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Campaign } from '../../data/campaigns';
import { Group, CharacterData, MasterAccount } from '../../types/player';
import { intelRegistry } from '../../data/intel_registry';
import { userService } from '../../services/UserService';
import { useModal } from './ConfirmModal';
import RetroSpinner from '../../components/player/RetroSpinner';
import BulkInventoryModal from './BulkInventoryModal';

interface CampaignInventoryModalProps {
  campaign: Campaign;
  groups: Group[];
  allCharacters: { account: MasterAccount; character: CharacterData }[];
  onClose: () => void;
}

export default function CampaignInventoryModal({ campaign, groups, allCharacters, onClose }: CampaignInventoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [characterInventories, setCharacterInventories] = useState<Record<string, { id: string; unlockedAt: any }[]>>({});
  const [showGrantModal, setShowGrantModal] = useState<{ charId: string; uid: string } | null>(null);
  const [grantLoading, setGrantLoading] = useState(false);
  const { showConfirm, modal } = useModal();

  // Determine which characters belong to this campaign
  // 1. Characters in groups assigned to this campaign
  // 2. Characters individually assigned to this campaign (campaignId on CharacterData)
  const campaignCharacters = useMemo(() => {
    return allCharacters.filter(({ character }) => {
      if (character.campaignId === campaign.id) return true;
      return groups.some(g => g.campaignId === campaign.id && g.characterSlots?.some(slot => slot.characterId === character.id));
    });
  }, [allCharacters, groups, campaign.id]);

  const loadInventories = async () => {
    setLoading(true);
    
    try {
      const results = await Promise.all(
        campaignCharacters.map(async (item) => {
          try {
            const intelSnap = await getDocs(collection(db, "users", item.account.uid, "characters", item.character.id, "intel"));
            const items = intelSnap.docs.map(d => ({ 
              id: d.id, 
              unlockedAt: d.data().unlockedAt,
              campaignId: d.data().campaignId
            })).filter(t => !t.campaignId || t.campaignId === campaign.id);
            
            return { key: `${item.account.uid}_${item.character.id}`, items };
          } catch (err) {
            console.error("Error loading inventory for char", item.character.id, err);
            return { key: `${item.account.uid}_${item.character.id}`, items: [] };
          }
        })
      );
      
      const inventories: Record<string, { id: string; unlockedAt: any }[]> = {};
      results.forEach(res => {
        inventories[res.key] = res.items;
      });
      
      setCharacterInventories(inventories);
    } catch (err) {
      console.error("Critical error in bulk loading inventories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventories();
  }, [campaign.id, campaignCharacters]);

  const handleExecuteBulk = async (selectedIds: Set<string>) => {
    if (!showGrantModal) return;
    try {
      const batch = writeBatch(db);
      
      [...selectedIds].forEach(intelId => {
        const docRef = doc(db, "users", showGrantModal.uid, "characters", showGrantModal.charId, "intel", intelId);
        batch.set(docRef, {
          intelId,
          unlockedAt: serverTimestamp(),
          campaignId: campaign.id
        }, { merge: true });
      });
      
      await batch.commit();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleRevokeIntel = async (uid: string, charId: string, intelId: string) => {
    const ok = await showConfirm('Revogar Evidência', 'Remover este item do inventário do personagem para esta campanha?', 'Remover');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "users", uid, "characters", charId, "intel", intelId));
      await loadInventories();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="bg-surface-container-low border border-primary/30 w-full max-w-5xl rounded-sm shadow-2xl flex flex-col h-[85vh] relative overflow-hidden">
        <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
          SUPERVISÃO-DE-INVENTÁRIO
        </div>

        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40 relative z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
            <div>
              <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter">Acervo da <span className="text-primary">{campaign.name}</span></h3>
              <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">Gestão de evidências isolada por campanha</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 text-industrial-silver/20 hover:text-white transition-all material-symbols-outlined rounded-sm">
            close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-black/10 custom-scrollbar relative z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <RetroSpinner />
              <p className="text-[10px] font-display font-bold text-primary uppercase tracking-widest mt-4 animate-pulse">Analisando Datacrons...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {campaignCharacters.length === 0 && (
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-sm opacity-30 flex flex-col items-center">
                  <span className="material-symbols-outlined text-5xl text-industrial-silver/40 mb-4">person_off</span>
                  <p className="text-[11px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Nenhum Agente Vinculado a Esta Missão</p>
                </div>
              )}

              {campaignCharacters.map(({ account, character }) => {
                const compositeKey = `${account.uid}_${character.id}`;
                const items = characterInventories[compositeKey] || [];
                return (
                  <div key={compositeKey} className="bg-black/40 border border-white/5 rounded-sm p-6 group hover:border-primary/20 transition-all shadow-inner">
                    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-sm bg-black border border-[#1a1a1a] flex items-center justify-center font-black text-sm ${character.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'}`}>
                             {(character.codinome || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider">{character.codinome}</h4>
                            <p className="text-[9px] font-mono font-bold text-industrial-silver/40 uppercase tracking-widest mt-0.5">Mestre: {account.masterName || account.email}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <span className="text-[9px] font-display font-bold text-primary/40 uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-sm border border-primary/10">
                            {items.length} Itens
                          </span>
                          <button 
                            onClick={() => setShowGrantModal({ charId: character.id, uid: account.uid })}
                            className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-sm font-display font-bold text-[9px] tracking-widest uppercase hover:bg-primary hover:text-black transition-all active:scale-95 glow-orange flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">add</span> Conceder
                          </button>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                       {items.map(t => {
                         const intel = intelRegistry.get(t.id);
                         return (
                           <div key={t.id} className="bg-surface-container-lowest border border-white/5 p-4 rounded-sm relative group/item hover:border-primary/30 transition-all shadow-md">
                              <div className="flex items-start justify-between mb-2">
                                <div className={`p-1.5 rounded-sm bg-black/40 border border-white/5 text-[10px] transition-all group-hover/item:border-primary/20 ${
                                  intel?.type === 'AUDIO' ? 'text-amber-500' :
                                  intel?.type === 'VISUAL' ? 'text-cyan-500' :
                                  intel?.type === 'TEXT' ? 'text-emerald-500' : 'text-primary'
                                }`}>
                                   <span className="material-symbols-outlined text-sm">
                                     {intel?.type === 'AUDIO' ? 'album' : 
                                      intel?.type === 'VISUAL' ? 'photo_library' : 
                                      intel?.type === 'TEXT' ? 'description' : 'shield'}
                                   </span>
                                </div>
                                <button 
                                  onClick={() => handleRevokeIntel(account.uid, character.id, t.id)}
                                  className="text-industrial-silver/20 hover:text-red-500 transition-colors bg-black/40 p-1 rounded-sm border border-white/5 hover:border-red-500/30"
                                >
                                  <span className="material-symbols-outlined text-xs">close</span>
                                </button>
                              </div>
                              <p className="font-display font-bold text-[10px] text-white uppercase tracking-widest truncate group-hover/item:text-primary transition-colors">{intel?.title || t.id}</p>
                              <p className="text-[8px] font-mono text-industrial-silver/40 uppercase mt-1 truncate">{intel?.metadata?.npc || 'SISTEMA'}</p>
                           </div>
                         );
                       })}
                       {items.length === 0 && (
                         <div className="col-span-full py-6 text-center border border-dashed border-white/5 rounded-sm opacity-20">
                            <span className="text-[9px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">Inventário Vazio</span>
                         </div>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showGrantModal && (() => {
        const char = allCharacters.find(c => c.character.id === showGrantModal.charId && c.account.uid === showGrantModal.uid)?.character;
        if (!char) return null;
        const compositeKey = `${showGrantModal.uid}_${showGrantModal.charId}`;
        return (
          <BulkInventoryModal 
            uid={showGrantModal.uid}
            character={char}
            existingItemIds={new Set(characterInventories[compositeKey]?.map(t => t.id) || [])}
            onClose={() => setShowGrantModal(null)}
            onSuccess={loadInventories}
            onExecuteBulk={handleExecuteBulk}
          />
        );
      })()}

      {modal}
    </div>
  );
}
