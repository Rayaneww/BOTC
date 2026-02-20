import type { RoleType } from '../models/types.js';

interface SeedRole {
  id: string;
  name: string;
  type: RoleType;
  description: string;
}

export const fukanoScript = {
  id: 'fukano',
  name: 'Fukano',
  description: 'Script classique pour débuter, inspiré de Trouble Brewing',
};

export const fukanoRoles: SeedRole[] = [
  // Démon
  {
    id: 'diablotin',
    name: 'Diablotin',
    type: 'Démon',
    description: "Le Diablotin est le chef des Démons. Chaque nuit, il choisit de tuer quelqu'un. Il est mis au courant de trois rôles qui ne sont pas présents dans la partie. Si le Diablotin meurt, les Citadins gagnent. Mais s'il décide de se viser lui-même la nuit, il meurt et un Sbire choisi aléatoirement (la Femme Écarlate est prioritaire) devient alors le nouveau Diablotin.",
  },
  
  // Sbires
  {
    id: 'baron',
    name: 'Baron',
    type: 'Sbire',
    description: "Si le Baron est en jeu, deux rôles Étrangers sont automatiquement ajoutés à la composition.",
  },
  {
    id: 'empoisonneur',
    name: 'Empoisonneur',
    type: 'Sbire',
    description: "Chaque nuit, l'Empoisonneur empoisonne un joueur. Durant cette nuit et cette journée, le joueur empoisonné PEUT recevoir des informations erronées et/ou avoir ses pouvoirs rendus inutiles (au bon vouloir du MJ), sans même le savoir.",
  },
  {
    id: 'espion',
    name: 'Espion',
    type: 'Sbire',
    description: "L'Espion apparaît comme Citadin dans n'importe quelle situation. La première nuit, il reçoit les rôles de TOUS les joueurs.",
  },
  {
    id: 'femme_ecarlate',
    name: 'Femme Écarlate',
    type: 'Sbire',
    description: "Si cinq joueurs (ou plus) sont encore en vie à la mort du Diablotin, la Femme Écarlate devient Diablotin à sa place.",
  },
  
  // Citadins
  {
    id: 'archiviste',
    name: 'Archiviste',
    type: 'Citadin',
    description: "La première nuit, deux joueurs ainsi qu'un rôle Étranger spécifique sont indiqués à l'Archiviste. Parmi ces deux joueurs se trouve ce rôle Étranger.",
  },
  {
    id: 'croque_mort',
    name: 'Croque-mort',
    type: 'Citadin',
    description: "Si le Croque-Mort meurt la nuit, il se réveille alors pour désigner un joueur dont il apprendra l'identité. Il peut désigner un joueur mort.",
  },
  {
    id: 'cuistot',
    name: 'Cuistot',
    type: 'Citadin',
    description: "La première nuit, le Cuistot est mis au courant du nombre de \"paires\" de Démons autour de la table. Est considérée comme \"paire\" : deux Démons côte à côte. Si trois Démons sont d'affilée, alors il y a deux paires. Si aucun Démon n'est à côté d'un autre, alors il y a 0 paire.",
  },
  {
    id: 'empathe',
    name: 'Empathe',
    type: 'Citadin',
    description: "Chaque nuit, l'Empathe apprend le nombre de Méchants directement à côté d'elle (0, 1 ou 2). Les joueurs morts ne sont pas pris en compte.",
  },
  {
    id: 'enqueteur',
    name: 'Enquêteur',
    type: 'Citadin',
    description: "La première nuit, deux joueurs ainsi qu'un rôle Sbire spécifique sont indiqués à l'Enquêteur. Parmi ces deux joueurs se trouve ce rôle Sbire.",
  },
  {
    id: 'fossoyeur',
    name: 'Fossoyeur',
    type: 'Citadin',
    description: "Chaque nuit, si un joueur a été exécuté au vote lors de cette journée, le Fossoyeur apprendra l'identité de l'exécuté. Si le joueur exécuté était l'Ivrogne, le Fossoyeur verra le rôle d'Ivrogne et non le faux rôle attribué.",
  },
  {
    id: 'lavandiere',
    name: 'Lavandière',
    type: 'Citadin',
    description: "La première nuit, deux joueurs ainsi qu'un rôle Citadin spécifique sont indiqués à la Lavandière. Parmi ces deux joueurs se trouve ce rôle Citadin.",
  },
  {
    id: 'maire',
    name: 'Maire',
    type: 'Citadin',
    description: "Si le Maire est ciblé par le Diablotin la nuit, un autre joueur PEUT (selon le bon vouloir du MJ) mourir à sa place. Aussi, lorsqu'il reste trois joueurs en vie, si la journée se termine sans exécution, la partie se termine instantanément sur une victoire des Citadins.",
  },
  {
    id: 'moine',
    name: 'Moine',
    type: 'Citadin',
    description: "Chaque nuit, le Moine choisit un joueur autre que lui-même. Ce joueur ne peut pas mourir par le Démon cette nuit. Il peut choisir le même joueur plusieurs fois d'affilée.",
  },
  {
    id: 'pourfendeur',
    name: 'Pourfendeur',
    type: 'Citadin',
    description: "Une fois par partie, pendant la journée, le Pourfendeur peut désigner une cible aux yeux de tous. Si cette cible est le Diablotin, le Diablotin meurt. Si cette cible n'est pas le Diablotin, rien ne se passe.",
  },
  {
    id: 'soldat',
    name: 'Soldat',
    type: 'Citadin',
    description: "Le Soldat ne peut pas mourir du Diablotin la nuit. S'il est ciblé, rien ne se passe.",
  },
  {
    id: 'vierge',
    name: 'Vierge',
    type: 'Citadin',
    description: "Si la Vierge est nommée au vote et que le joueur qui l'a designée est un Citadin (Étrangers exclus), ce joueur est instantanément exécuté. Cette situation ne peut se produire qu'une fois.",
  },
  {
    id: 'voyante',
    name: 'Voyante',
    type: 'Citadin',
    description: "Chaque nuit, la Voyante choisit deux joueurs. Elle apprendra alors si le Diablotin se trouve parmi les deux. Cependant, l'un des Citadins (appelé le \"Leurre\"), choisi aléatoirement en début de partie par le MJ, apparaîtra comme Diablotin pour elle tout au long de la partie. Elle peut se choisir elle-même ainsi que des joueurs morts.",
  },
  
  // Étrangers
  {
    id: 'ivrogne',
    name: 'Ivrogne',
    type: 'Étranger',
    description: "L'Ivrogne ne sait pas qu'il l'est. Il croit être un rôle Citadin tout le long, mais ses pouvoirs sont en réalité inexistants. S'il se croit rôle à info, à chaque fois qu'il reçoit ses infos, le MJ lui en donne des aléatoires. Pour les autres rôles à info, il apparaît comme étant le rôle faussement attribué et non comme l'Ivrogne (sauf pour l'Archiviste et le Fossoyeur).",
  },
  {
    id: 'majordome',
    name: 'Majordome',
    type: 'Étranger',
    description: "Chaque nuit, il désigne son Maître. Il ne pourra voter QUE si son Maître décide de voter.",
  },
  {
    id: 'reclus',
    name: 'Reclus',
    type: 'Étranger',
    description: "À chaque action effectuée sur le Reclus, le Reclus PEUT apparaître comme un rôle totalement aléatoire. Il PEUT donc apparaître comme Démon aux yeux des rôles à info.",
  },
  {
    id: 'saint',
    name: 'Saint',
    type: 'Étranger',
    description: "Si le Saint est exécuté au vote, les Citadins perdent instantanément la partie.",
  },
];
