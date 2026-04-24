export interface Campaign {
  id: string;
  name: string;
  description: string;
  location: string;
  year: string;
  visualTheme: 'default' | 'terminal' | 'macos' | 'windows95';
  rpgSystem: string;
  status: 'Ativa' | 'Arquivada' | 'Bloqueada';
  imageUrl: string;
}

export const campaigns: Campaign[] = [
  {
    id: 'neo-sampa-2099',
    name: 'Neo-Sampa 2099',
    description: 'A maior megalópole da América Latina agora é um labirinto de luzes neon e sombras corporativas. A resistência opera nos baixos níveis.',
    location: 'Setor 011 - São Paulo',
    year: '2099',
    visualTheme: 'default',
    rpgSystem: 'Cyberpunk Red',
    status: 'Ativa',
    imageUrl: 'https://images.unsplash.com/photo-1514516311115-91220997d662?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'orbit-station-zero',
    name: 'Estação Orbital Zero',
    description: 'O último refúgio da elite, orbitando a Terra devastada. Segredos políticos e espionagem industrial definem o clima aqui.',
    location: 'Órbita Terrestre Baixa',
    year: '2105',
    visualTheme: 'terminal',
    rpgSystem: 'Mothership',
    status: 'Ativa',
    imageUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'retro-grid-84',
    name: 'The Retro Grid',
    description: 'Uma simulação nostálgica dos anos 80 que esconde um vírus capaz de derrubar a rede global. Entre para desativá-lo.',
    location: 'Cyber-Espaço',
    year: '1984 (Simulação)',
    visualTheme: 'windows95',
    rpgSystem: 'Tales from the Loop',
    status: 'Ativa',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'dead-zone-arizona',
    name: 'Zona Morta: Arizona',
    description: 'Terras áridas fora do controle corporativo. A sobrevivência é a única regra. Rumores dizem que o Running Man foi visto aqui.',
    location: 'Deserto do Arizona',
    year: '2097',
    visualTheme: 'macos',
    rpgSystem: 'Fallout 2d20',
    status: 'Bloqueada',
    imageUrl: 'https://images.unsplash.com/photo-1469474099711-423507d9d68b?q=80&w=800&auto=format&fit=crop',
  }
];
