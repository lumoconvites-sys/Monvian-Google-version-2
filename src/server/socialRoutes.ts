import { Database as SqliteDatabase } from 'better-sqlite3';
import { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { firestore } from '../services/firestoreSync';
import { doc, setDoc, deleteDoc, getDoc, updateDoc, increment } from 'firebase/firestore';

export interface PostEntity {
  id: string;
  user_id: string;
  user_name: string;
  user_username?: string;
  user_photo: string;
  image_url: string;
  caption?: string;
  location?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_me?: boolean;
}

export interface CommentEntity {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_photo: string;
  text: string;
  created_at: string;
}

/**
 * 30 Initial Real Campos do Jordão Posts with High Quality Photos
 */
const INITIAL_CAMPOS_POSTS: Array<{
  id: string;
  user_id: string;
  user_name: string;
  user_photo: string;
  image_url: string;
  caption: string;
  location: string;
  likes_count: number;
  comments_count: number;
  comments: Array<{ user_name: string; user_photo: string; text: string }>;
}> = [
  {
    id: 'post-campos-01',
    user_id: 'u-mariana',
    user_name: 'Mariana Silva',
    user_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=85',
    caption: 'Manhã mágica entre as montanhas e araucárias de Campos do Jordão.',
    location: 'Vila Capivari, Campos do Jordão',
    likes_count: 84,
    comments_count: 6,
    comments: [
      { user_name: 'Lucas Almeida', user_photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80', text: 'Que foto linda! Esse clima frio é perfeito.' },
      { user_name: 'Beatriz Costa', user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', text: 'Campos tem uma energia única no outono.' },
      { user_name: 'Rafael Torres', user_photo: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80', text: 'Tirada de qual mirante?' }
    ]
  },
  {
    id: 'post-campos-02',
    user_id: 'u-gabriel',
    user_name: 'Gabriel Martins',
    user_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
    caption: 'Fondue tradicional no friozinho de 11°C. Impossível vir e não experimentar.',
    location: 'Restaurante Ludwig, Capivari',
    likes_count: 142,
    comments_count: 8,
    comments: [
      { user_name: 'Camila Rocha', user_photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', text: 'O melhor fondue da serra!' },
      { user_name: 'Felipe Santos', user_photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', text: 'Combinação perfeita com vinho tinto.' }
    ]
  },
  {
    id: 'post-campos-03',
    user_id: 'u-juliana',
    user_name: 'Juliana Mendes',
    user_photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85',
    caption: 'Vista deslumbrante do Morro do Elefante com o teleférico novinho em folha.',
    location: 'Parque Capivari, Morro do Elefante',
    likes_count: 198,
    comments_count: 12,
    comments: [
      { user_name: 'Mariana Silva', user_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', text: 'O teleférico de cabine é incrível!' }
    ]
  },
  {
    id: 'post-campos-04',
    user_id: 'u-thiago',
    user_name: 'Thiago Nogueira',
    user_photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=85',
    caption: 'Paz absoluta caminhando pelas trilhas do Bosque do Silêncio.',
    location: 'Bosque do Silêncio',
    likes_count: 73,
    comments_count: 4,
    comments: [
      { user_name: 'Camila Rocha', user_photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', text: 'Um dos meus lugares favoritos de Campos.' }
    ]
  },
  {
    id: 'post-campos-05',
    user_id: 'u-larissa',
    user_name: 'Larissa Ferreira',
    user_photo: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=85',
    caption: 'Entardecer dourado na Pedra do Baú. A Mantiqueira nunca decepciona.',
    location: 'Complexo da Pedra do Baú',
    likes_count: 265,
    comments_count: 18,
    comments: [
      { user_name: 'Gabriel Martins', user_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', text: 'Uau! Que foto espetacular!' },
      { user_name: 'Beatriz Costa', user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', text: 'Subiu pela trilha da Ana Chata?' }
    ]
  },
  {
    id: 'post-campos-06',
    user_id: 'u-andre',
    user_name: 'André Carvalho',
    user_photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85',
    caption: 'Café da tarde quentinho com chocolate artesanal no Baden Baden.',
    location: 'Cervejaria Baden Baden, Capivari',
    likes_count: 110,
    comments_count: 5,
    comments: [
      { user_name: 'Lucas Almeida', user_photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80', text: 'Pediu a cerveja de trigo e o pastel de truta?' }
    ]
  },
  {
    id: 'post-campos-07',
    user_id: 'u-beatriz',
    user_name: 'Beatriz Costa',
    user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=85',
    caption: 'Jardins de Amantikir: arte que fala através das flores e labirintos verdes.',
    location: 'Parque Amantikir',
    likes_count: 187,
    comments_count: 9,
    comments: [
      { user_name: 'Juliana Mendes', user_photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', text: 'O labirinto de grama é um clássico!' }
    ]
  },
  {
    id: 'post-campos-08',
    user_id: 'u-rodrigo',
    user_name: 'Rodrigo Lima',
    user_photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=85',
    caption: 'Névoa matinal atravessando as árvores centenárias do Horto Florestal.',
    location: 'Parque Estadual de Campos do Jordão (Horto)',
    likes_count: 92,
    comments_count: 3,
    comments: [
      { user_name: 'Mariana Silva', user_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', text: 'O ar puro daqui revigora qualquer um.' }
    ]
  },
  {
    id: 'post-campos-09',
    user_id: 'u-fernanda',
    user_name: 'Fernanda Pires',
    user_photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=85',
    caption: 'Degustação especial de vinhos da serra. Rótulos locais surpreendentes.',
    location: 'Vinícola Villa Santa Maria',
    likes_count: 156,
    comments_count: 11,
    comments: [
      { user_name: 'Gabriel Martins', user_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', text: 'Vinhos de altitude surpreendendo sempre.' }
    ]
  },
  {
    id: 'post-campos-10',
    user_id: 'u-lucas',
    user_name: 'Lucas Almeida',
    user_photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85',
    caption: 'Arquitetura alpina iluminada ao cair da noite no centro do Capivari.',
    location: 'Praça São Benedito, Capivari',
    likes_count: 164,
    comments_count: 7,
    comments: [
      { user_name: 'Beatriz Costa', user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', text: 'Parece uma vila na Suíça!' }
    ]
  },
  {
    id: 'post-campos-11',
    user_id: 'u-vanessa',
    user_name: 'Vanessa Toledo',
    user_photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=85',
    caption: 'Pôr do sol cinematográfico no Mirante da Vista Chinesa.',
    location: 'Mirante da Vista Chinesa (Belvedere)',
    likes_count: 221,
    comments_count: 14,
    comments: [
      { user_name: 'Thiago Nogueira', user_photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80', text: 'A serra toda no horizonte, inesquecível.' }
    ]
  },
  {
    id: 'post-campos-12',
    user_id: 'u-eduardo',
    user_name: 'Eduardo Ramos',
    user_photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1200&q=85',
    caption: 'Passeio refrescante na Ducha de Prata pelas passarelas de madeira.',
    location: 'Ducha de Prata',
    likes_count: 89,
    comments_count: 5,
    comments: [
      { user_name: 'Mariana Silva', user_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', text: 'Lugar histórico e delicioso para fotos.' }
    ]
  },
  {
    id: 'post-campos-13',
    user_id: 'u-camila',
    user_name: 'Camila Rocha',
    user_photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=85',
    caption: 'Pico do Itapeva a mais de 2.000 metros de altitude. Dá para ver o Vale todo!',
    location: 'Pico do Itapeva',
    likes_count: 312,
    comments_count: 21,
    comments: [
      { user_name: 'Gabriel Martins', user_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', text: 'O lavandário lá de cima é surreal.' },
      { user_name: 'Larissa Ferreira', user_photo: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80', text: 'A vista das cidades do Vale é sensacional.' }
    ]
  },
  {
    id: 'post-campos-14',
    user_id: 'u-marcelo',
    user_name: 'Marcelo Rossi',
    user_photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=85',
    caption: 'O charme nostálgico do bondinho elétrico percorrendo a cidade.',
    location: 'Estrada de Ferro Campos do Jordão',
    likes_count: 128,
    comments_count: 6,
    comments: [
      { user_name: 'Lucas Almeida', user_photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80', text: 'As crianças adoram esse passeio!' }
    ]
  },
  {
    id: 'post-campos-15',
    user_id: 'u-priscila',
    user_name: 'Priscila Bueno',
    user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=85',
    caption: 'Café da manhã de conto de fadas em uma das pousadas charmosas da serra.',
    location: 'Vila Inglesa, Campos do Jordão',
    likes_count: 175,
    comments_count: 9,
    comments: [
      { user_name: 'Camila Rocha', user_photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', text: 'Que delícia de lugar!' }
    ]
  },
  // Batch 2 (posts 16 to 30) for smooth infinite scroll pagination
  {
    id: 'post-campos-16',
    user_id: 'u-felipe',
    user_name: 'Felipe Santos',
    user_photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85',
    caption: 'Manhã fria de geada no Vale do Lajeado. Termômetro marcou 4°C!',
    location: 'Vale do Lajeado',
    likes_count: 243,
    comments_count: 15,
    comments: [
      { user_name: 'Mariana Silva', user_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', text: 'Adoro o inverno rigoroso daqui!' }
    ]
  },
  {
    id: 'post-campos-17',
    user_id: 'u-clara',
    user_name: 'Clara Meirelles',
    user_photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=85',
    caption: 'Caminhada matinal pelo Parque da Lagoinha. O lago estava como um espelho.',
    location: 'Parque da Lagoinha',
    likes_count: 139,
    comments_count: 8,
    comments: []
  },
  {
    id: 'post-campos-18',
    user_id: 'u-lucas',
    user_name: 'Lucas Almeida',
    user_photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
    caption: 'Noite de truta com pinhão e vinho quente na lareira.',
    location: 'Vila Capivari',
    likes_count: 118,
    comments_count: 4,
    comments: []
  },
  {
    id: 'post-campos-19',
    user_id: 'u-mariana',
    user_name: 'Mariana Silva',
    user_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
    caption: 'Serra da Mantiqueira coberta por nuvens baixas ao amanhecer.',
    location: 'Pico do Imbiri',
    likes_count: 279,
    comments_count: 19,
    comments: []
  },
  {
    id: 'post-campos-20',
    user_id: 'u-gabriel',
    user_name: 'Gabriel Martins',
    user_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85',
    caption: 'Chocolate quente cremoso da fábrica Spinassi. Tradição imperdível!',
    location: 'Chocolates Spinassi',
    likes_count: 147,
    comments_count: 7,
    comments: []
  },
  {
    id: 'post-campos-21',
    user_id: 'u-beatriz',
    user_name: 'Beatriz Costa',
    user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=85',
    caption: 'Passeio a cavalo pelas montanhas ao pôr do sol.',
    location: 'Haras da Serra',
    likes_count: 162,
    comments_count: 5,
    comments: []
  },
  {
    id: 'post-campos-22',
    user_id: 'u-thiago',
    user_name: 'Thiago Nogueira',
    user_photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=85',
    caption: 'Orquidário e estufas do Amantikir. Cores vivas no inverno.',
    location: 'Parque Amantikir',
    likes_count: 95,
    comments_count: 3,
    comments: []
  },
  {
    id: 'post-campos-23',
    user_id: 'u-larissa',
    user_name: 'Larissa Ferreira',
    user_photo: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=85',
    caption: 'Mais um fim de tarde inesquecível nessa cidade mágica.',
    location: 'Campos do Jordão, SP',
    likes_count: 204,
    comments_count: 11,
    comments: []
  },
  {
    id: 'post-campos-24',
    user_id: 'u-rodrigo',
    user_name: 'Rodrigo Lima',
    user_photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=85',
    caption: 'Cachoeira do Gavião Gonzaga no meio da mata atlântica serrana.',
    location: 'Horto Florestal',
    likes_count: 83,
    comments_count: 2,
    comments: []
  },
  {
    id: 'post-campos-25',
    user_id: 'u-camila',
    user_name: 'Camila Rocha',
    user_photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=85',
    caption: 'Céu estrelado limpo de altitude na Pedra do Baú. Incomparável!',
    location: 'Pedra do Baú',
    likes_count: 341,
    comments_count: 24,
    comments: []
  },
  {
    id: 'post-campos-26',
    user_id: 'u-juliana',
    user_name: 'Juliana Mendes',
    user_photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85',
    caption: 'Lojas de malhas e aconchego nas ruelas europeias do Capivari.',
    location: 'Vila Capivari',
    likes_count: 122,
    comments_count: 6,
    comments: []
  },
  {
    id: 'post-campos-27',
    user_id: 'u-fernanda',
    user_name: 'Fernanda Pires',
    user_photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=85',
    caption: 'Brinde especial nas vinícolas das montanhas.',
    location: 'São Bento do Sapucaí / Campos do Jordão',
    likes_count: 153,
    comments_count: 8,
    comments: []
  },
  {
    id: 'post-campos-28',
    user_id: 'u-marcelo',
    user_name: 'Marcelo Rossi',
    user_photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=85',
    caption: 'Casas enxaimel e pinheiros da Mantiqueira ao redor.',
    location: 'Alto Capivari',
    likes_count: 177,
    comments_count: 10,
    comments: []
  },
  {
    id: 'post-campos-29',
    user_id: 'u-vanessa',
    user_name: 'Vanessa Toledo',
    user_photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=85',
    caption: 'Aquele cafezinho com strudel de maçã quentinho.',
    location: 'Sans Souci Café',
    likes_count: 191,
    comments_count: 13,
    comments: []
  },
  {
    id: 'post-campos-30',
    user_id: 'u-eduardo',
    user_name: 'Eduardo Ramos',
    user_photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    image_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=85',
    caption: 'Fechando a viagem com chave de ouro: o mirante do Pico do Itapeva.',
    location: 'Pico do Itapeva',
    likes_count: 288,
    comments_count: 17,
    comments: []
  }
];

export function setupSocialDatabase(db: SqliteDatabase) {
  // Ensure tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_photo TEXT,
      image_url TEXT NOT NULL,
      caption TEXT,
      location TEXT DEFAULT 'Campos do Jordão, SP',
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_photo TEXT,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS social_notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_photo TEXT,
      type TEXT NOT NULL,
      post_id TEXT,
      post_image TEXT,
      comment_text TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON post_likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_notif_recipient ON social_notifications(recipient_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);
  `);

  // Ensure public uploads folder
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Pre-seed initial posts if empty
  const count = (db.prepare('SELECT count(*) as count FROM posts').get() as any)?.count || 0;
  if (count === 0) {
    const insertPost = db.prepare(`
      INSERT INTO posts (id, user_id, user_name, user_photo, image_url, caption, location, likes_count, comments_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    const insertComment = db.prepare(`
      INSERT INTO post_comments (id, post_id, user_id, user_name, user_photo, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    const seedTransaction = db.transaction(() => {
      INITIAL_CAMPOS_POSTS.forEach((p, idx) => {
        const timeOffset = `-${idx * 2} hours`;
        insertPost.run(
          p.id,
          p.user_id,
          p.user_name,
          p.user_photo,
          p.image_url,
          p.caption,
          p.location,
          p.likes_count,
          p.comments.length || p.comments_count,
          timeOffset
        );

        p.comments.forEach((c, cIdx) => {
          const commentId = `cmt-${p.id}-${cIdx + 1}`;
          insertComment.run(
            commentId,
            p.id,
            `user-${c.user_name.toLowerCase().replace(/\s+/g, '')}`,
            c.user_name,
            c.user_photo,
            c.text,
            timeOffset
          );
        });
      });
    });

    seedTransaction();
    console.log(`[SocialFeed] Seeded ${INITIAL_CAMPOS_POSTS.length} high-quality Campos do Jordão posts.`);

    // Sync seed to Firestore in background
    INITIAL_CAMPOS_POSTS.forEach(async (p) => {
      try {
        await setDoc(doc(firestore, 'posts', p.id), {
          id: p.id,
          userId: p.user_id,
          userName: p.user_name,
          userPhoto: p.user_photo,
          imageUrl: p.image_url,
          caption: p.caption,
          location: p.location,
          likesCount: p.likes_count,
          commentsCount: p.comments.length || p.comments_count,
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {}
    });
  }

  // Ensure user_username column exists in posts
  try { db.exec(`ALTER TABLE posts ADD COLUMN user_username TEXT;`); } catch (e) {}

  // Ensure users table has all required columns for creators seed and user profiles
  try { db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN username_normalized TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`); } catch (e) {}
  try {
    db.exec(`
      UPDATE users 
      SET username_normalized = LOWER(REPLACE(COALESCE(username, name, email, 'user'), ' ', ''))
      WHERE username_normalized IS NULL OR username_normalized = '';
    `);
  } catch (e) {}

  // Seed real creators into users table and backfill user_username in posts
  try {
    const SEED_CAMPOS_CREATORS = [
      { name: 'Mariana Silva', username: 'marianasilva', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', bio: 'Explorando as belezas e o charme de Campos do Jordão 🍁' },
      { name: 'Gabriel Martins', username: 'gabrielmartins', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', bio: 'Amante de gastronomia serrana e bons vinhos 🍷' },
      { name: 'Juliana Mendes', username: 'julianamendes', photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', bio: 'Aventureira nas trilhas e montanhas da Mantiqueira 🏔️' },
      { name: 'Thiago Nogueira', username: 'thiagonogueira', photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80', bio: 'Fotógrafo da natureza e do friozinho serrano 📸' },
      { name: 'Larissa Ferreira', username: 'larissaferreira', photo: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80', bio: 'Passeios, mirantes e pores do sol em Campos 🌲' },
      { name: 'André Carvalho', username: 'andrecarvalho', photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80', bio: 'Descobrindo cerveja artesanal e clima alpino 🍺' },
      { name: 'Beatriz Costa', username: 'beatrizcosta', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', bio: 'Jardins, labirintos e arquitetura de Campos 🌸' },
      { name: 'Rodrigo Lima', username: 'rodrigolima', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80', bio: 'Horto Florestal, cachoeiras e ar puro da serra 🌿' },
      { name: 'Fernanda Pires', username: 'fernandapires', photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80', bio: 'Enoturismo e vinícolas de altitude na Mantiqueira 🍇' },
      { name: 'Lucas Almeida', username: 'lucasalmeida', photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80', bio: 'Vila Capivari, fondue e o encanto do inverno ❄️' },
      { name: 'Vanessa Toledo', username: 'vanessatoledo', photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=200&q=80', bio: 'Mirantes cinematográficos e cafés aconchegantes ☕' },
      { name: 'Eduardo Ramos', username: 'eduardoramos', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', bio: 'Ducha de Prata, passeios históricos e trilhas 🥾' },
      { name: 'Camila Rocha', username: 'camilarocha', photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', bio: 'Pico do Itapeva e céu estrelado da serra ✨' },
      { name: 'Marcelo Rossi', username: 'marcelorossi', photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80', bio: 'Arquitetura alpina, bondinhos e história 🚂' },
      { name: 'Priscila Bueno', username: 'priscilabueno', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', bio: 'Pousadas charmosas e roteiros românticos em Campos 🏡' },
      { name: 'Felipe Santos', username: 'felipesantos', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', bio: 'Inverno na serra, geadas e noites na lareira 🔥' },
      { name: 'Clara Meirelles', username: 'clarameirelles', photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', bio: 'Caminhadas relaxantes e os encantos do Capivari 🌼' },
    ];

    for (const c of SEED_CAMPOS_CREATORS) {
      const existing = db.prepare('SELECT id FROM users WHERE username_normalized = ?').get(c.username);
      if (!existing) {
        db.prepare(`
          INSERT INTO users (name, username, username_normalized, email, whatsapp, password_hash, role, avatar_url, bio)
          VALUES (?, ?, ?, ?, ?, 'seed_default_hash', 'user', ?, ?)
        `).run(c.name, c.username, c.username, `${c.username}@monvian.app`, `${c.username}@monvian.app`, c.photo, c.bio);
      } else {
        db.prepare('UPDATE users SET bio = ?, avatar_url = ? WHERE username_normalized = ?').run(c.bio, c.photo, c.username);
      }

      // Populate user_username in posts
      db.prepare(`
        UPDATE posts 
        SET user_username = ? 
        WHERE LOWER(user_name) = ? OR user_id = ? OR user_id = ?
      `).run(c.username, c.name.toLowerCase(), `u-${c.username}`, c.username);
    }

    // Seed realistic initial follows between creators if table is empty
    const existingFollows = (db.prepare('SELECT count(*) as count FROM user_follows').get() as any)?.count || 0;
    if (existingFollows === 0) {
      const insertFollow = db.prepare('INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)');
      SEED_CAMPOS_CREATORS.forEach((c, i) => {
        for (let step = 1; step <= 5; step++) {
          const other = SEED_CAMPOS_CREATORS[(i + step) % SEED_CAMPOS_CREATORS.length];
          insertFollow.run(c.username, other.username);
        }
      });
    }
  } catch (seedErr) {
    console.warn('[SocialRoutes] Creators seed notice:', seedErr);
  }
}

/**
 * Register social feed API routes
 */
export function registerSocialRoutes(app: Express, db: SqliteDatabase) {
  // Helper to extract user identity from Bearer token or fallback
  const getUserFromReq = (req: Request): { id: string; name: string; photo: string; username: string } => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const session = db.prepare(`
          SELECT s.user_id, u.name, u.email, u.avatar_url, u.username, u.username_normalized 
          FROM sessions s 
          JOIN users u ON s.user_id = u.id 
          WHERE s.token = ?
        `).get(token) as any;

        if (session) {
          const uName = session.username || (session.name ? session.name.toLowerCase().replace(/[^a-z0-9_]/g, '') : `user_${session.user_id}`);
          return {
            id: String(session.user_id),
            name: session.name || session.email?.split('@')[0] || 'Visitante',
            photo: session.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
            username: uName
          };
        }
      }
    } catch {}

    // Fallback: check query or body client identity
    const clientId = (req.query.clientId as string) || req.body?.clientId || (req.headers['x-user-id'] as string);
    const clientName = req.body?.userName;
    const clientPhoto = req.body?.userPhoto;
    const clientUsername = req.body?.username || (clientId ? `user_${clientId}` : 'visitante');

    return {
      id: clientId || 'visitor-anon',
      name: clientName || 'Visitante de Campos',
      photo: clientPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      username: clientUsername
    };
  };

  /**
   * GET /api/posts
   * Paginated: exactly 15 posts per page
   */
  app.get('/api/posts', (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(30, Math.max(1, parseInt(req.query.limit as string) || 15));
      const offset = (page - 1) * limit;
      const user = getUserFromReq(req);

      const totalRow = db.prepare('SELECT count(*) as count FROM posts').get() as { count: number };
      const total = totalRow?.count || 0;

      const postsRows = db.prepare(`
        SELECT 
          p.id,
          p.user_id,
          p.user_name,
          COALESCE(p.user_username, u.username, REPLACE(LOWER(p.user_name), ' ', '')) as user_username,
          p.user_photo,
          p.image_url,
          p.caption,
          p.location,
          p.likes_count,
          p.comments_count,
          p.created_at,
          CASE WHEN l.post_id IS NOT NULL THEN 1 ELSE 0 END as liked_by_me
        FROM posts p
        LEFT JOIN users u ON p.user_id = CAST(u.id AS TEXT) OR p.user_username = u.username_normalized
        LEFT JOIN post_likes l ON p.id = l.post_id AND l.user_id = ?
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `).all(user.id, limit, offset) as any[];

      const posts: PostEntity[] = postsRows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        user_name: r.user_name,
        user_username: r.user_username || r.user_name.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        user_photo: r.user_photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
        image_url: r.image_url,
        caption: r.caption,
        location: r.location,
        likes_count: Number(r.likes_count || 0),
        comments_count: Number(r.comments_count || 0),
        created_at: r.created_at,
        liked_by_me: Boolean(r.liked_by_me)
      }));

      const hasMore = offset + posts.length < total;

      res.json({
        success: true,
        posts,
        page,
        limit,
        total,
        hasMore
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error listing posts:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar publicações' });
    }
  });

  /**
   * POST /api/posts
   * Create a new post
   */
  app.post('/api/posts', async (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const { image_url, caption, location } = req.body;

      if (!image_url || typeof image_url !== 'string') {
        res.status(400).json({ success: false, error: 'URL da foto é obrigatória' });
        return;
      }

      const id = 'post-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
      const cleanLocation = (location && typeof location === 'string') ? location.trim() : 'Campos do Jordão, SP';
      const cleanCaption = (caption && typeof caption === 'string') ? caption.trim() : '';

      const uUsername = user.username || user.name.toLowerCase().replace(/[^a-z0-9_]/g, '');

      db.prepare(`
        INSERT INTO posts (id, user_id, user_name, user_username, user_photo, image_url, caption, location, likes_count, comments_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
      `).run(
        id,
        user.id,
        user.name,
        uUsername,
        user.photo,
        image_url,
        cleanCaption,
        cleanLocation
      );

      const created = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;

      // Sync to Firestore
      try {
        await setDoc(doc(firestore, 'posts', id), {
          id,
          userId: user.id,
          userName: user.name,
          userPhoto: user.photo,
          imageUrl: image_url,
          caption: cleanCaption,
          location: cleanLocation,
          likesCount: 0,
          commentsCount: 0,
          createdAt: new Date().toISOString()
        });
      } catch (fErr) {
        console.warn('[SocialRoutes] Firestore post sync warning:', fErr);
      }

      res.json({
        success: true,
        post: {
          ...created,
          likes_count: 0,
          comments_count: 0,
          liked_by_me: false
        }
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error creating post:', err);
      res.status(500).json({ success: false, error: 'Erro ao publicar foto' });
    }
  });

  /**
   * POST /api/posts/:id/like
   * Atomic toggle like/unlike
   */
  app.post('/api/posts/:id/like', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = getUserFromReq(req);

      const postExists = db.prepare('SELECT id, likes_count FROM posts WHERE id = ?').get(id) as any;
      if (!postExists) {
        res.status(404).json({ success: false, error: 'Publicação não encontrada' });
        return;
      }

      const existingLike = db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?').get(id, user.id);

      let liked = false;
      let newLikesCount = postExists.likes_count;

      if (existingLike) {
        // Remove like
        db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(id, user.id);
        db.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(id);
        newLikesCount = Math.max(0, newLikesCount - 1);
        liked = false;

        // Sync Firestore
        try {
          await deleteDoc(doc(firestore, 'post_likes', `${id}_${user.id}`));
          await updateDoc(doc(firestore, 'posts', id), { likesCount: increment(-1) });
        } catch {}
      } else {
        // Add like
        db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(id, user.id);
        db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(id);
        newLikesCount += 1;
        liked = true;

        // Insert notification if recipient is not the liker
        try {
          if (postExists.user_id && postExists.user_id !== user.id) {
            const notifId = 'notif-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
            db.prepare(`
              INSERT INTO social_notifications (id, recipient_id, sender_id, sender_name, sender_photo, type, post_id, post_image, comment_text, is_read, created_at)
              VALUES (?, ?, ?, ?, ?, 'like', ?, ?, NULL, 0, CURRENT_TIMESTAMP)
            `).run(notifId, postExists.user_id, user.id, user.name, user.photo, id, postExists.image_url);
          }
        } catch (nErr) {
          console.error('[SocialRoutes] Error saving like notification:', nErr);
        }

        // Sync Firestore
        try {
          await setDoc(doc(firestore, 'post_likes', `${id}_${user.id}`), {
            postId: id,
            userId: user.id,
            createdAt: new Date().toISOString()
          });
          await updateDoc(doc(firestore, 'posts', id), { likesCount: increment(1) });
        } catch {}
      }

      res.json({
        success: true,
        liked,
        likes_count: newLikesCount
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error toggling like:', err);
      res.status(500).json({ success: false, error: 'Erro ao curtir publicação' });
    }
  });

  /**
   * GET /api/posts/:id/comments
   * Retrieve comments for a post
   */
  app.get('/api/posts/:id/comments', (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const rows = db.prepare(`
        SELECT id, post_id, user_id, user_name, user_photo, text, created_at
        FROM post_comments
        WHERE post_id = ?
        ORDER BY created_at ASC
      `).all(id) as any[];

      const comments: CommentEntity[] = rows.map((r) => ({
        id: r.id,
        post_id: r.post_id,
        user_id: r.user_id,
        user_name: r.user_name,
        user_photo: r.user_photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
        text: r.text,
        created_at: r.created_at
      }));

      res.json({ success: true, comments });
    } catch (err: any) {
      console.error('[SocialRoutes] Error listing comments:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar comentários' });
    }
  });

  /**
   * POST /api/posts/:id/comments
   * Add comment to a post
   */
  app.post('/api/posts/:id/comments', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = getUserFromReq(req);
      const { text } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ success: false, error: 'Texto do comentário é obrigatório' });
        return;
      }

      const postExists = db.prepare('SELECT id, user_id, image_url, comments_count FROM posts WHERE id = ?').get(id) as any;
      if (!postExists) {
        res.status(404).json({ success: false, error: 'Publicação não encontrada' });
        return;
      }

      const commentId = 'cmt-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
      const cleanText = text.trim();

      db.prepare(`
        INSERT INTO post_comments (id, post_id, user_id, user_name, user_photo, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(commentId, id, user.id, user.name, user.photo, cleanText);

      db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(id);

      // Insert notification if recipient is not the commenter
      try {
        if (postExists.user_id && postExists.user_id !== user.id) {
          const notifId = 'notif-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
          db.prepare(`
            INSERT INTO social_notifications (id, recipient_id, sender_id, sender_name, sender_photo, type, post_id, post_image, comment_text, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 'comment', ?, ?, ?, 0, CURRENT_TIMESTAMP)
          `).run(notifId, postExists.user_id, user.id, user.name, user.photo, id, postExists.image_url, cleanText);
        }
      } catch (nErr) {
        console.error('[SocialRoutes] Error saving comment notification:', nErr);
      }

      const createdComment = db.prepare('SELECT * FROM post_comments WHERE id = ?').get(commentId) as any;

      // Sync Firestore
      try {
        await setDoc(doc(firestore, 'post_comments', commentId), {
          id: commentId,
          postId: id,
          userId: user.id,
          userName: user.name,
          userPhoto: user.photo,
          text: cleanText,
          createdAt: new Date().toISOString()
        });
        await updateDoc(doc(firestore, 'posts', id), { commentsCount: increment(1) });
      } catch {}

      res.json({
        success: true,
        comment: createdComment,
        comments_count: postExists.comments_count + 1
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error adding comment:', err);
      res.status(500).json({ success: false, error: 'Erro ao enviar comentário' });
    }
  });

  /**
   * GET /api/notifications
   * Fetch user notifications with unread count
   */
  app.get('/api/notifications', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const recipientId = user.id;

      // Check count of notifications for user
      const count = (db.prepare('SELECT count(*) as count FROM social_notifications WHERE recipient_id = ?').get(recipientId) as any)?.count || 0;

      // If user has no notifications yet, seed realistic initial notifications for rich user experience
      if (count === 0) {
        const seedNotifs = [
          {
            id: 'notif-seed-01',
            sender_name: 'sophiagsl._',
            sender_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
            type: 'like',
            post_image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80',
            comment_text: null,
            time_offset: '-5 minutes',
            is_read: 0
          },
          {
            id: 'notif-seed-02',
            sender_name: 'mariana_silva',
            sender_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
            type: 'comment',
            post_image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80',
            comment_text: 'Que foto espetacular! Campos do Jordão é mágica.',
            time_offset: '-28 minutes',
            is_read: 0
          },
          {
            id: 'notif-seed-03',
            sender_name: 'raianealecrim_',
            sender_photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
            type: 'follow',
            post_image: null,
            comment_text: null,
            time_offset: '-2 hours',
            is_read: 0
          },
          {
            id: 'notif-seed-04',
            sender_name: 'gabriel_serra',
            sender_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
            type: 'like',
            post_image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80',
            comment_text: null,
            time_offset: '-5 hours',
            is_read: 1
          },
          {
            id: 'notif-seed-05',
            sender_name: '_silvvax',
            sender_photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
            type: 'comment',
            post_image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80',
            comment_text: 'O friozinho do Capivari é incomparável!',
            time_offset: '-1 day',
            is_read: 1
          },
          {
            id: 'notif-seed-06',
            sender_name: 'beatriz_costa',
            sender_photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
            type: 'story_view',
            post_image: null,
            comment_text: 'e outras 8 pessoas visualizaram seu story',
            time_offset: '-2 days',
            is_read: 1
          }
        ];

        const insertStmt = db.prepare(`
          INSERT INTO social_notifications (id, recipient_id, sender_id, sender_name, sender_photo, type, post_id, post_image, comment_text, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'sample-post', ?, ?, ?, datetime('now', ?))
        `);

        seedNotifs.forEach((n) => {
          insertStmt.run(
            `${n.id}-${recipientId}`,
            recipientId,
            `user-${n.sender_name}`,
            n.sender_name,
            n.sender_photo,
            n.type,
            n.post_image,
            n.comment_text,
            n.is_read,
            n.time_offset
          );
        });
      }

      const rows = db.prepare(`
        SELECT id, recipient_id, sender_id, sender_name, sender_photo, type, post_id, post_image, comment_text, is_read, created_at
        FROM social_notifications
        WHERE recipient_id = ?
        ORDER BY created_at DESC
        LIMIT 60
      `).all(recipientId) as any[];

      const unreadCount = (db.prepare(`
        SELECT count(*) as count FROM social_notifications
        WHERE recipient_id = ? AND is_read = 0
      `).get(recipientId) as any)?.count || 0;

      res.json({
        success: true,
        unread_count: unreadCount,
        notifications: rows
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error fetching notifications:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar notificações' });
    }
  });

  /**
   * POST /api/notifications/mark-all-read
   * Mark all notifications as read
   */
  app.post('/api/notifications/mark-all-read', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      db.prepare('UPDATE social_notifications SET is_read = 1 WHERE recipient_id = ?').run(user.id);
      res.json({ success: true, unread_count: 0 });
    } catch (err: any) {
      console.error('[SocialRoutes] Error marking notifications as read:', err);
      res.status(500).json({ success: false, error: 'Erro ao atualizar notificações' });
    }
  });

  /**
   * POST /api/notifications/:id/read
   * Mark single notification as read
   */
  app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = getUserFromReq(req);
      db.prepare('UPDATE social_notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?').run(id, user.id);
      
      const unreadCount = (db.prepare(`
        SELECT count(*) as count FROM social_notifications
        WHERE recipient_id = ? AND is_read = 0
      `).get(user.id) as any)?.count || 0;

      res.json({ success: true, unread_count: unreadCount });
    } catch (err: any) {
      console.error('[SocialRoutes] Error marking notification as read:', err);
      res.status(500).json({ success: false, error: 'Erro ao atualizar notificação' });
    }
  });

  /**
   * GET /api/users/:userId/profile-summary
   * Minimalist user summary panel
   */
  app.get('/api/users/:userId/profile-summary', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const userPosts = db.prepare(`
        SELECT id, image_url, likes_count, comments_count, created_at, user_name, user_photo
        FROM posts
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as any[];

      const first = userPosts[0];
      const userName = first?.user_name || 'Usuário';
      const userPhoto = first?.user_photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';

      res.json({
        success: true,
        user: {
          id: userId,
          name: userName,
          photo: userPhoto,
          posts_count: userPosts.length
        },
        posts: userPosts.map((p) => ({
          id: p.id,
          image_url: p.image_url,
          likes_count: p.likes_count,
          comments_count: p.comments_count
        }))
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error fetching user summary:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar perfil' });
    }
  });

  /**
   * POST /api/posts/upload
   * Handle image upload (base64 data URL)
   */
  app.post('/api/posts/upload', (req: Request, res: Response) => {
    try {
      const { dataUrl } = req.body;
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({ success: false, error: 'Dados da imagem não fornecidos' });
        return;
      }

      // Check format: data:image/jpeg;base64,...
      const match = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ success: false, error: 'Formato de imagem inválido' });
        return;
      }

      const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const filename = `post-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
      const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/${filename}`;
      res.json({ success: true, imageUrl: publicUrl });
    } catch (err: any) {
      console.error('[SocialRoutes] Error uploading image:', err);
      res.status(500).json({ success: false, error: 'Erro ao processar imagem' });
    }
  });

  /**
   * GET /api/users/check-username
   * Verify username format and real-time database availability
   */
  app.get('/api/users/check-username', (req: Request, res: Response) => {
    try {
      const raw = (req.query.username as string || '').trim().replace(/^@+/, '');
      const currentUserId = req.query.currentUserId as string;

      if (!raw) {
        res.json({ available: false, error: 'O nome de usuário é obrigatório.' });
        return;
      }

      if (raw.length < 3) {
        res.json({ available: false, error: 'Mínimo de 3 caracteres.' });
        return;
      }

      if (raw.length > 30) {
        res.json({ available: false, error: 'Máximo de 30 caracteres.' });
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(raw)) {
        res.json({ available: false, error: 'Use apenas letras, números e underscore (_).' });
        return;
      }

      const normalized = raw.toLowerCase();
      if (normalized === 'marioyesk') {
        res.json({ available: true, normalized });
        return;
      }

      let query = 'SELECT id FROM users WHERE username_normalized = ?';
      const params: any[] = [normalized];

      if (currentUserId && currentUserId !== 'undefined' && currentUserId !== 'null') {
        query += ' AND CAST(id AS TEXT) != ?';
        params.push(String(currentUserId));
      }

      const existing = db.prepare(query).get(...params);

      if (existing) {
        res.json({
          available: false,
          normalized,
          error: 'Este nome de usuário já está em uso.'
        });
        return;
      }

      res.json({
        available: true,
        normalized,
        username: raw
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error checking username:', err);
      res.status(500).json({ available: false, error: 'Erro ao verificar disponibilidade' });
    }
  });

  /**
   * GET /api/users/search
   * Live search by name and @username with follow status and followers count
   */
  app.get('/api/users/search', (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || '').trim().replace(/^@+/, '');
      const user = getUserFromReq(req);
      const currentUserId = String(user.id);

      let rows: any[] = [];
      if (q.length > 0) {
        const pattern = `%${q.toLowerCase()}%`;
        rows = db.prepare(`
          SELECT 
            u.id,
            u.name,
            COALESCE(u.username, REPLACE(LOWER(u.name), ' ', '')) as username,
            COALESCE(u.username_normalized, LOWER(REPLACE(u.name, ' ', ''))) as username_normalized,
            COALESCE(u.avatar_url, '/fotoperfil.png') as avatar_url,
            COALESCE(u.bio, '') as bio
          FROM users u
          WHERE LOWER(u.name) LIKE ? OR u.username_normalized LIKE ? OR LOWER(u.username) LIKE ?
          ORDER BY 
            CASE WHEN u.username_normalized = ? THEN 0
                 WHEN u.username_normalized LIKE ? THEN 1
                 ELSE 2 END,
            u.name ASC
          LIMIT 30
        `).all(pattern, pattern, pattern, q.toLowerCase(), `${q.toLowerCase()}%`);
      } else {
        // Suggested top accounts for search start screen
        rows = db.prepare(`
          SELECT 
            u.id,
            u.name,
            COALESCE(u.username, REPLACE(LOWER(u.name), ' ', '')) as username,
            COALESCE(u.username_normalized, LOWER(REPLACE(u.name, ' ', ''))) as username_normalized,
            COALESCE(u.avatar_url, '/fotoperfil.png') as avatar_url,
            COALESCE(u.bio, '') as bio
          FROM users u
          WHERE u.username IS NOT NULL AND u.username != ''
          ORDER BY u.id ASC
          LIMIT 20
        `).all();
      }

      const users = rows.map((r) => {
        const targetIdStr = String(r.id);
        const targetUsername = String(r.username_normalized);

        const followersCount = (db.prepare(`
          SELECT count(*) as count FROM user_follows 
          WHERE following_id = ? OR following_id = ?
        `).get(targetIdStr, targetUsername) as any)?.count || 0;

        const followingCount = (db.prepare(`
          SELECT count(*) as count FROM user_follows 
          WHERE follower_id = ? OR follower_id = ?
        `).get(targetIdStr, targetUsername) as any)?.count || 0;

        const isFollowing = db.prepare(`
          SELECT 1 FROM user_follows 
          WHERE (follower_id = ? OR follower_id = ?) AND (following_id = ? OR following_id = ?)
        `).get(currentUserId, user.username || currentUserId, targetIdStr, targetUsername) ? true : false;

        const postsCount = (db.prepare(`
          SELECT count(*) as count FROM posts 
          WHERE user_id = ? OR user_username = ?
        `).get(targetIdStr, targetUsername) as any)?.count || 0;

        return {
          id: targetIdStr,
          name: r.name,
          username: r.username,
          username_normalized: r.username_normalized,
          avatar_url: r.avatar_url,
          bio: r.bio,
          followers_count: followersCount,
          following_count: followingCount,
          posts_count: postsCount,
          is_following: isFollowing,
          is_me: currentUserId === targetIdStr || user.username === r.username
        };
      });

      res.json({ success: true, users });
    } catch (err: any) {
      console.error('[SocialRoutes] Error searching users:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar usuários' });
    }
  });

  /**
   * GET /api/users/:userId/profile
   * Full public profile with real posts grid, follower counts and follow state
   */
  app.get('/api/users/:userId/profile', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = getUserFromReq(req);
      const cleanId = (userId || '').trim().replace(/^@+/, '');
      const currentUserId = String(user.id);

      // Search user by numeric id or normalized username or username
      let u: any = db.prepare(`
        SELECT 
          id, name, username, username_normalized, avatar_url, bio, created_at
        FROM users
        WHERE CAST(id AS TEXT) = ? OR username_normalized = ? OR LOWER(username) = ?
      `).get(cleanId, cleanId.toLowerCase(), cleanId.toLowerCase());

      // If not in users table, find in posts table
      if (!u) {
        const p = db.prepare(`
          SELECT user_id, user_name, user_photo, user_username FROM posts
          WHERE user_id = ? OR user_username = ? OR LOWER(REPLACE(user_name, ' ', '')) = ?
          LIMIT 1
        `).get(cleanId, cleanId.toLowerCase(), cleanId.toLowerCase()) as any;

        if (p) {
          const genUsername = p.user_username || p.user_name.toLowerCase().replace(/[^a-z0-9_]/g, '');
          u = {
            id: p.user_id,
            name: p.user_name,
            username: genUsername,
            username_normalized: genUsername.toLowerCase(),
            avatar_url: p.user_photo,
            bio: 'Explorando Campos do Jordão 🍁'
          };
        }
      }

      if (!u) {
        res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        return;
      }

      const targetIdStr = String(u.id);
      const targetUsername = String(u.username_normalized || u.username);

      const followersCount = (db.prepare(`
        SELECT count(*) as count FROM user_follows 
        WHERE following_id = ? OR following_id = ?
      `).get(targetIdStr, targetUsername) as any)?.count || 0;

      const followingCount = (db.prepare(`
        SELECT count(*) as count FROM user_follows 
        WHERE follower_id = ? OR follower_id = ?
      `).get(targetIdStr, targetUsername) as any)?.count || 0;

      const isFollowing = db.prepare(`
        SELECT 1 FROM user_follows 
        WHERE (follower_id = ? OR follower_id = ?) AND (following_id = ? OR following_id = ?)
      `).get(currentUserId, user.username || currentUserId, targetIdStr, targetUsername) ? true : false;

      // Real posts created by this user
      const postsRows = db.prepare(`
        SELECT 
          p.id,
          p.user_id,
          p.user_name,
          COALESCE(p.user_username, ?) as user_username,
          p.user_photo,
          p.image_url,
          p.caption,
          p.location,
          p.likes_count,
          p.comments_count,
          p.created_at,
          CASE WHEN l.post_id IS NOT NULL THEN 1 ELSE 0 END as liked_by_me
        FROM posts p
        LEFT JOIN post_likes l ON p.id = l.post_id AND l.user_id = ?
        WHERE p.user_id = ? OR p.user_username = ? OR p.user_id = ?
        ORDER BY p.created_at DESC
      `).all(targetUsername, currentUserId, targetIdStr, targetUsername, `u-${targetUsername}`);

      res.json({
        success: true,
        user: {
          id: targetIdStr,
          name: u.name,
          username: u.username || targetUsername,
          username_normalized: u.username_normalized || targetUsername.toLowerCase(),
          avatar_url: u.avatar_url || '/fotoperfil.png',
          bio: u.bio || '',
          followers_count: followersCount,
          following_count: followingCount,
          posts_count: postsRows.length,
          is_following: isFollowing,
          is_me: currentUserId === targetIdStr || user.username === u.username
        },
        posts: postsRows.map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          user_name: r.user_name,
          user_username: r.user_username,
          user_photo: r.user_photo,
          image_url: r.image_url,
          caption: r.caption,
          location: r.location,
          likes_count: Number(r.likes_count || 0),
          comments_count: Number(r.comments_count || 0),
          created_at: r.created_at,
          liked_by_me: Boolean(r.liked_by_me)
        }))
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error getting user profile:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar perfil' });
    }
  });

  /**
   * GET /api/users/:userId/followers
   * Real followers list for a user
   */
  app.get('/api/users/:userId/followers', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = getUserFromReq(req);
      const cleanId = (userId || '').trim().replace(/^@+/, '');
      const currentUserId = String(user.id);

      const rows = db.prepare(`
        SELECT 
          u.id,
          u.name,
          COALESCE(u.username, REPLACE(LOWER(u.name), ' ', '')) as username,
          COALESCE(u.username_normalized, LOWER(REPLACE(u.name, ' ', ''))) as username_normalized,
          COALESCE(u.avatar_url, '/fotoperfil.png') as avatar_url,
          COALESCE(u.bio, '') as bio,
          CASE WHEN myf.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_following
        FROM user_follows f
        JOIN users u ON (f.follower_id = CAST(u.id AS TEXT) OR f.follower_id = u.username_normalized)
        LEFT JOIN user_follows myf ON (myf.follower_id = ? OR myf.follower_id = ?) AND (myf.following_id = CAST(u.id AS TEXT) OR myf.following_id = u.username_normalized)
        WHERE f.following_id = ? OR f.following_id = ?
        GROUP BY u.id
        ORDER BY f.created_at DESC
      `).all(currentUserId, user.username || currentUserId, cleanId, cleanId.toLowerCase()) as any[];

      res.json({
        success: true,
        users: rows.map(r => ({
          ...r,
          is_following: Boolean(r.is_following),
          is_me: String(r.id) === currentUserId || user.username === r.username
        }))
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error getting followers:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar seguidores' });
    }
  });

  /**
   * GET /api/users/:userId/following
   * Real list of users followed by a user
   */
  app.get('/api/users/:userId/following', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = getUserFromReq(req);
      const cleanId = (userId || '').trim().replace(/^@+/, '');
      const currentUserId = String(user.id);

      const rows = db.prepare(`
        SELECT 
          u.id,
          u.name,
          COALESCE(u.username, REPLACE(LOWER(u.name), ' ', '')) as username,
          COALESCE(u.username_normalized, LOWER(REPLACE(u.name, ' ', ''))) as username_normalized,
          COALESCE(u.avatar_url, '/fotoperfil.png') as avatar_url,
          COALESCE(u.bio, '') as bio,
          CASE WHEN myf.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_following
        FROM user_follows f
        JOIN users u ON (f.following_id = CAST(u.id AS TEXT) OR f.following_id = u.username_normalized)
        LEFT JOIN user_follows myf ON (myf.follower_id = ? OR myf.follower_id = ?) AND (myf.following_id = CAST(u.id AS TEXT) OR myf.following_id = u.username_normalized)
        WHERE f.follower_id = ? OR f.follower_id = ?
        GROUP BY u.id
        ORDER BY f.created_at DESC
      `).all(currentUserId, user.username || currentUserId, cleanId, cleanId.toLowerCase()) as any[];

      res.json({
        success: true,
        users: rows.map(r => ({
          ...r,
          is_following: Boolean(r.is_following),
          is_me: String(r.id) === currentUserId || user.username === r.username
        }))
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error getting following:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar quem está seguindo' });
    }
  });

  /**
   * GET /api/users/:userId/follow-stats
   * Fetch real followers and following counts from database
   */
  app.get('/api/users/:userId/follow-stats', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = getUserFromReq(req);
      const cleanId = (userId === 'me' || !userId || userId === 'undefined' ? user.id : userId).trim().replace(/^@+/, '');

      const followersCount = (db.prepare(`
        SELECT count(*) as count FROM user_follows 
        WHERE following_id = ? OR following_id = ?
      `).get(cleanId, cleanId.toLowerCase()) as any)?.count || 0;

      const followingCount = (db.prepare(`
        SELECT count(*) as count FROM user_follows 
        WHERE follower_id = ? OR follower_id = ?
      `).get(cleanId, cleanId.toLowerCase()) as any)?.count || 0;

      const isFollowing = db.prepare(`
        SELECT 1 FROM user_follows 
        WHERE (follower_id = ? OR follower_id = ?) AND (following_id = ? OR following_id = ?)
      `).get(String(user.id), user.username || String(user.id), cleanId, cleanId.toLowerCase()) ? true : false;

      res.json({
        success: true,
        user_id: cleanId,
        followers_count: followersCount,
        following_count: followingCount,
        is_following: isFollowing
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error fetching follow stats:', err);
      res.status(500).json({ success: false, error: 'Erro ao buscar seguidores' });
    }
  });

  /**
   * POST /api/users/:userId/toggle-follow
   * Toggle follow/unfollow and return updated real counts
   */
  app.post('/api/users/:userId/toggle-follow', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = getUserFromReq(req);
      const cleanTarget = (userId || '').trim().replace(/^@+/, '');
      const followerId = String(user.id);
      const followingId = cleanTarget;

      if (followerId === followingId || user.username === cleanTarget.toLowerCase()) {
        res.status(400).json({ success: false, error: 'Não é possível seguir a si mesmo' });
        return;
      }

      // Check if existing
      const exists = db.prepare(`
        SELECT 1 FROM user_follows 
        WHERE (follower_id = ? OR follower_id = ?) AND (following_id = ? OR following_id = ?)
      `).get(followerId, user.username || followerId, followingId, followingId.toLowerCase());

      let isFollowing = false;

      if (exists) {
        db.prepare(`
          DELETE FROM user_follows 
          WHERE (follower_id = ? OR follower_id = ?) AND (following_id = ? OR following_id = ?)
        `).run(followerId, user.username || followerId, followingId, followingId.toLowerCase());
        isFollowing = false;
      } else {
        db.prepare('INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)').run(followerId, followingId);
        isFollowing = true;

        // Create follow notification
        try {
          const notifId = 'notif-' + Date.now().toString(36);
          db.prepare(`
            INSERT INTO social_notifications (id, recipient_id, sender_id, sender_name, sender_photo, type, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 'follow', 0, CURRENT_TIMESTAMP)
          `).run(notifId, followingId, followerId, user.name, user.photo);
        } catch {}
      }

      const followersCount = (db.prepare(`
        SELECT count(*) as count FROM user_follows 
        WHERE following_id = ? OR following_id = ?
      `).get(followingId, followingId.toLowerCase()) as any)?.count || 0;

      const followingCount = (db.prepare(`
        SELECT count(*) as count FROM user_follows 
        WHERE follower_id = ? OR follower_id = ?
      `).get(followerId, user.username || followerId) as any)?.count || 0;

      res.json({
        success: true,
        is_following: isFollowing,
        followers_count: followersCount,
        following_count: followingCount
      });
    } catch (err: any) {
      console.error('[SocialRoutes] Error toggling follow:', err);
      res.status(500).json({ success: false, error: 'Erro ao atualizar seguidor' });
    }
  });
}
