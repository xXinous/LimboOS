# Plano de Refatoração: Sistema Unificado de Intel (v1.0)

Este documento detalha a estratégia para unificar os colecionáveis do Running Man (Fitas, Galeria, Documentos e Conquistas) em um sistema coeso de **"Intel" (Inteligência)**.

## 1. Visão Geral e Objetivos
Atualmente, o sistema de progressão está fragmentado em múltiplos tipos de dados e serviços redundantes. O objetivo é criar uma arquitetura onde qualquer item coletável seja tratado como uma "Peça de Inteligência".

- **Navegação:** Acesso instantâneo a qualquer evidência.
- **Manutenção:** Lógica de desbloqueio única.
- **RPG Feel:** Categorização por Nível de Sigilo em vez de tipos técnicos.

## 2. Nova Arquitetura de Dados (Proposta)

### Entidade Central: `Intel`
```typescript
export type IntelType = 'AUDIO' | 'VISUAL' | 'TEXT' | 'META';
export type AccessLevel = 1 | 2 | 3 | 4; // Restrito, Confidencial, Sigiloso, Top Secret

export interface IntelItem {
  id: string;
  type: IntelType;
  level: AccessLevel;
  title: string;
  description: string;
  campaignId?: string;
  
  // Dados específicos por tipo (opcionais)
  mediaUrl?: string;     // URL da fita ou imagem
  textContent?: string;  // Conteúdo de disquete ou documento
  metadata?: IntelMetadata; // Dados extras (npc, local, stats, etc)
}
```

## 3. Estratégia de Categorização

Em vez de pastas técnicas, os itens serão organizados por seu papel na narrativa:

| Nível | Nome (RPG) | Exemplos de Conteúdo |
| :--- | :--- | :--- |
| **Nível 1** | **RESTRITO** | Briefings, Fotos de Locais, Fitas Introdutórias. |
| **Nível 2** | **CONFIDENCIAL** | Dossiês de NPCs, Mapas, Diários de Áudio. |
| **Nível 3** | **SIGILOSO** | Provas de Crimes, Interceptações, Disquetes Corrompidos. |
| **Nível 4** | **TOP SECRET** | Conquistas Raras, Easter Eggs, Revelações Finais. |

## 4. Plano de Execução (Roadmap)

### Fase 1: Fundação (Tipos e Registro) ✅ COMPLETO
- [x] Criar `src/types/intel.ts` com as novas interfaces.
- [x] Criar um `src/data/intel_registry.ts` que servirá como o "Master Database" unificado.
- [x] Mapear as fitas (`tapes.ts`) e imagens (`galleryImages`) atuais para o novo formato.
- [x] Funções de conversão bidirecional: `intelToLegacyTape()` e `legacyTapeToIntel()`.

### Fase 2: Lógica de Negócio (Serviços) ✅ COMPLETO
- [x] Implementar o `IntelService` (`src/services/IntelService.ts`):
    - `resolve(code)`: Resolve QR/código → IntelItem (com redirect + registry + Firebase).
    - `unlock(playerData, id)`: Lógica única para salvar no Firestore.
    - `getCollection(playerData)`: Retorna todo o inventário do jogador já formatado.
    - `resolveAll(ids)`: Resolve lista de IDs para IntelItems.
- [x] Atualizar `AnalyticsTracker` para usar `IntelRegistry` na avaliação de achievements.
- [x] Documentar `PlayerSyncService` sobre migração futura dos listeners.

### Fase 3: Interface (UX) ✅ COMPLETO
- [x] Refatorar `Player.tsx`: estado principal agora usa `IntelItem` (`currentIntel`, `ownedIntel`).
- [x] Eliminar o hack de conversão `Gallery → Tape` no `Player.tsx`.
- [x] Refatorar `EvidenceReader.tsx` para aceitar `IntelItem` com badge de Access Level.
- [x] Manter compatibilidade com componentes legados via `intelToLegacyTape()`.

### Fase 4: Migração e Limpeza (FUTURA)
- [ ] Criar script de migração (se necessário) para converter os IDs atuais no Firebase.
- [ ] Migrar `TapeLibrary.tsx` para aceitar `IntelItem[]` diretamente (remover conversão legacy).
- [ ] Migrar `AgentDossierOverlay.tsx` para aceitar `IntelItem[]` em vez de `Tape[]`.
- [ ] Migrar `CassetteVisor.tsx` para aceitar `IntelItem` em vez de `Tape`.
- [ ] Unificar listeners do `PlayerSyncService` em um único listener `intel`.
- [ ] Migrar painéis Admin (GalleryPanel, InventoryManager, etc.)
- [ ] Remover `TapeManager.ts` (totalmente absorvido pelo IntelService).
- [ ] Apagar tipos e serviços obsoletos quando todos os consumidores estiverem migrados.

## 5. Benefícios Esperados
1. **Consistência:** O jogador entende que tudo o que ele faz no jogo contribui para o seu "Nível de Inteligência".
2. **Performance:** Menos listeners do Firebase e menos transformações de dados em runtime.
3. **Escalabilidade:** Adicionar um novo tipo de coletável (ex: vídeo ou pista 3D) se torna trivial.

## 6. Arquivos Criados/Modificados

### Novos
| Arquivo | Descrição |
|:---|:---|
| `src/types/intel.ts` | Tipos centrais: IntelItem, IntelType, AccessLevel, conversores |
| `src/data/intel_registry.ts` | Registro mestre com itens locais + incorporação de remotos |
| `src/services/IntelService.ts` | Serviço unificado: resolve, unlock, getCollection |

### Modificados
| Arquivo | Mudança |
|:---|:---|
| `src/Player.tsx` | Estado usa IntelItem; removido hack Gallery→Tape; usa IntelService |
| `src/components/EvidenceReader.tsx` | Aceita IntelItem com badge de Access Level |
| `src/services/AnalyticsTracker.ts` | Resolve via IntelRegistry para achievements |
| `src/services/PlayerSyncService.ts` | Documentação da migração futura |

### Preservados (compatibilidade retroativa)
| Arquivo | Status |
|:---|:---|
| `src/data/tapes.ts` | Mantido — usado pelo admin e legacy |
| `src/services/TapeManager.ts` | Mantido — será removido na Fase 4 |
| `src/data/achievements.ts` | Mantido — regras de achievement inalteradas |
| `src/store/firestore.ts` | Mantido — funções legacy preservadas |

---
*Documento gerado para persistência de contexto. Última atualização: Maio 2026.*
