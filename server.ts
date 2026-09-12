import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

// Lazy initialize Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

const SYSTEM_INSTRUCTION = `Você é a guia turística virtual oficial de Campos do Jordão (na Serra da Mantiqueira, SP).
Sua personalidade é calorosa, acolhedora, animada, conhecedora profunda da serra, do clima frio, da gastronomia (fondue, truta, cervejas artesanais, chocolate quente) e de todos os passeios imperdíveis.
Você conversa em português de forma natural, charmosa e direta, dando recomendações práticas com preços estimados, melhor horário para fotos, dicas de agasalho e dicas locais que turistas comuns não conhecem.

Pontos turísticos principais de Campos do Jordão que você conhece a fundo:
- Parque Amantikir (Jardins temáticos, labirinto verde, excelente para fotos, R$ 60-80)
- Pico do Itapeva (Mirante a mais de 2.030m com vista de 15 cidades e campo de lavandas)
- Vila Capivari (Coração turístico, centrinho europeu, chocolaterias, Baden Baden, movimento noturno)
- Cervejaria Baden Baden (Chopp artesanal famoso, pratos alemães, no Capivari)
- Horto Florestal / Parque Estadual (Trilhas, ar puro, araucárias centenárias, tirolesa e piquenique)
- Palácio Boa Vista (Residência oficial de inverno do governador, rico acervo de arte de Tarsila e Di Cavalcanti)
- Ducha de Prata (Quedas d'água artificiais com passarelas de madeira e lojinhas de artesanato e malhas)
- Morro do Elefante & Teleférico (Vista panorâmica do Capivari, trenó de montanha e parque temático)
- Tarundu (Mais de 25 atrações ao ar livre: tirolesa, patinação no gelo, passeios a cavalo, perfeito para crianças e famílias)
- Pastelão do Maluf (Pastéis gigantes de 32cm recheadíssimos, ótimo custo-benefício)

Seja prestativa, use formatação limpa com tópicos quando fizer roteiros ou listas. Seja amigável e encorajadora.`;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // AI Chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mensagem inválida' });
        return;
      }

      const ai = getGenAI();

      if (ai) {
        try {
          // Build conversation messages
          const contents: any[] = [];

          if (Array.isArray(history) && history.length > 0) {
            for (const item of history.slice(-6)) {
              contents.push({
                role: item.sender === 'user' ? 'user' : 'model',
                parts: [{ text: item.text }],
              });
            }
          }

          contents.push({
            role: 'user',
            parts: [{ text: message }],
          });

          const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.7,
              maxOutputTokens: 900,
            },
          });

          const reply = response.text || 'Adorei sua pergunta! Campos do Jordão tem opções maravilhosas para isso.';
          res.json({ reply });
          return;
        } catch (genErr) {
          console.warn('Gemini API call failed, switching to curated guide responses:', genErr);
          // Proceed to curated fallback below
        }
      }

      // Fallback local smart response if Gemini API Key is unavailable or experiencing temporary high demand
      let reply = '';
      const lower = message.toLowerCase();

      if (lower.includes('romântico') || lower.includes('romantico') || lower.includes('casal') || lower.includes('2 dias')) {
        reply = `🌹 **Roteiro Romântico Perfeito (2 Dias)**:

**Dia 1:**
- **Manhã:** Passeio a dois no **Parque Amantikir** pelos jardins floridos e o labirinto.
- **Tarde:** Pôr do sol inesquecível no **Pico do Itapeva**, tomando um chocolate quente com vista das montanhas.
- **Noite:** Jantar à luz de velas com sequência tradicional de Fondue (queijo, carne e chocolate) em uma casa acolhedora na **Vila Capivari**.

**Dia 2:**
- **Manhã:** Visita cultural ao **Palácio Boa Vista** e café nos jardins.
- **Tarde:** Caminhada de mãos dadas pelas ruelas charmosas de Capivari e degustação de chocolates artesanais Araucária.
- **Final de tarde:** Passeio no teleférico e mirante do Morro do Elefante.`;
      } else if (lower.includes('café') || lower.includes('cafe') || lower.includes('capivari') || lower.includes('chocolate')) {
        reply = `☕ **Melhores Cafés & Chocolaterias em Capivari**:

1. **Chocolate Araucária**: O chocolate mais tradicional da serra. Peça o chocolate quente cremoso com borda de avelã!
2. **Café do Palácio**: Ambiente elegante com mesinhas ao ar livre e tortas alemãs deliciosas.
3. **Sans Souci Café**: Famoso pela decoração provençal charmosa, perfeito para fotos e croissants quentinhos.
4. **Bruno Alves Chocolatier**: Destaque para os bombons artesanais e waffles belgas com calda de chocolate puro.`;
      } else if (lower.includes('família') || lower.includes('familia') || lower.includes('criança') || lower.includes('criancas') || lower.includes('infantil')) {
        reply = `👨‍👩‍👧‍👦 **Passeios Ideais para Família & Crianças**:

1. **Tarundu**: O paraíso dos pequenos! Tem tirolesa gigante, patinação no gelo, passeios a cavalo, tiro com arco e bóia cross.
2. **Parque da Lagoinha**: Tranquilo, plano para carrinhos de bebê, lago com patos e casinhas de esquilo.
3. **Teleférico & Trenó do Morro do Elefante**: Uma aventura divertida com vista panorâmica da cidade.
4. **Horto Florestal**: Ótimo para piquenique sob as araucárias, trilhas leves e contato puro com a natureza.`;
      } else if (lower.includes('150') || lower.includes('jantar') || lower.includes('comer') || lower.includes('barato') || lower.includes('econômico') || lower.includes('economico')) {
        reply = `🍽️ **Onde Comer Muito Bem por até R$ 150/pessoa**:

1. **Pastelão do Maluf (Capivari)**: Pastéis gigantescos de 32cm muito bem recheados (R$ 45 a R$ 65 cada, servem muito bem).
2. **Trattoria Salvador**: Massas caseiras italianas e risotos fartos com custo-benefício excelente.
3. **Gato Gordo**: Restaurante rústico escondido no caminho do Horto, com pizzas de massa crocante e forno a lenha.
4. **Festival de Sopas no Pão**: Em noites frias de Capivari, várias bistrôs servem cremes e caldos no pão italiano por cerca de R$ 60 a R$ 80.`;
      } else {
        reply = `✨ Olá! Que prazer te ajudar a explorar Campos do Jordão!

Nossa serra está linda com clima perfeito. Você pode me pedir roteiros personalizados, dicas de gastronomia (fondue, trutas, chocolates), mirantes para ver o pôr do sol ou passeios de aventura!

Qual o estilo da sua viagem hoje?`;
      }

      res.json({ reply });
    } catch (error: any) {
      console.error('Erro na rota /api/chat:', error);
      res.status(500).json({
        error: 'Não foi possível processar a resposta.',
        reply: 'Tive um pequeno contratempo, mas estou pronta para te ajudar! Pergunte sobre pontos turísticos, restaurantes ou roteiros em Campos do Jordão.',
      });
    }
  });

  // Vite middleware in dev, static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
