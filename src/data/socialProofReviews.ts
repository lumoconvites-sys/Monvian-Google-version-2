import camilaAvatar from '../assets/images/avatar_camila_ferreira_1794521529330.jpg';
import rafaelAvatar from '../assets/images/avatar_rafael_duarte_1794521529696.jpg';
import julianaAvatar from '../assets/images/avatar_juliana_martins_1794521527651.jpg';
import brunoAvatar from '../assets/images/avatar_bruno_cavalcanti_1794521530381.jpg';
import beatrizAvatar from '../assets/images/avatar_beatriz_nogueira_1794521528568.jpg';
import lucasAvatar from '../assets/images/avatar_lucas_andrade_1794521530454.jpg';
import marianaAvatar from '../assets/images/avatar_mariana_lopes_1794521531118.jpg';
import thiagoAvatar from '../assets/images/avatar_thiago_moreira_1794521531836.jpg';
import larissaAvatar from '../assets/images/avatar_larissa_azevedo_1794521532265.jpg';
import gustavoAvatar from '../assets/images/avatar_gustavo_ribeiro_1794521530887.jpg';
import fernandaAvatar from '../assets/images/avatar_fernanda_costa_1794521533203.jpg';
import matheusAvatar from '../assets/images/avatar_matheus_almeida_1794521532705.jpg';
import patriciaAvatar from '../assets/images/avatar_patricia_mendes_1794521533245.jpg';
import rodrigoAvatar from '../assets/images/avatar_rodrigo_santana_1794521534077.jpg';

export interface SocialProofReview {
  id: string;
  authorName: string;
  avatarSrc: string;
  rating: 5;
  comment: string;
  /** Identifica internamente se o registro é demonstrativo ou real vindo de base futura */
  sourceType: 'demo_placeholder' | 'authentic_user';
}

/**
 * Conteúdo demonstrativo interno (14 avaliações ilustrativas para pré-visualização visual).
 * Não representa depoimentos reais verificados de clientes.
 * A estrutura está desacoplada para substituição direta por avaliações autênticas via API/Firestore.
 */
export const DEMO_SOCIAL_PROOF_REVIEWS: readonly SocialProofReview[] = [
  // Faixa 1 (5 avaliações)
  {
    id: 'demo-review-01',
    authorName: 'Camila Ferreira',
    avatarSrc: camilaAvatar,
    rating: 5,
    comment:
      'A gente achou uma cafeteria escondida na Vila Abernéssia pelo mapa que nem aparecia direito nas buscas. Mudou nossa tarde de frio.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-02',
    authorName: 'Rafael Duarte',
    avatarSrc: rafaelAvatar,
    rating: 5,
    comment:
      'Fui sem planejamento nenhum pra Campos do Jordão e segui um roteiro pronto. Deu pra aproveitar tudo sem ficar rodando à toa.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-03',
    authorName: 'Juliana Martins',
    avatarSrc: julianaAvatar,
    rating: 5,
    comment:
      'O que mais gostei foi ver os restaurantes mais pertinho de onde a gente tava andando. Salvou demais na hora que bateu a fome.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-04',
    authorName: 'Bruno Cavalcanti',
    avatarSrc: brunoAvatar,
    rating: 5,
    comment:
      'Minha namorada achou o Monvian bem fácil de mexer, até no carro ela ia olhando as próximas paradas do nosso passeio.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-05',
    authorName: 'Beatriz Nogueira',
    avatarSrc: beatrizAvatar,
    rating: 5,
    comment:
      'Descobri um mirante bem tranquilo fora do movimento do Capivari. Nunca ia saber que existia se não tivesse olhado por aqui.',
    sourceType: 'demo_placeholder',
  },

  // Faixa 2 (5 avaliações)
  {
    id: 'demo-review-06',
    authorName: 'Lucas Andrade',
    avatarSrc: lucasAvatar,
    rating: 5,
    comment:
      'Organizei o fim de semana inteiro em uns dez minutos antes de subir a serra. Bem direto ao ponto, sem enrolação.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-07',
    authorName: 'Mariana Lopes',
    avatarSrc: marianaAvatar,
    rating: 5,
    comment:
      'Gostei muito das dicas de lugar pra tomar chocolate quente sem pegar fila enorme. Fui em dois que viraram meus favoritos.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-08',
    authorName: 'Thiago Moreira',
    avatarSrc: thiagoAvatar,
    rating: 5,
    comment:
      'Viajei com meus pais e ajudou demais a escolher passeios mais sossegados e tranquilos pra eles irem no ritmo deles.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-09',
    authorName: 'Larissa Azevedo',
    avatarSrc: larissaAvatar,
    rating: 5,
    comment:
      'Super prático pra achar trilha e parque perto do centro. A gente tocava no lugar e já via certinho como chegar.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-10',
    authorName: 'Gustavo Ribeiro',
    avatarSrc: gustavoAvatar,
    rating: 5,
    comment:
      'Já tinha ido pra Campos várias vezes, mas dessa vez conheci umas cantinas e bistrôs que eu nem fazia ideia que existiam.',
    sourceType: 'demo_placeholder',
  },

  // Faixa 3 (4 avaliações)
  {
    id: 'demo-review-11',
    authorName: 'Fernanda Costa',
    avatarSrc: fernandaAvatar,
    rating: 5,
    comment:
      'Sabe quando você abre um aplicativo e já entende tudo de primeira? Foi exatamente assim, zero complicação pra usar.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-12',
    authorName: 'Matheus Almeida',
    avatarSrc: matheusAvatar,
    rating: 5,
    comment:
      'A gente seguiu o roteiro romântico no sábado e encaixou certinho o pôr do sol com o jantar. Ficou redondo o passeio.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-13',
    authorName: 'Patrícia Mendes',
    avatarSrc: patriciaAvatar,
    rating: 5,
    comment:
      'Não precisei ficar salvando mil prints no celular dessa vez, deixei todos os pontos que queria visitar num lugar só.',
    sourceType: 'demo_placeholder',
  },
  {
    id: 'demo-review-14',
    authorName: 'Rodrigo Santana',
    avatarSrc: rodrigoAvatar,
    rating: 5,
    comment:
      'Achei muito bom porque mostra desde os clássicos de Capivari até uns cantinhos mais escondidos no meio das araucárias.',
    sourceType: 'demo_placeholder',
  },
];

/**
 * Distribui as avaliações entre 3 faixas independentes sem repetir itens da lista original.
 */
export function distributeReviewsIntoThreeTracks(
  reviews: readonly SocialProofReview[]
): [SocialProofReview[], SocialProofReview[], SocialProofReview[]] {
  const track1: SocialProofReview[] = [];
  const track2: SocialProofReview[] = [];
  const track3: SocialProofReview[] = [];

  if (reviews.length === 14) {
    return [
      reviews.slice(0, 5),
      reviews.slice(5, 10),
      reviews.slice(10, 14),
    ];
  }

  reviews.forEach((review, index) => {
    const bucket = index % 3;
    if (bucket === 0) track1.push(review);
    else if (bucket === 1) track2.push(review);
    else track3.push(review);
  });

  return [track1, track2, track3];
}
