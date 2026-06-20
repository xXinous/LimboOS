import { PlayerSessionProvider } from './player/context/PlayerProviders';
import PlayerRootShell from './player/components/PlayerRootShell';

export default function Player() {
  return (
    <PlayerSessionProvider>
      <PlayerRootShell />
    </PlayerSessionProvider>
  );
}
