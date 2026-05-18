# Plano de Refatoração: Sistema Unificado de Intel e Dicas (v2.0)

Este documento detalha a estratégia para unificar COMPLETAMENTE todos os colecionáveis, itens e dicas do Running Man em um sistema único de **"Intel" (Inteligência)**, eliminando redundâncias de sistemas legados de "Fitas", "Galeria" e "Dicas".

## 1. Visão Geral e Objetivos
Qualquer arquivo (Áudio, Vídeo, Imagem ou Texto) agora é tratado como uma **"Peça de Inteligência" (IntelItem)**. O sistema deve ser capaz de resolver qualquer um desses formatos a partir de um único fluxo de QR Code.

- **Unificação Total:** Fim da distinção técnica entre "Fita" e "Dica". Tudo é Intel.
- **Suporte Multimídia:** Engine única para renderizar `.mp3`, `.mp4`, `.jpg`, `.png` e `.txt`.
- **QR First:** Todo item no registro mestre é elegível para geração de QR Code.
- **Redundância Zero:** Remoção total de subcoleções separadas no Firestore em favor de um inventário único.

## 2. Arquitetura de Dados Unificada

### Entidade Central: `IntelItem`
```typescript
export type IntelType = 'AUDIO' | 'VISUAL' | 'TEXT' | 'META';
export type AccessLevel = 1 | 2 | 3 | 4;

export interface IntelItem {
  id: string;          // ID único (ex: intel_mission_01)
  type: IntelType;     // Tipo de mídia
  level: AccessLevel;  // Nível de acesso (1-4)
  title: string;       // Nome da prova/item
  description: string; // Descrição ou análise do agente
  
  // Conteúdo Dinâmico
  mediaUrl?: string;     // URL para Áudio, Vídeo ou Imagem
  textContent?: string;  // Texto puro ou dados criptografados
  
  metadata: {
    chapter?: string;    // Capítulo/Missão vinculada
    npc?: string;        // NPC relacionado
    hint?: string;       // Dica de como encontrar (se ainda não coletado)
    isSecret?: boolean;  // Se deve aparecer como [RESTRITO] na lista
    visualCategory?: string; // 'PHOTO', 'DOCUMENT', 'VIDEO', 'GADGET'
  }
}
```

## 3. Fluxo de QR Code e Resolução
O `IntelService` será o único ponto de entrada para QR Codes:
1. **Leitura:** O scanner lê um código (ID do IntelItem).
2. **Resolução:** O serviço busca no `IntelRegistry` (local) ou Firestore (remoto).
3. **Identificação de Tipo:**
   - Se `AUDIO` → Carrega no Walkman.
   - Se `VISUAL` (Imagem/Vídeo) → Abre no `EvidenceReader`.
   - Se `TEXT` → Abre no Terminal de Dados.
4. **Persistência:** O ID é salvo na coleção única `unlockedIntel` do Agente.

## 4. Plano de Execução (Fase 6: Unificação de Arquivos e Dicas)

### 6.1. Consolidação de Tipos e Registro
- [ ] Revisar `src/data/intel_registry.ts` para garantir que todos os itens legados (incluindo dicas soltas) estejam lá.
- [ ] Adicionar suporte explícito a Vídeo no metadado `visualCategory`.

### 6.2. Engine de Renderização Multimídia
- [ ] Atualizar `EvidenceReader.tsx` para garantir detecção automática de `.mp4`/`.mov` e renderizar tag `<video>`.
- [ ] Implementar visualização de "Dica" para itens não coletados (o item aparece na lista mas com conteúdo bloqueado e apenas a `hint` visível).

### 6.3. Limpeza de Redundância (Critical)
- [ ] **Firestore:** Migrar subcoleções `tapes` e `gallery` para a nova subcoleção unificada `intel`.
- [ ] **Componentes:** Remover definitivamente qualquer lógica que trate "Fitas" como algo diferente de "Imagens".
- [ ] **Admin:** Atualizar o `IntelCreatorPanel` para suportar upload de qualquer tipo de arquivo para o Firebase Storage, gerando o `IntelItem` automaticamente.

### 6.4. Sistema de Geração de QR
- [ ] Criar utilitário no Admin para gerar QR Codes em massa a partir do `IntelRegistry`.

## 5. Benefícios
1. **Arquitetura Limpa:** Um único `Array<IntelItem>` governa todo o progresso do jogador.
2. **Flexibilidade:** Você pode transformar um áudio em uma dica de texto apenas mudando o `type` no registro.
3. **Escalabilidade:** Suporte para novos formatos (como modelos 3D ou logs de sensor) sem criar novos serviços.

---
*Documento gerado para persistência de contexto. Última atualização: Maio 2026.*
