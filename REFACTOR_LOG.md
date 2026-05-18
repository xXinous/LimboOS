# Log de Refatoração e Melhorias - RunningMan (Maio 2026)

Este documento resume todas as intervenções técnicas, correções de bugs e novas funcionalidades implementadas durante esta sessão de desenvolvimento.

## 1. Estabilidade e Performance (Core)
*   **AudioEngine:** Refatorado para eliminar *race conditions* em transições de volume (fade). Adicionada tipagem forte e tratamento de erros para bloqueios de autoplay.
*   **Paralelismo de Rede:** Refatoração dos serviços `UserService` e `IntelService` para utilizar `Promise.all`. O carregamento de inventários agora dispara todas as requisições simultaneamente, reduzindo drasticamente o tempo de espera.
*   **Otimização do Admin:** Implementado limite de 2000 eventos no `AdminAnalyticsService` para evitar lentidão no navegador e controle de custos no Firebase.

## 2. Sistema Multi-Personagem (Agents)
*   **Identidade Isolada:** O progresso (fitas, conquistas, galeria, estatísticas) agora é vinculado a Agentes específicos, e não mais à conta mestre.
*   **Troca de Agente (UX):**
    *   Integrado botão "Trocar Agente" no Perfil do Walkman.
    *   Implementado atalho de **Long Press (1s)** no ícone de usuário com feedback háptico (vibração).
    *   Adicionada opção "Alternar Agente" no menu de segurança da tela de Seleção de Missão.
*   **Gestão de Contas:** Adicionada função de Logout diretamente na tela de seleção de agentes.

## 3. Migração Segura (Legado)
*   **Proteção de Dados:** Desenvolvido script de migração ultra-robusto que detecta dados antigos "escondidos" na raiz da conta (mesmo que o usuário já tenha criado um personagem novo).
*   **Agente Veterano:** Criação automática do personagem `legacy_default` para abrigar o progresso recuperado, garantindo que nenhum item seja perdido na transição para o novo sistema.

## 4. Correções de Bugs (Bug Fixes)
*   **Firebase Errors:** Corrigido o erro de `invalid data (undefined)` ao filtrar campos vazios antes do salvamento no Firestore.
*   **ReferenceErrors:** Resolvidos erros de variáveis não definidas (`onChangeCharacter`, `onLogout`) em múltiplos componentes React.
*   **Path Guards:** Adicionadas proteções contra IDs nulos/undefined em chamadas do Firebase, evitando o erro crítico de `.indexOf` na biblioteca interna.
*   **Safe UI:** Adicionadas verificações de existência (`?.`) em todas as operações de manipulação de strings (`slice`, `split`) na interface.

## 6. Unificação de Intel (Fase 6)
*   **Migration Script:** Desenvolvido `migrateToUnifiedIntel` em `src/store/migration.ts` para consolidar fitas e galeria em uma subcoleção única `intel`.
*   **PlayerSyncService:** Refatorado para escutar a nova coleção `intel` simultaneamente às legadas, garantindo transição transparente.
*   **Tipagem Unificada:** Adicionado `unlockedIntelIds` ao `PlayerData` para acesso centralizado ao progresso.

## 5. Painel Administrativo
*   **Navegação Hierárquica:** O `UserRegistry` agora permite expandir usuários para gerenciar seus agentes individualmente.
*   **Ações de GM:**
    *   Implementada exclusão individual de agentes.
    *   Módulo de reset de senha movido para a modal de ajustes da conta mestre.
    *   Vinculação de fitas agora é feita selecionando o personagem específico.

---
*Documento gerado automaticamente para registro de histórico de manutenção.*
