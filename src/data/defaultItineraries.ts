import { Itinerary } from '../types';

export const DEFAULT_CURATED_ITINERARIES: Itinerary[] = [
  {
    id: 'roteiro-classico-2-dias',
    title: 'Essência de Campos: O Clássico em 2 Dias',
    description: 'O roteiro perfeito para a primeira visita a Campos do Jordão, reunindo os pontos turísticos mais emblemáticos, gastronomia suíça e mirantes deslumbrantes.',
    coverImage: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
    daysCount: 2,
    categories: ['nature', 'gastronomy', 'sweets', 'sunset', 'culture'],
    isActive: true,
    isRecommended: true,
    isFeatured: true,
    isPremium: true,
    price: 'R$ 0',
    status: 'published',
    badgeText: 'Livre',
    showBadge: true,
    showPrice: true,
    showStopsCount: true,
    tips: 'Recomendamos iniciar os passeios pela manhã para aproveitar a melhor iluminação e evitar filas na Vila Capivari à noite.',
    sortOrder: 1,
    usageCount: 384,
    days: [
      {
        id: 'roteiro-classico-2-dias-dia-1',
        itineraryId: 'roteiro-classico-2-dias',
        dayNumber: 1,
        title: 'Dia 1: Jardins Floridos & Charme de Capivari',
        summary: 'Manhã contemplativa entre labirintos floridos, tarde no centro turístico e noite com fondue tradicional.',
        steps: [
          {
            id: 'roteiro-classico-2-dias-dia-1-1',
            itineraryId: 'roteiro-classico-2-dias',
            dayId: 'roteiro-classico-2-dias-dia-1',
            dayNumber: 1,
            spotId: 'parque-amantikir',
            stepOrder: 1,
            suggestedTime: '09:30',
            durationMinutes: 120,
            notes: 'Caminhe pelo labirinto de arbustos e aproveite a luz da manhã nos mirantes.',
            customName: 'Parque amantikir',
            customDescription: 'Caminhe pelo labirinto de arbustos e aproveite a luz da manhã nos mirantes.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'parque-amantikir',
              name: 'Parque amantikir',
              category: 'parks',
              categoryLabel: 'Atração / Turístico',
              lat: -22.7594,
              lng: -45.6267,
              image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
              description: 'Mais de 26 jardins temáticos do mundo e o famoso labirinto verde.'
            }
          },
          {
            id: 'roteiro-classico-2-dias-dia-1-2',
            itineraryId: 'roteiro-classico-2-dias',
            dayId: 'roteiro-classico-2-dias-dia-1',
            dayNumber: 1,
            spotId: 'parque-capivari',
            stepOrder: 2,
            suggestedTime: '13:00',
            durationMinutes: 90,
            notes: 'Passeio pelo Parque Capivari, teleférico e lago central.',
            customName: 'PARQUE CAPIVARI',
            customDescription: 'Passeio pelo Parque Capivari, teleférico e lago central.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'parque-capivari',
              name: 'PARQUE CAPIVARI',
              category: 'parks',
              categoryLabel: 'Atração / Turístico',
              lat: -22.7303,
              lng: -45.5898,
              image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
              description: 'Coração turístico com teleférico, pedalinhos e roda gigante.'
            }
          },
          {
            id: 'roteiro-classico-2-dias-dia-1-3',
            itineraryId: 'roteiro-classico-2-dias',
            dayId: 'roteiro-classico-2-dias-dia-1',
            dayNumber: 1,
            spotId: 'baden-baden',
            stepOrder: 3,
            suggestedTime: '15:30',
            durationMinutes: 60,
            notes: 'Almoço no coração do Capivari com pratos alemães e chopes artesanais.',
            customName: 'Baden Baden',
            customDescription: 'Almoço no coração do Capivari com pratos alemães e chopes artesanais.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'baden-baden',
              name: 'Baden Baden',
              category: 'gastronomy',
              categoryLabel: 'Restaurante / Gastronomia',
              lat: -22.7335,
              lng: -45.5921,
              image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
              description: 'Cervejaria clássica com culinária alemã e ambiente acolhedor.'
            }
          }
        ]
      },
      {
        id: 'roteiro-classico-2-dias-dia-2',
        itineraryId: 'roteiro-classico-2-dias',
        dayNumber: 2,
        title: 'Dia 2: Mirantes, Ducha de Prata & Cerejeiras',
        summary: 'Visita panorâmica no Morro do Elefante, cachoeiras na Ducha de Prata e bosques floridos.',
        steps: [
          {
            id: 'roteiro-classico-2-dias-dia-2-1',
            itineraryId: 'roteiro-classico-2-dias',
            dayId: 'roteiro-classico-2-dias-dia-2',
            dayNumber: 2,
            spotId: 'morro-do-elefante',
            stepOrder: 1,
            suggestedTime: '10:00',
            durationMinutes: 90,
            notes: 'Vista panorâmica espetacular da cidade a partir do alto do Morro do Elefante.',
            customName: 'Morro do Elefante',
            customDescription: 'Vista panorâmica espetacular da cidade a partir do alto do Morro do Elefante.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'morro-do-elefante',
              name: 'Morro do Elefante',
              category: 'viewpoint',
              categoryLabel: 'Mirante / Panorâmico',
              lat: -22.7236,
              lng: -45.5847,
              image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
              description: 'Mirante a 1.800 metros de altitude com vista para todo o vale.'
            }
          },
          {
            id: 'roteiro-classico-2-dias-dia-2-2',
            itineraryId: 'roteiro-classico-2-dias',
            dayId: 'roteiro-classico-2-dias-dia-2',
            dayNumber: 2,
            spotId: 'ducha-de-prata',
            stepOrder: 2,
            suggestedTime: '14:30',
            durationMinutes: 90,
            notes: 'Cachoeiras refrescantes, pontes de madeira e feirinha tradicional.',
            customName: 'Ducha de Prata',
            customDescription: 'Cachoeiras refrescantes, pontes de madeira e feirinha tradicional.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'ducha-de-prata',
              name: 'Ducha de Prata',
              category: 'nature',
              categoryLabel: 'Natureza / Quedas',
              lat: -22.7389,
              lng: -45.5724,
              image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
              description: 'Quedas artificiais canalizadas com pontes de madeira e artesanato.'
            }
          },
          {
            id: 'roteiro-classico-2-dias-dia-2-3',
            itineraryId: 'roteiro-classico-2-dias',
            dayId: 'roteiro-classico-2-dias-dia-2',
            dayNumber: 2,
            spotId: 'parque-das-cerejeiras',
            stepOrder: 3,
            suggestedTime: '17:00',
            durationMinutes: 90,
            notes: 'Bosque relaxante de cerejeiras para contemplar o pôr do sol.',
            customName: 'Parque das Cerejeiras',
            customDescription: 'Bosque relaxante de cerejeiras para contemplar o pôr do sol.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'parque-das-cerejeiras',
              name: 'Parque das Cerejeiras',
              category: 'parks',
              categoryLabel: 'Parque / Natureza',
              lat: -22.7531,
              lng: -45.6025,
              image: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
              description: 'Bosque com centenas de cerejeiras em flor e clima oriental.'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'roteiro-romantico-montanhas',
    title: 'Roteiro Romântico nas Alturas (1 Dia)',
    description: 'Planejado para casais que buscam momentos especiais, cenários encantadores para fotos a dois e alta gastronomia.',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
    daysCount: 1,
    categories: ['romantic', 'sunset', 'culture', 'gastronomy'],
    isActive: true,
    isRecommended: true,
    isFeatured: true,
    isPremium: true,
    price: 'R$ 0',
    status: 'published',
    badgeText: 'Casais',
    showBadge: true,
    showPrice: true,
    showStopsCount: true,
    tips: 'Leve um casaco para o entardecer nas montanhas e reserve o restaurante de fondue com antecedência.',
    sortOrder: 2,
    usageCount: 298,
    days: [
      {
        id: 'roteiro-romantico-montanhas-dia-1',
        itineraryId: 'roteiro-romantico-montanhas',
        dayNumber: 1,
        title: 'Dia 1: Romance & Vista Panorâmica',
        summary: 'Passeio a dois nos jardins, vista do alto do Morro do Elefante e jantar com fondue.',
        steps: [
          {
            id: 'roteiro-romantico-montanhas-dia-1-1',
            itineraryId: 'roteiro-romantico-montanhas',
            dayId: 'roteiro-romantico-montanhas-dia-1',
            dayNumber: 1,
            spotId: 'parque-amantikir',
            stepOrder: 1,
            suggestedTime: '10:00',
            durationMinutes: 120,
            notes: 'Passeio a dois pelos labirintos e jardins botânicos.',
            customName: 'Parque amantikir',
            customDescription: 'Passeio a dois pelos labirintos e jardins botânicos.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'parque-amantikir',
              name: 'Parque amantikir',
              category: 'parks',
              categoryLabel: 'Atração / Turístico',
              lat: -22.7594,
              lng: -45.6267,
              image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
              description: 'Mais de 26 jardins temáticos do mundo e o famoso labirinto verde.'
            }
          },
          {
            id: 'roteiro-romantico-montanhas-dia-1-2',
            itineraryId: 'roteiro-romantico-montanhas',
            dayId: 'roteiro-romantico-montanhas-dia-1',
            dayNumber: 1,
            spotId: 'morro-do-elefante',
            stepOrder: 2,
            suggestedTime: '14:30',
            durationMinutes: 90,
            notes: 'Vista do teleférico e mirante do Morro do Elefante.',
            customName: 'Morro do Elefante',
            customDescription: 'Vista do teleférico e mirante do Morro do Elefante.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'morro-do-elefante',
              name: 'Morro do Elefante',
              category: 'viewpoint',
              categoryLabel: 'Mirante / Panorâmico',
              lat: -22.7236,
              lng: -45.5847,
              image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
              description: 'Mirante a 1.800 metros de altitude com vista para todo o vale.'
            }
          },
          {
            id: 'roteiro-romantico-montanhas-dia-1-3',
            itineraryId: 'roteiro-romantico-montanhas',
            dayId: 'roteiro-romantico-montanhas-dia-1',
            dayNumber: 1,
            spotId: 'baden-baden',
            stepOrder: 3,
            suggestedTime: '19:00',
            durationMinutes: 120,
            notes: 'Jantar romântico com fondue suíço e vinho nas lareiras do Capivari.',
            customName: 'Baden Baden',
            customDescription: 'Jantar romântico com fondue suíço e vinho nas lareiras do Capivari.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'baden-baden',
              name: 'Baden Baden',
              category: 'gastronomy',
              categoryLabel: 'Restaurante / Gastronomia',
              lat: -22.7335,
              lng: -45.5921,
              image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
              description: 'Cervejaria clássica com culinária alemã e ambiente acolhedor.'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'roteiro-natureza-aventura',
    title: 'Ecoturismo & Aventura na Serra',
    description: 'Para quem ama trilhas, tirolesas, arborismo e contato direto com a natureza preservada da Serra da Mantiqueira.',
    coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
    daysCount: 1,
    categories: ['nature', 'adventure', 'parks', 'ecoturismo'],
    isActive: true,
    isRecommended: true,
    isFeatured: true,
    isPremium: true,
    price: 'R$ 0',
    status: 'published',
    badgeText: 'Aventura',
    showBadge: true,
    showPrice: true,
    showStopsCount: true,
    tips: 'Use calçados confortáveis para caminhada e leve protetor solar.',
    sortOrder: 3,
    usageCount: 215,
    days: [
      {
        id: 'roteiro-natureza-aventura-dia-1',
        itineraryId: 'roteiro-natureza-aventura',
        dayNumber: 1,
        title: 'Dia 1: Aventura & Bosques',
        summary: 'Atividades ao ar livre no Tarundu e cachoeiras da Ducha de Prata.',
        steps: [
          {
            id: 'roteiro-natureza-aventura-dia-1-1',
            itineraryId: 'roteiro-natureza-aventura',
            dayId: 'roteiro-natureza-aventura-dia-1',
            dayNumber: 1,
            spotId: 'tarundu',
            stepOrder: 1,
            suggestedTime: '09:00',
            durationMinutes: 180,
            notes: 'Tirolesas, passeios a cavalo e arborismo no Tarundu.',
            customName: 'Tarundu',
            customDescription: 'Tirolesas, passeios a cavalo e arborismo no Tarundu.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'tarundu',
              name: 'Tarundu',
              category: 'parks',
              categoryLabel: 'Aventura / Parques',
              lat: -22.7712,
              lng: -45.6456,
              image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
              description: 'Mais de 25 atrações de aventura em meio a 500 mil m² de mata.'
            }
          },
          {
            id: 'roteiro-natureza-aventura-dia-1-2',
            itineraryId: 'roteiro-natureza-aventura',
            dayId: 'roteiro-natureza-aventura-dia-1',
            dayNumber: 1,
            spotId: 'ducha-de-prata',
            stepOrder: 2,
            suggestedTime: '14:00',
            durationMinutes: 90,
            notes: 'Passeio pelas passarelas da Ducha de Prata.',
            customName: 'Ducha de Prata',
            customDescription: 'Passeio pelas passarelas da Ducha de Prata.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'ducha-de-prata',
              name: 'Ducha de Prata',
              category: 'nature',
              categoryLabel: 'Natureza / Quedas',
              lat: -22.7389,
              lng: -45.5724,
              image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
              description: 'Quedas artificiais canalizadas com pontes de madeira e artesanato.'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'roteiro-gastronomia-chocolates',
    title: 'Tour Gastronômico: Sabores & Chocolates da Serra',
    description: 'Degustação das delícias artesanais de Campos: fondues suíços, chocolates quentes, cervejas premiadas e doces típicos.',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80',
    daysCount: 1,
    categories: ['gastronomy', 'sweets', 'cafes', 'culture'],
    isActive: true,
    isRecommended: true,
    isFeatured: true,
    isPremium: true,
    price: 'R$ 0',
    status: 'published',
    badgeText: 'Gastronômico',
    showBadge: true,
    showPrice: true,
    showStopsCount: true,
    tips: 'Deixe espaço para sobremesas em cada parada e experimente os chocolates artesanais.',
    sortOrder: 4,
    usageCount: 312,
    days: [
      {
        id: 'roteiro-gastronomia-chocolates-dia-1',
        itineraryId: 'roteiro-gastronomia-chocolates',
        dayNumber: 1,
        title: 'Dia 1: Sabores do Capivari',
        summary: 'Passeio gastronômico no centro e cervejarias artesanais.',
        steps: [
          {
            id: 'roteiro-gastronomia-chocolates-dia-1-1',
            itineraryId: 'roteiro-gastronomia-chocolates',
            dayId: 'roteiro-gastronomia-chocolates-dia-1',
            dayNumber: 1,
            spotId: 'baden-baden',
            stepOrder: 1,
            suggestedTime: '12:30',
            durationMinutes: 90,
            notes: 'Almoço clássico com chopes artesanais na Baden Baden.',
            customName: 'Baden Baden',
            customDescription: 'Almoço clássico com chopes artesanais na Baden Baden.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'baden-baden',
              name: 'Baden Baden',
              category: 'gastronomy',
              categoryLabel: 'Restaurante / Gastronomia',
              lat: -22.7335,
              lng: -45.5921,
              image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
              description: 'Cervejaria clássica com culinária alemã e ambiente acolhedor.'
            }
          },
          {
            id: 'roteiro-gastronomia-chocolates-dia-1-2',
            itineraryId: 'roteiro-gastronomia-chocolates',
            dayId: 'roteiro-gastronomia-chocolates-dia-1',
            dayNumber: 1,
            spotId: 'parque-capivari',
            stepOrder: 2,
            suggestedTime: '15:00',
            durationMinutes: 90,
            notes: 'Cafés coloniais e chocolates quentes cremosos no calçadão.',
            customName: 'PARQUE CAPIVARI',
            customDescription: 'Cafés coloniais e chocolates quentes cremosos no calçadão.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'parque-capivari',
              name: 'PARQUE CAPIVARI',
              category: 'parks',
              categoryLabel: 'Atração / Turístico',
              lat: -22.7303,
              lng: -45.5898,
              image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
              description: 'Coração turístico com teleférico, pedalinhos e roda gigante.'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'roteiro-bate-volta-essencial',
    title: 'Bate-e-Volta: O Melhor de Campos em 24h',
    description: 'Roteiro otimizado para quem tem apenas um dia na cidade e deseja vivenciar os pontos imperdíveis sem perder tempo.',
    coverImage: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=80',
    daysCount: 1,
    categories: ['popular', 'culture', 'nature', 'gastronomy'],
    isActive: true,
    isRecommended: true,
    isFeatured: true,
    isPremium: true,
    price: 'R$ 0',
    status: 'published',
    badgeText: '1 Dia',
    showBadge: true,
    showPrice: true,
    showStopsCount: true,
    tips: 'Chegue cedo para aproveitar a luz natural e estacione no centro para caminhar.',
    sortOrder: 5,
    usageCount: 420,
    days: [
      {
        id: 'roteiro-bate-volta-essencial-dia-1',
        itineraryId: 'roteiro-bate-volta-essencial',
        dayNumber: 1,
        title: 'Dia 1: Campos em 1 Dia',
        summary: 'Portal, Capivari e Mirante do Elefante.',
        steps: [
          {
            id: 'roteiro-bate-volta-essencial-dia-1-1',
            itineraryId: 'roteiro-bate-volta-essencial',
            dayId: 'roteiro-bate-volta-essencial-dia-1',
            dayNumber: 1,
            spotId: 'portal-de-campos-do-jordao',
            stepOrder: 1,
            suggestedTime: '08:30',
            durationMinutes: 30,
            notes: 'Foto tradicional de boas-vindas no Portal da Cidade.',
            customName: 'Portal de Campos do Jordão',
            customDescription: 'Foto tradicional de boas-vindas no Portal da Cidade.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'portal-de-campos-do-jordao',
              name: 'Portal de Campos do Jordão',
              category: 'attractions',
              categoryLabel: 'Portal / Cartão Postal',
              lat: -22.7831,
              lng: -45.6312,
              image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
              description: 'Entrada monumental em estilo alpino tradicional.'
            }
          },
          {
            id: 'roteiro-bate-volta-essencial-dia-1-2',
            itineraryId: 'roteiro-bate-volta-essencial',
            dayId: 'roteiro-bate-volta-essencial-dia-1',
            dayNumber: 1,
            spotId: 'parque-capivari',
            stepOrder: 2,
            suggestedTime: '11:00',
            durationMinutes: 120,
            notes: 'Passeio completo pela Vila Capivari e almoço.',
            customName: 'PARQUE CAPIVARI',
            customDescription: 'Passeio completo pela Vila Capivari e almoço.',
            customTip: '',
            customImage: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
            spot: {
              id: 'parque-capivari',
              name: 'PARQUE CAPIVARI',
              category: 'parks',
              categoryLabel: 'Atração / Turístico',
              lat: -22.7303,
              lng: -45.5898,
              image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
              description: 'Coração turístico com teleférico, pedalinhos e roda gigante.'
            }
          }
        ]
      }
    ]
  }
];

export const DEFAULT_ITINERARIES = DEFAULT_CURATED_ITINERARIES;
export type CuratedItinerary = Itinerary;
