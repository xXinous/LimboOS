# Plano de Migração: RunningMan (React -> Flutter)

Este documento detalha o planejamento técnico para portar o ecossistema **RunningMan** para Flutter, transformando-o em um aplicativo multiplataforma (Android, iOS, Desktop) enquanto mantém sincronia em tempo real com a versão Web atual via Firebase.

---

## 1. Visão Geral da Arquitetura
O app Flutter atuará como um cliente espelho do site. Ambos compartilharão o mesmo backend (Firebase), garantindo que o progresso do usuário seja persistente entre plataformas.

- **Backend:** Mantido (Firebase Auth, Firestore, Storage).
- **Frontend:** Flutter (Dart) substituindo React (TypeScript/Vite).
- **Sincronia:** Baseada em Streams (Firestore) em vez de Hooks/Snapshots manuais.

---

## 2. Mapeamento de Dependências (Stack Tecnológica)

| Funcionalidade | React (Atual) | Flutter (Proposto) |
| :--- | :--- | :--- |
| **Framework** | React 18 (TS) | Flutter 3.x (Dart) |
| **Gerência de Estado** | React Hooks / Custom Services | \`flutter_riverpod\` (Recomendado) |
| **Firebase Core** | \`firebase/app\` | \`firebase_core\` |
| **Banco de Dados** | \`firebase/firestore\` | \`cloud_firestore\` |
| **Autenticação** | \`firebase/auth\` | \`firebase_auth\` |
| **Storage** | \`firebase/storage\` | \`firebase_storage\` |
| **Player de Áudio** | \`AudioEngine.ts\` (HTML5) | \`just_audio\` + \`audio_service\` |
| **Scanner QR** | \`qr-scanner\` (Nimiq) | \`mobile_scanner\` |
| **Navegação** | State-based / Conditional Rendering | \`go_router\` |
| **Animações** | CSS Transitions/Animations | \`flutter_animate\` / \`Lottie\` |

---

## 3. Portabilidade de Dados (Modelagem Dart)

Todos os tipos definidos em \`src/types/player.ts\` e \`src/data/\` devem ser convertidos para classes Dart com suporte a serialização JSON (\`json_serializable\`).

### Principais Modelos:
- **\`UserData\`**: Dados de perfil, permissões e flags de sistema.
- **\`Tape\`**: Metadados da fita, URLs de áudio e tipos de conteúdo.
- **\`Achievement\`**: Definição de conquistas e regras de progresso.
- **\`PlayerStats\`**: Contadores de cliques e tempo de reprodução.

---

## 4. Portagem de Serviços Core

### 4.1 AudioEngine (O Coração do App)
- **Desafio:** Manter o áudio tocando em background no iOS/Android.
- **Solução:** Implementar \`just_audio\` dentro de um \`AudioHandler\` (pacote \`audio_service\`).
- **Recursos Necessários:**
  - Fading (Volume Ramp) idêntico ao original.
  - Sincronização da posição do áudio com o Firestore (opcional, para retomar de onde parou).

### 4.2 AchievementManager
- **Lógica:** Traduzir a classe \`AchievementManager\` para um \`Provider\` no Flutter.
- **Trigger:** Escutar mudanças no \`PlayerStats\` e disparar popups de conquista usando \`Overlay\` ou \`SnackBar\` customizados.

### 4.3 PlayerSyncService (Remote Control)
- **Funcionalidade:** O app deve escutar o campo \`forceAppScreen\` no documento do usuário no Firestore.
- **Ação:** Navegar automaticamente para telas como \`TerminalApp\` ou \`DiskRepair\` quando o admin/sistema disparar o comando via web.

---

## 5. UI/UX e Estética Retrô

O Flutter facilita a criação de UIs pixel-perfect.
- **Fontes:** Importar as mesmas fontes \`.ttf\`/\`.woff\` usadas no projeto atual via \`pubspec.yaml\`.
- **Componentes:**
  - **Walkman UI:** Usar \`Stack\` e \`Positioned\` para recriar o layout do player.
  - **Efeitos de Vidro/Ruído:** Aplicar \`BackdropFilter\` e \`ImageShader\`.
  - **Scanlines:** Criar um widget de overlay global com opacidade baixa para simular monitores CRT.

---

## 6. Recursos Nativos e Permissões

A versão Mobile exigirá configurações extras:
1.  **Câmera:** Permissão no \`AndroidManifest.xml\` e \`Info.plist\` para o Scanner QR.
2.  **Background Audio:** Configurar as "Background Capabilities" no iOS e o \`FOREGROUND_SERVICE\` no Android.
3.  **Notificações (Opcional):** \`firebase_messaging\` para avisar sobre novas fitas ou eventos de campanha.

---

## 7. Estratégia de Implementação (Passo a Passo)

1.  **Fase 1: Infraestrutura**
    - Inicializar projeto Flutter e FlutterFire.
    - Criar estrutura de pastas (\`lib/models\`, \`lib/services\`, \`lib/ui\`).
2.  **Fase 2: Autenticação**
    - Portar lógica de "Codinome" para email fake.
3.  **Fase 3: Sincronia de Dados**
    - Implementar Repositories que retornam \`Streams\` do Firestore.
4.  **Fase 4: Core Player**
    - Implementar o player de áudio com suporte a background.
5.  **Fase 5: UI Retrô**
    - Construir a interface do Walkman e bibliotecas de fitas.
6.  **Fase 6: Apps Internos**
    - Portar o Terminal, Disk Repair e Visualizador de Galeria.

---

## 8. Considerações de Sincronismo Web/App

- **Concorrência:** O Firebase lida com isso nativamente. Se o usuário estiver com o site e o app abertos, ambos atualizarão instantaneamente ao desbloquear algo.
- **Offline Mode:** O Flutter (via Firestore) permite persistência local. O usuário pode "ouvir" fitas já carregadas sem internet, e o progresso será sincronizado quando voltar online.

---
**Nota:** Este documento serve como guia mestre. Nenhuma alteração no código fonte original é necessária para iniciar o desenvolvimento do app em um novo diretório ou branch.
