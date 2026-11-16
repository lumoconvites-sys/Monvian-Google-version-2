// Comprehensive Portuguese -> English translation dictionary and dynamic pattern engine
// Covers landing page, authentication, map, spots, itineraries, profile, settings,
// social feed, weather, legal notices, and notifications.

const PT_TO_EN_RAW: Record<string, string> = {
  // Navigation & Core Tabs
  'Criar conta': 'Sign up',
  'Criar minha conta': 'Create my account',
  'Entrar': 'Sign in',
  'Entrar →': 'Sign in →',
  'Entrando...': 'Signing in...',
  'Roteiros': 'Itineraries',
  'Explorar': 'Explore',
  'Salvos': 'Saved',
  'Buscar': 'Search',
  'Perfil': 'Profile',
  'Voltar': 'Back',
  'Fechar': 'Close',
  'Salvar': 'Save',
  'Salvar alterações': 'Save changes',
  'Salvando alterações...': 'Saving changes...',
  'Cancelar': 'Cancel',
  'Confirmar': 'Confirm',
  'Confirmando...': 'Confirming...',
  'Continuar': 'Continue',
  'Concluir': 'Done',
  'Concluído': 'Completed',
  'Editar': 'Edit',
  'Excluir': 'Delete',
  'Remover': 'Remove',
  'Adicionar': 'Add',
  'Compartilhar': 'Share',
  'Ligar': 'Call',
  'Site': 'Website',
  'Pular': 'Skip',
  'Limpar': 'Clear',
  'Restaurar': 'Restore',
  'Responder': 'Reply',
  'Publicar': 'Post',
  'Processando...': 'Processing...',
  'Atualizando...': 'Updating...',
  'Enviando...': 'Sending...',
  'Buscando...': 'Searching...',
  'Iniciando...': 'Starting...',
  'Tentar novamente': 'Try again',
  'Entendi': 'Got it',
  'Permanecer': 'Stay',
  'Sim, sair': 'Yes, sign out',
  'Sim, apagar roteiro': 'Yes, delete itinerary',
  'NOVO': 'NEW',
  'OU': 'OR',
  'Hoje': 'Today',
  'Amanhã': 'Tomorrow',
  'Dia': 'Day',
  'Dias': 'Days',
  'Você': 'You',
  'Eu': 'Me',
  'Grátis': 'Free',
  'Opcional': 'Optional',
  'Selecionar': 'Select',
  'Importar': 'Import',
  'Importado!': 'Imported!',
  'Verificado': 'Verified',
  'Acesso rápido e funcionamento otimizado': 'Fast access and optimized performance',

  // Landing Page (CinematicLandingView + Carousels + Social Proof)
  'Campos do Jordão do seu jeito.': 'Campos do Jordão your way.',
  'Descubra, explore e compartilhe os melhores lugares da cidade.': 'Discover, explore and share the best places in the city.',
  'Descubra, explore e compartilhe': 'Discover, explore and share',
  'os melhores lugares da cidade.': 'the best places in the city.',
  'Explorar roteiros': 'Explore itineraries',
  'Usuários': 'Users',
  'Visite lugares incríveis da cidade.': 'Visit amazing places in the city.',
  'Tudo o que você precisa para aproveitar sua viagem, em um só lugar.': 'Everything you need to enjoy your trip, all in one place.',
  'Tudo o que você precisa para aproveitar': 'Everything you need to enjoy',
  'sua viagem, em um só lugar.': 'your trip, all in one place.',
  'Dúvidas': 'FAQ',
  'Dúvidas frequentes': 'Frequently asked questions',
  'Comece agora e viva Campos do Jordão do seu jeito.': 'Start now and experience Campos do Jordão your way.',
  'Já tenho uma conta': 'I already have an account',
  '© 2026 Monvian. Todos os direitos reservados.': '© 2026 Monvian. All rights reserved.',
  'Navegação de apresentação Monvian': 'Monvian showcase navigation',
  'Apresentação principal Monvian — Campos do Jordão': 'Monvian main showcase — Campos do Jordão',
  'Maquete tridimensional de Campos do Jordão': '3D model of Campos do Jordão',
  'Destaques de Campos do Jordão': 'Campos do Jordão highlights',
  'Selecionar idioma': 'Select language',
  'Idiomas disponíveis': 'Available languages',
  'Português': 'Português',
  'English': 'English',
  'Lugares incríveis': 'Amazing places',
  'Descubra novos destinos.': 'Discover new destinations.',
  'Gastronomia e charme': 'Dining & charm',
  'Cafés, bistrôs e passeios.': 'Cafes, bistros and outings.',
  'Seus roteiros': 'Your itineraries',
  'Planeje cada parada.': 'Plan every stop.',
  'Passeios únicos': 'Unique outings',
  'Cenários inesquecíveis.': 'Unforgettable scenery.',
  'Novas experiências': 'New experiences',
  'Viva momentos na serra.': 'Live special mountain moments.',
  'Portal de entrada de Campos do Jordão com arquitetura enxaimel': 'Campos do Jordão welcome gate with half-timbered architecture',
  'Sans Souci Café Confeitaria em Campos do Jordão': 'Sans Souci Café & Patisserie in Campos do Jordão',
  'Cabine telefônica vermelha e estação ferroviária em Vila Capivari': 'Red phone booth and train station in Vila Capivari',
  'Passarela com guarda-chuvas e luzes em Campos do Jordão ao entardecer': 'Walkway with umbrellas and evening lights in Campos do Jordão',
  'Arquitetura alpina cercada pelas montanhas da Serra da Mantiqueira': 'Alpine architecture surrounded by the Mantiqueira Mountains',
  'Quem vive, recomenda.': 'Those who experience it recommend it.',
  'Avaliação de 5 estrelas': '5-star rating',
  'Como o Monvian organiza meus passeios em Campos do Jordão?': 'How does Monvian organize my trips in Campos do Jordão?',
  'O Monvian reúne os melhores pontos turísticos, restaurantes, cafeterias e experiências da serra em roteiros interativos com mapa em tempo real, facilitando cada etapa da sua viagem.':
    'Monvian brings together the best attractions, restaurants, cafes, and mountain experiences into interactive itineraries with a real-time map, making every step of your trip easier.',
  'O aplicativo funciona durante o passeio pela cidade?': 'Does the app work while I am exploring the city?',
  'Sim. Ao escolher um roteiro ou explorar o mapa, você acompanha sua localização ao vivo, distância até as próximas paradas e sugestões próximas no seu iPhone.':
    'Yes. When choosing an itinerary or exploring the map, you can follow your live location, distance to upcoming stops, and nearby suggestions on your iPhone.',
  'Como faço para começar a usar?': 'How do I get started?',
  'Basta tocar em “Criar minha conta”, informar seu nome, e-mail e senha em poucos segundos para acessar todos os roteiros e experiências de Campos do Jordão.':
    'Just tap “Create my account”, enter your name, email, and password in a few seconds to access all itineraries and experiences in Campos do Jordão.',
  'Usuário Monvian 1': 'Monvian User 1',
  'Usuária Monvian 2': 'Monvian User 2',
  'Usuário Monvian 3': 'Monvian User 3',

  // Social Proof Reviews
  'A gente achou uma cafeteria escondida na Vila Abernéssia pelo mapa que nem aparecia direito nas buscas. Mudou nossa tarde de frio.':
    'We found a hidden coffee shop in Vila Abernéssia on the map that barely showed up in searches. It made our chilly afternoon.',
  'Fui sem planejamento nenhum pra Campos do Jordão e segui um roteiro pronto. Deu pra aproveitar tudo sem ficar rodando à toa.':
    'I went to Campos do Jordão with zero planning and followed a ready-made itinerary. We enjoyed everything without wandering aimlessly.',
  'O que mais gostei foi ver os restaurantes mais pertinho de onde a gente tava andando. Salvou demais na hora que bateu a fome.':
    'What I liked most was seeing restaurants closest to where we were walking. It saved us right when hunger hit.',
  'Minha namorada achou o Monvian bem fácil de mexer, até no carro ela ia olhando as próximas paradas do nosso passeio.':
    'My girlfriend found Monvian super easy to use — even in the car she kept checking the next stops on our trip.',
  'Descobri um mirante bem tranquilo fora do movimento do Capivari. Nunca ia saber que existia se não tivesse olhado por aqui.':
    'I discovered a peaceful viewpoint away from the Capivari crowds. I never would have known it existed without looking here.',
  'Organizei o fim de semana inteiro em uns dez minutos antes de subir a serra. Bem direto ao ponto, sem enrolação.':
    'I planned the whole weekend in about ten minutes before heading up the mountain. Straight to the point, no fuss.',
  'Gostei muito das dicas de lugar pra tomar chocolate quente sem pegar fila enorme. Fui em dois que viraram meus favoritos.':
    'I loved the tips on where to get hot chocolate without huge lines. I visited two spots that became my favorites.',
  'Viajei com meus pais e ajudou demais a escolher passeios mais sossegados e tranquilos pra eles irem no ritmo deles.':
    'I traveled with my parents and it helped a lot to pick calmer, relaxing spots so they could go at their own pace.',
  'Super prático pra achar trilha e parque perto do centro. A gente tocava no lugar e já via certinho como chegar.':
    'Super practical for finding trails and parks near downtown. We tapped a place and immediately saw how to get there.',
  'Já tinha ido pra Campos várias vezes, mas dessa vez conheci umas cantinas e bistrôs que eu nem fazia ideia que existiam.':
    'I had been to Campos several times before, but this time I discovered trattorias and bistros I had no idea existed.',
  'Sabe quando você abre um aplicativo e já entende tudo de primeira? Foi exatamente assim, zero complicação pra usar.':
    'You know when you open an app and immediately understand everything? It was just like that, zero hassle to use.',
  'A gente seguiu o roteiro romântico no sábado e encaixou certinho o pôr do sol com o jantar. Ficou redondo o passeio.':
    'We followed the romantic itinerary on Saturday and timed sunset perfectly with dinner. The whole outing flowed seamlessly.',
  'Não precisei ficar salvando mil prints no celular dessa vez, deixei todos os pontos que queria visitar num lugar só.':
    'I didn’t have to save a thousand screenshots on my phone this time — I kept every spot I wanted to visit in one place.',
  'Achei muito bom porque mostra desde os clássicos de Capivari até uns cantinhos mais escondidos no meio das araucárias.':
    'Really great because it shows everything from Capivari classics to hidden corners nestled among the araucaria pines.',

  // AuthScreen & Error Messages
  'O endereço de e-mail não pode conter espaços.': 'The email address cannot contain spaces.',
  'Informe um endereço de e-mail válido.': 'Please enter a valid email address.',
  'Formato de e-mail inválido.': 'Invalid email format.',
  'Complete o endereço (ex: @gmail.com).': 'Complete the address (e.g. @gmail.com).',
  'As senhas não coincidem.': 'Passwords do not match.',
  'Não foi possível processar a imagem. Tente outra foto.': 'Could not process the image. Try another photo.',
  'Criando sua conta…': 'Creating your account…',
  'Adicionando suas informações…': 'Adding your details…',
  'Preparando seu perfil…': 'Preparing your profile…',
  'Não foi possível concluir o cadastro.': 'Could not complete sign-up.',
  'Resposta inválida do servidor ao autenticar sua conta.': 'Invalid server response while authenticating your account.',
  'Não foi possível vincular sua conta do Google. Tente novamente.': 'Could not link your Google account. Please try again.',
  'Autenticação com Google cancelada': 'Google authentication canceled',
  'Este link expirou ou já foi utilizado. Solicite uma nova recuperação de senha.': 'This link has expired or was already used. Request a new password reset.',
  'Esta conta encontra-se suspensa. Entre em contato com o suporte.': 'This account is suspended. Please contact support.',
  'Esta conta foi criada com o Google. Clique em "Entrar com Google / Gmail" abaixo.': 'This account was created with Google. Tap "Sign in with Google / Gmail" below.',
  'A seleção de conta do Google foi fechada antes de concluir.': 'Google account selection was closed before completion.',
  'Este e-mail já possui uma conta.': 'This email already has an account.',
  'A senha deve ter pelo menos 6 caracteres.': 'Password must be at least 6 characters.',
  'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.': 'Too many attempts in a row. Wait a moment and try again.',
  'E-mail ou senha incorretos.': 'Incorrect email or password.',
  'Não foi possível validar sua conta por e-mail no momento. Tente entrar com Google ou tente novamente.': 'Unable to validate your email account right now. Try signing in with Google or try again.',
  'O cadastro por e-mail está temporariamente indisponível. Tente entrar com Google ou tente novamente em instantes.': 'Email sign-up is temporarily unavailable. Try Google sign-in or try again shortly.',
  'Não foi possível entrar com Google. Tente novamente.': 'Could not sign in with Google. Please try again.',
  'Não foi possível concluir a recuperação agora. Tente novamente.': 'Could not complete password recovery right now. Please try again.',
  'Não foi possível conectar. Tente novamente.': 'Could not connect. Please try again.',
  'Não foi possível concluir seu cadastro. Tente novamente.': 'Could not complete your sign-up. Please try again.',
  'Não foi possível enviar as instruções de recuperação. Tente novamente.': 'Could not send recovery instructions. Please try again.',
  'Não foi possível redefinir sua senha. Solicite um novo link.': 'Could not reset your password. Request a new link.',
  'Não foi possível entrar na sua conta. Tente novamente.': 'Could not sign in to your account. Please try again.',
  'Vamos começar, qual é seu nome?': 'Let’s get started — what’s your name?',
  'Forneça seu e-mail para continuar': 'Enter your email to continue',
  'Crie uma senha': 'Create a password',
  'Crie sua senha': 'Create your password',
  'Confirme sua senha': 'Confirm your password',
  'Escolha uma foto de perfil': 'Choose a profile photo',
  'Uma foto de perfil ajuda outras pessoas a reconhecerem você no Monvian.': 'A profile photo helps others recognize you on Monvian.',
  'Escolher da galeria': 'Choose from gallery',
  'Fazer isso depois': 'Do this later',
  'Remover foto selecionada': 'Remove selected photo',
  'Configurando sua experiência': 'Setting up your experience',
  'Bem-vindo': 'Welcome',
  'Que bom ter você por aqui!': 'So glad to have you here!',
  'Explore o mapa': 'Explore the map',
  'Descubra os melhores lugares em tempo real, pelo mapa da cidade.': 'Discover the best places in real time on the city map.',
  'Conecte-se': 'Connect',
  'Veja o que outras pessoas estão fazendo e compartilhe suas experiências.': 'See what others are doing and share your experiences.',
  'Salve seus favoritos': 'Save your favorites',
  'Monte sua lista de lugares preferidos e não perca nada.': 'Build your list of favorite places and never miss a thing.',
  'Receba novidades': 'Get updates',
  'Fique por dentro de eventos, passeios e muito mais.': 'Stay in the loop on events, tours, and much more.',
  'Começar': 'Get started',
  'Seu nome': 'Your name',
  'Seu nome (ex: Mario Yesk)': 'Your name (e.g. Alex Silva)',
  'Digite seu nome': 'Enter your name',
  'Digite pelo menos 2 caracteres para continuar.': 'Enter at least 2 characters to continue.',
  'Seu e-mail': 'Your email',
  'seu@email.com': 'you@email.com',
  'seuemail@gmail.com': 'youremail@gmail.com',
  'Sua senha': 'Your password',
  'Digite sua senha': 'Enter your password',
  'Entrar com Google / Gmail': 'Sign in with Google / Gmail',
  'Não possui uma conta?': "Don't have an account?",
  'Esqueci minha senha': 'Forgot my password',
  'Recuperar acesso': 'Recover access',
  'Informe o e-mail da sua conta para receber as instruções de redefinição de senha.': 'Enter your account email to receive password reset instructions.',
  'Enviar instruções': 'Send instructions',
  'Verifique sua caixa de entrada e a pasta de spam.': 'Check your inbox and spam folder.',
  'Voltar para o login': 'Back to login',
  'Ir para o login': 'Go to login',
  'Validando link de recuperação…': 'Validating recovery link…',
  'Sua nova senha já está ativa. Entre na sua conta para continuar.': 'Your new password is now active. Sign in to continue.',
  'Link expirado ou inválido': 'Expired or invalid link',
  'Solicitar novo link': 'Request new link',
  'Nova senha (mín. 6 caracteres)': 'New password (min. 6 chars)',
  'Confirmar nova senha': 'Confirm new password',
  'Redefinir senha': 'Reset password',
  'Senha redefinida com sucesso!': 'Password reset successfully!',
  'Visualizar confirmação de senha': 'Show password confirmation',
  'Ocultar confirmação de senha': 'Hide password confirmation',
  'Campos do Jordão.': 'Campos do Jordão.',
  'Seu guia inteligente para viver': 'Your smart guide to experience',
  'Nome completo ou de exibição': 'Full or display name',
  'E-mail de acesso': 'Login email',

  // Bottom & Desktop Navigation + Map Controls
  'Navegação': 'Navigation',
  'Navegação Principal': 'Main Navigation',
  'Menu principal desktop': 'Main desktop menu',
  'Expandir menu': 'Expand menu',
  'Alternar visualização 3D': 'Toggle 3D view',
  'Alternar para visualização 2D': 'Switch to 2D view',
  'Alternar para visualização 3D': 'Switch to 3D view',
  'Alternar para visão 2D Plana': 'Switch to flat 2D view',
  'Alternar para visão 3D com Relevo e Montanhas': 'Switch to 3D Terrain & Mountains view',
  'Alternar Relevo 3D': 'Toggle 3D Terrain',
  'Filtrar por Categoria': 'Filter by Category',
  'Filtro de categoria ativo - Clique para alterar ou limpar': 'Category filter active - Click to change or clear',
  'Centralizar na minha localização e ativar bússola em tempo real': 'Center on my location and enable live compass',
  'Alternar camada do mapa': 'Switch map layer',
  'Alternar para mapa padrão': 'Switch to standard map',
  'Alternar para satélite': 'Switch to satellite',
  'Alternar satélite / mapa': 'Toggle satellite / map',
  'Modo Satélite Ativo (Toque para alternar)': 'Satellite Mode Active (Tap to toggle)',
  'Mapa': 'Map',
  'Satélite': 'Satellite',
  'Satélite HD': 'HD Satellite',
  'Satélite HD (40% Mais Claro)': 'HD Satellite (40% Brighter)',
  'Mapa Noturno / Escuro': 'Night / Dark Map',
  'Padrão': 'Standard',
  'Escuro': 'Dark',
  'Claro': 'Light',
  'Transporte': 'Transit',
  'Animado': 'Animated',

  // Categories
  'Todas': 'All',
  'Todos': 'All',
  'Restaurantes': 'Restaurants',
  'Restaurante': 'Restaurant',
  'Cafés': 'Cafes',
  'Café': 'Cafe',
  'Café / Cafeteria': 'Cafe / Coffee Shop',
  'Cafés & Bistrôs': 'Cafes & Bistros',
  'Cafés e Bistrôs': 'Cafes & Bistros',
  'Cafés e Docerias': 'Cafes & Bakeries',
  'Chocolates & Cafés': 'Chocolates & Cafes',
  'Chocolates & Cafés Charmosos': 'Chocolates & Charming Cafes',
  'Turísticos': 'Attractions',
  'Pontos turísticos': 'Attractions',
  'Ponto Turístico': 'Tourist Spot',
  'Ponto Turístico / Local': 'Tourist Spot / Place',
  'Atração': 'Attraction',
  'Atrações': 'Attractions',
  'Atrações & Parques': 'Attractions & Parks',
  'Atrações & Passeios': 'Attractions & Tours',
  'Atração / Turístico': 'Attraction / Sightseeing',
  'Atração / Turística': 'Attraction / Sightseeing',
  'ATRAÇÃO / TURÍSTICO': 'ATTRACTION / SIGHTSEEING',
  'Natureza': 'Nature',
  'Jardins & Natureza': 'Gardens & Nature',
  'Ecoturismo & Trilhas': 'Ecotourism & Trails',
  'Cultura': 'Culture',
  'Cultura e História': 'Culture & History',
  'História & Arte': 'History & Art',
  'Música & Cultura': 'Music & Culture',
  'Música & Esculturas': 'Music & Sculptures',
  'Música': 'Music',
  'Compras': 'Shopping',
  'Passeios': 'Tours',
  'Experiências': 'Experiences',
  'Vida Noturna': 'Nightlife',
  'Hotéis': 'Hotels',
  'Hotéis e Pousadas': 'Hotels & Inns',
  'Pousadas & Hotéis': 'Inns & Hotels',
  'Hotel & Gastronomia': 'Hotel & Dining',
  'Hotel Histórico & Spa': 'Historic Hotel & Spa',
  'Pousada Romântica': 'Romantic Inn',
  'Farmácias': 'Pharmacies',
  'Farmácia': 'Pharmacy',
  'Farmácia & Conveniência': 'Pharmacy & Convenience',
  'Farmácia 24h & Cuidados': '24h Pharmacy & Care',
  'Mirantes & Pôr do Sol': 'Viewpoints & Sunset',
  'Mirante & Pôr do Sol': 'Viewpoint & Sunset',
  'Mirante e Pôr do Sol': 'Viewpoint & Sunset',
  'Mirante / Panorâmico': 'Scenic Viewpoint',
  'Mirante / Ponto Fotográfico': 'Viewpoint / Photo Spot',
  'Vista Panorâmica': 'Panoramic View',
  'Vila Gastronômica': 'Gastronomic Village',
  'Bistrô & Café': 'Bistro & Cafe',
  'Gastronomia & Choperia': 'Dining & Brewery',
  'Fondue Tradicional': 'Traditional Fondue',
  'Cartão Postal': 'Postcard Landmark',
  'Portal / Cartão Postal': 'Gate / Postcard Landmark',
  'Conveniência & Vinhos': 'Convenience & Wines',
  'Lago, Teleférico & Roda-Gigante': 'Lake, Cable Car & Ferris Wheel',
  'Teleférico & Mirante': 'Cable Car & Viewpoint',
  'Passeio & Quedas d\'Água': 'Walk & Waterfalls',
  'Ponto de Referência': 'Landmark',
  'Ponto de Ônibus / Transporte': 'Bus Stop / Transit',
  'Terminal / Estação': 'Terminal / Station',
  'Banheiro Público': 'Public Restroom',
  'Caixa Eletrônico': 'ATM',
  'Caixa Eletrônico / Banco': 'ATM / Bank',
  'Serviços': 'Services',
  'Gastronômico': 'Culinary',
  'Romântico': 'Romantic',
  'Romântico & Casal': 'Romantic & Couples',
  'Família': 'Family',
  'Família & Crianças': 'Family & Kids',
  'Aventura': 'Adventure',
  'Luxo Clássico': 'Classic Luxury',
  'Passeio Rápido / Bate-Volta': 'Quick Day Trip',
  'A Suíça Brasileira': 'The Brazilian Switzerland',

  // Weather & Greetings
  'Seja bem vindo a Campos do Jordão!': 'Welcome to Campos do Jordão!',
  'Clima de Montanha • Nevoeiro Suave': 'Mountain Weather • Light Mist',
  'Clima de serra em Campos do Jordão': 'Mountain weather in Campos do Jordão',
  'Informações de Campos do Jordão': 'Campos do Jordão info',
  'Chuva': 'Rain',
  'Chuva leve': 'Light rain',
  'Chuva moderada': 'Moderate rain',
  'Chuva forte': 'Heavy rain',
  'Chuva forte com raios': 'Thunderstorm',
  'Garoa gélida': 'Freezing drizzle',
  'Céu limpo': 'Clear sky',
  'Noite de céu limpo': 'Clear night',
  'Céu parcialmente encoberto': 'Partly cloudy',
  'Nublado': 'Cloudy',
  'Nevoeiro': 'Foggy',
  'Sensação': 'Feels like',
  'Umidade': 'Humidity',
  'Vento': 'Wind',
  'Próximos Dias': 'Next Days',
  'Fechar previsão do tempo': 'Close weather forecast',
  'Temperatura amena de serra durante o dia e friozinho rigoroso à noite.':
    'Mild mountain temperatures during the day and crisp chill at night.',

  // Search & Spot Preview / Detail
  'Buscar em Campos do Jordão...': 'Search in Campos do Jordão...',
  'Buscar pontos, restaurantes, hotéis...': 'Search spots, restaurants, hotels...',
  'Buscar locais ou atrações...': 'Search places or attractions...',
  'Buscar ponto turístico...': 'Search tourist spot...',
  'Buscar pelo nome...': 'Search by name...',
  'Busca por voz': 'Voice search',
  'Pesquisar por voz': 'Voice search',
  'Limpar busca': 'Clear search',
  'Limpar pesquisa': 'Clear search',
  'Sugeridos para você': 'Suggested for you',
  'Sugestões em destaque': 'Featured suggestions',
  'Em alta:': 'Trending:',
  'Recentes': 'Recent',
  'Nenhum local encontrado': 'No places found',
  'Nenhum local encontrado em Campos do Jordão.': 'No places found in Campos do Jordão.',
  'Nenhum ponto encontrado': 'No spots found',
  'Tente alterar os termos da busca ou selecionar outra categoria.': 'Try changing search terms or selecting another category.',
  'Tente pesquisar com outro termo': 'Try searching with another term',
  'Voltar às categorias': 'Back to categories',
  'Ver detalhes & localização': 'View details & location',
  'Ver detalhes completos': 'View full details',
  'Ver Local': 'View Place',
  'Ver roteiro': 'View itinerary',
  'Ver tudo': 'See all',
  'Como chegar': 'Directions',
  'Como chegar no GPS': 'Get GPS directions',
  'Traçar Rota no GPS': 'Start GPS Route',
  'Traçar rota até este local': 'Get directions to this place',
  'Abrir no GPS': 'Open in GPS',
  'Abrir rota no Maps': 'Open route in Maps',
  'Ligar para o estabelecimento': 'Call venue',
  'Ligar para o local': 'Call place',
  'Acessar Website': 'Visit Website',
  'Acessar site oficial': 'Visit official website',
  'Gerar QR Code deste local': 'Generate QR Code for this spot',
  'Fechar QR Code': 'Close QR Code',
  'Adicionar aos favoritos': 'Add to favorites',
  'Remover dos favoritos': 'Remove from favorites',
  'Salvar nos favoritos': 'Save to favorites',
  'Remover dos salvos': 'Remove from saved',
  'Favoritar': 'Favorite',
  'Horário de Funcionamento': 'Opening Hours',
  'Endereço': 'Address',
  'Entrada': 'Admission',
  'Ingresso / Faixa': 'Ticket / Price',
  'Dicas do guia': 'Guide tips',
  'O que esperar': 'What to expect',
  'Avaliações': 'Reviews',
  'Avaliações de visitantes': 'Visitor reviews',
  'Avaliar este ponto turístico': 'Rate this spot',
  'Publicar avaliação': 'Post review',
  'Conte como foi sua experiência (opcional)...': 'Share your experience (optional)...',
  'Experiência impecável em Campos do Jordão!': 'Unforgettable experience in Campos do Jordão!',
  'Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável. Vale muito a pena a visita.':
    'Spectacular place! Incredible view of Campos do Jordão and super pleasant weather. Well worth the visit.',
  'Vídeos da Comunidade': 'Community Videos',
  'Enviar Vídeo': 'Upload Video',
  'Enviar Vídeo do Local': 'Upload Place Video',
  'Publicar Vídeo': 'Publish Video',
  'Nenhum vídeo enviado para este local ainda': 'No videos uploaded for this place yet',
  'Toque em Enviar Vídeo para compartilhar sua experiência': 'Tap Upload Video to share your experience',
  'Clique para gravar ou escolher vídeo': 'Click to record or choose video',
  'MP4, MOV ou WebM no formato original': 'MP4, MOV or WebM in original quality',
  'Título ou Dica do Vídeo': 'Video Title or Tip',
  'Vídeo Enviado com Sucesso!': 'Video Uploaded Successfully!',
  'Seu vídeo foi salvo na nuvem no formato original e adicionado à reprodução em 1.2x.':
    'Your video was saved to the cloud in original quality and added at 1.2x playback.',
  'clicando uma vez pausa o vídeo': 'tap once to pause video',
  'Ativar áudio': 'Unmute audio',
  'Silenciar áudio': 'Mute audio',
  'Marcar como não visitado': 'Mark as not visited',
  'Dica do Dia': 'Tip of the Day',

  // Itineraries & Store
  'Meu Roteiro': 'My Itinerary',
  'MEU ROTEIRO': 'MY ITINERARY',
  'Roteiro de Viagem': 'Travel Itinerary',
  'Roteiro Sem Título': 'Untitled Itinerary',
  'Loja de Roteiros': 'Itinerary Store',
  'Explorar Roteiros': 'Explore Itineraries',
  'Todos os Roteiros': 'All Itineraries',
  'Roteiros salvos': 'Saved itineraries',
  'Roteiros exclusivos': 'Exclusive itineraries',
  'Roteiros para descobrir': 'Itineraries to discover',
  'Roteiros de bate-e-volta e experiências de 1 dia': 'Day trips and 1-day experiences',
  'Roteiros perfeitos para passar o fim de semana': 'Perfect itineraries for the weekend',
  'Buscar roteiros': 'Search itineraries',
  'Buscar roteiros, destinos ou experiências...': 'Search itineraries, destinations or experiences...',
  'Criar manualmente': 'Create manually',
  'Criar roteiro manualmente no mapa': 'Create itinerary manually on the map',
  'Criar Novo': 'Create New',
  'Adicionar Local': 'Add Place',
  'Adicionar Local ao Roteiro': 'Add Place to Itinerary',
  'ADICIONAR LOCAL AO ROTEIRO': 'ADD PLACE TO ITINERARY',
  'Adicionar Novo Local': 'Add New Place',
  'Adicionar Ponto ao Roteiro': 'Add Stop to Itinerary',
  'Adicionar ponto turístico ao roteiro': 'Add tourist spot to itinerary',
  'Nenhum local adicionado ainda.': 'No places added yet.',
  'Nenhuma parada cadastrada para este dia.': 'No stops added for this day.',
  'Nenhum roteiro encontrado': 'No itineraries found',
  'Carregando roteiros...': 'Loading itineraries...',
  'Carregando mais roteiros...': 'Loading more itineraries...',
  'Local planejado do roteiro': 'Planned itinerary stop',
  'Opções': 'Options',
  'Opções do roteiro': 'Itinerary options',
  'Opções de Adição': 'Add Options',
  'Escolha uma ação para o seu roteiro': 'Choose an action for your itinerary',
  'Editar Roteiro': 'Edit Itinerary',
  'Editar roteiro': 'Edit itinerary',
  'Apagar roteiro': 'Delete itinerary',
  'Tem certeza que deseja apagar este roteiro?': 'Are you sure you want to delete this itinerary?',
  'Salvar roteiro': 'Save itinerary',
  'Salvar nome': 'Save name',
  'Salvar nos Meus Roteiros': 'Save to My Itineraries',
  'Compartilhar roteiro': 'Share itinerary',
  'Iniciar roteiro': 'Start itinerary',
  'Abrir roteiro no mapa': 'Open itinerary on map',
  'Explorar no Mapa': 'Explore on Map',
  'Toque para explorar no mapa': 'Tap to explore on map',
  'Toque para editar': 'Tap to edit',
  'Nome do roteiro...': 'Itinerary name...',
  'O título do roteiro é obrigatório.': 'Itinerary title is required.',
  'Reorganize a ordem dos pontos ou remova locais.': 'Reorder stops or remove places.',
  'Remover local': 'Remove place',
  'Remover ponto': 'Remove stop',
  'Excluir ponto turístico': 'Delete tourist spot',
  'Dicas para este Roteiro': 'Tips for this Itinerary',
  'Anotações': 'Notes',
  'Anotações da Viagem': 'Trip Notes',
  'Fechar anotações': 'Close notes',
  'Escreva uma anotação sobre sua viagem...': 'Write a note about your trip...',
  'Sua anotação é salva localmente': 'Your note is saved locally',
  'Roteiro ativo': 'Active itinerary',
  'Roteiro carregado com sucesso!': 'Itinerary loaded successfully!',
  'Navegar na loja de roteiros prontos': 'Browse the ready-made itinerary store',
  'Importar pontos turísticos para o card': 'Import tourist spots to the card',
  'Importar novamente para o roteiro': 'Import back into itinerary',
  'Selecione um ponto turístico...': 'Select a tourist spot...',
  'O nome do ponto turístico é obrigatório.': 'Tourist spot name is required.',

  // Onboarding & Post-Signup Wizard
  'Quando você vai para Campos do Jordão?': 'When are you visiting Campos do Jordão?',
  'Escolha a data da sua viagem.': 'Choose your trip dates.',
  'Mês anterior': 'Previous month',
  'Próximo mês': 'Next month',
  'Quantas pessoas vão?': 'How many people are going?',
  'Ajuste o número de viajantes para esta viagem.': 'Adjust the number of travelers for this trip.',
  'Adultos': 'Adults',
  'A partir de 13 anos': 'Ages 13 and up',
  'Diminuir adultos': 'Decrease adults',
  'Aumentar adultos': 'Increase adults',
  'Crianças': 'Children',
  'Até 12 anos': 'Ages 12 and under',
  'Nenhuma criança': 'No children',
  '1 criança': '1 child',
  'Diminuir crianças': 'Decrease children',
  'Aumentar crianças': 'Increase children',
  'Quanto você pretende gastar?': 'What is your planned budget?',
  'Prefiro não informar': 'Prefer not to say',
  'O que você mais busca descobrir?': 'What are you most excited to discover?',
  'Isso ajuda a encontrar lugares que combinam com sua viagem.': 'This helps find places that match your trip.',
  'Personalizando sua experiência...': 'Personalizing your experience...',
  'Gerar Roteiro Agora': 'Generate Itinerary Now',
  'Lugares Selecionados!': 'Selected Places!',
  'Buscando o que fazer em Campos do Jordão': 'Finding things to do in Campos do Jordão',
  'Experiência completa em Campos do Jordão': 'Complete experience in Campos do Jordão',
  'Experiência premium sem restrições': 'Unrestricted premium experience',
  'Equilíbrio entre parques e bistrôs': 'Balance of parks and bistros',
  'Restaurantes típicos, cafés e chocolaterias': 'Local restaurants, cafes & chocolate shops',
  'Parques com atrações ao ar livre e segurança': 'Parks with outdoor attractions & safety',
  'Passeios ao ar livre e atrações gratuitas': 'Outdoor walks & free attractions',
  'Passeios no centro turístico e malhas': 'Downtown walks & knitwear shops',
  'Experiências a dois com vista e aconchego': 'Couples experiences with scenic views & coziness',
  'Indicação de amigos': 'Recommended by friends',
  'Indicação de amigos ou família': 'Recommended by friends or family',
  'Gastronomia, ingressos e degustações': 'Dining, tickets & tastings',
  'Ritmo otimizado': 'Optimized pace',

  // Default Itineraries & Spots Descriptions
  '1 Dia': '1 Day',
  '2 Dias': '2 Days',
  '3 Dias': '3 Days',
  '4 Dias': '4 Days',
  'Essência de Campos: O Clássico em 2 Dias': 'Campos Essence: 2-Day Classic',
  'O roteiro perfeito para a primeira visita a Campos do Jordão, reunindo os pontos turísticos mais emblemáticos, gastronomia suíça e mirantes deslumbrantes.':
    'The ideal itinerary for a first visit to Campos do Jordão, bringing together iconic landmarks, Swiss-inspired dining, and breathtaking viewpoints.',
  'Roteiro Romântico nas Alturas (1 Dia)': 'Romantic Heights Itinerary (1 Day)',
  'Planejado para casais que buscam momentos especiais, cenários encantadores para fotos a dois e alta gastronomia.':
    'Designed for couples seeking special moments, charming photo spots for two, and fine dining.',
  'Tour Gastronômico: Sabores & Chocolates da Serra': 'Culinary Tour: Mountain Flavors & Chocolates',
  'Degustação das delícias artesanais de Campos: fondues suíços, chocolates quentes, cervejas premiadas e doces típicos.':
    'Taste Campos’ artisanal delights: Swiss fondues, hot chocolates, award-winning craft beers, and local sweets.',
  'Roteiro otimizado para quem tem apenas um dia na cidade e deseja vivenciar os pontos imperdíveis sem perder tempo.':
    'Optimized itinerary for visitors with just one day in town who want to see the must-visit highlights without wasting time.',
  'Roteiro personalizado criado manualmente': 'Custom itinerary created manually',
  'Roteiro personalizado de Campos do Jordão': 'Custom Campos do Jordão itinerary',
  'Dia 1': 'Day 1',
  'Dia 1: Campos em 1 Dia': 'Day 1: Campos in 1 Day',
  'Dia 1: Aventura & Bosques': 'Day 1: Adventure & Forests',
  'Dia 1: Jardins Floridos & Charme de Capivari': 'Day 1: Flower Gardens & Capivari Charm',
  'Dia 1: Romance & Vista Panorâmica': 'Day 1: Romance & Panoramic Views',
  'Dia 1: Rota Personalizada na Serra': 'Day 1: Custom Mountain Route',
  'Dia 1: Sabores do Capivari': 'Day 1: Flavors of Capivari',
  'Dia 2: Mirantes, Ducha de Prata & Cerejeiras': 'Day 2: Viewpoints, Ducha de Prata & Cherry Blossoms',
  'Início da sua aventura': 'Start of your adventure',
  'Início da sua aventura no cartão-postal de chegada.': 'Start of your adventure at the classic arrival landmark.',
  'O coração da cidade': 'The heart of the city',
  'O coração da cidade com arquitetura alpina e gastronomia.': 'The heart of the city with alpine architecture and dining.',
  'Portal, Capivari e Mirante do Elefante.': 'Welcome Gate, Capivari and Elephant Hill Viewpoint.',
  'Manhã contemplativa entre labirintos floridos, tarde no centro turístico e noite com fondue tradicional.':
    'Contemplative morning among flower mazes, afternoon downtown, and evening with traditional fondue.',
  'Almoço clássico com chopes artesanais na Baden Baden.': 'Classic lunch with craft drafts at Baden Baden.',
  'Almoço no coração do Capivari com pratos alemães e chopes artesanais.': 'Lunch in the heart of Capivari with German dishes and craft beers.',
  'Cafés coloniais e chocolates quentes cremosos no calçadão.': 'Colonial cafes and creamy hot chocolates along the promenade.',
  'Caminhe pelo labirinto de arbustos e aproveite a luz da manhã nos mirantes.': 'Stroll the hedge maze and enjoy morning light at the viewpoints.',
  'Explore a estação histórica e as lojas de malhas e chocolates.': 'Explore the historic station and knitwear and chocolate shops.',
  'Passeio pelo Parque Capivari, teleférico e lago central.': 'Walk through Capivari Park, cable car and central lake.',
  'Visita panorâmica no Morro do Elefante, cachoeiras na Ducha de Prata e bosques floridos.':
    'Panoramic visit at Elephant Hill, Ducha de Prata waterfalls and flower parks.',
  'Leve um casaco para o entardecer nas montanhas e reserve o restaurante de fondue com antecedência.':
    'Bring a jacket for mountain evenings and book your fondue restaurant ahead.',
  'Deixe espaço para sobremesas em cada parada e experimente os chocolates artesanais.':
    'Leave room for dessert at every stop and try the artisanal chocolates.',
  'Recomendamos iniciar os passeios pela manhã para aproveitar a melhor iluminação e evitar filas na Vila Capivari à noite.':
    'We recommend starting tours in the morning for the best light and to skip evening lines in Vila Capivari.',
  'Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes do sol se pôr para pegar um bom lugar.':
    'Unforgettable sunset. Arrive at least 40 minutes before sunset to get a good spot.',

  // Spot descriptions & tips
  'Mais de 700 espécies de plantas em 26 jardins temáticos inspirados em diferentes países do mundo, com o famoso labirinto verde e mirantes com vista para a Serra da Mantiqueira.':
    'Over 700 plant species across 26 themed gardens inspired by countries around the world, featuring the famous green labyrinth and Mantiqueira Mountain viewpoints.',
  'Vá com calçados confortáveis para caminhar. O labirinto de arbustos é imperdível para fotos! O melhor horário de luz é entre 10h e 15h.':
    'Wear comfortable walking shoes. The hedge labyrinth is a must for photos! Best lighting is between 10 AM and 3 PM.',
  'A mais de 2.030 metros de altitude, oferece uma vista panorâmica de tirar o fôlego onde é possível avistar até 15 cidades do Vale do Paraíba, além de campos de lavanda.':
    'Over 2,030 meters above sea level, offering breathtaking panoramic views of up to 15 Paraíba Valley towns plus lavender fields.',
  'Leve agasalho reforçado pois o vento no topo é muito gelado. Não perca o café com vista para o vale.':
    'Pack a warm coat as winds at the summit are freezing. Don’t miss the cafe overlooking the valley.',
  'O ponto de encontro mais tradicional do Capivari. Cervejas artesanais premiadas da casa, culinária alemã e pratos clássicos de montanha no coração turístico da cidade.':
    'Capivari’s most traditional gathering spot. Award-winning house craft beers, German cuisine, and classic mountain dishes in the tourist center.',
  'Experimente a Baden Baden Cristal ou Chocolate Beer acompanhada de um joelho de porco (Eisbein) ou fondue.':
    'Try the Baden Baden Cristal or Chocolate Beer paired with pork knuckle (Eisbein) or fondue.',
  'Quedas d\'água canalizadas em meio à natureza com passarelas de madeira suspensas, lojinhas de artesanato, queijos, doces caseiros e tirolesa.':
    'Natural channeled waterfalls surrounded by forest with elevated wooden walkways, craft shops, cheeses, homemade sweets, and zipline.',
  'Entrada gratuita! Ótimo para comprar lembrancinhas, provar licores artesanais e caminhar nas passarelas entre os pinheiros.':
    'Free admission! Great for souvenirs, tasting artisanal liqueurs, and strolling wooden bridges beneath the pines.',
  'Residência oficial de inverno do Governador de São Paulo. Conta com acervo de mais de 3.500 obras de arte brasileira (incluindo Tarsila do Amaral e Anita Malfatti) e mobiliário dos séculos XVII e XVIII.':
    'Official winter residence of the Governor of São Paulo, housing over 3,500 Brazilian artworks (including Tarsila do Amaral and Anita Malfatti) and 17th–18th-century furniture.',
  'Visita guiada muito rica culturalmente. Ao lado fica o Café do Palácio com quitutes coloniais.':
    'Culturally rich guided tour. Next door is Café do Palácio with colonial pastries.',
  'Sede oficial do renomado Festival Internacional de Inverno de Campos do Jordão, situado em um bosque ao ar livre repleto de esculturas imponentes de Felícia Leirner.':
    'Official venue of the renowned International Winter Festival of Campos do Jordão, set in an open-air forest filled with Felícia Leirner’s sculptures.',
  'O pôr do sol no mirante do museu com as esculturas ao fundo é uma das experiências mais bonitas da serra.':
    'Sunset from the museum overlook with sculptures in the foreground is one of the finest experiences in the mountains.',
  'Conjunto charmoso de galerias, bistrôs iluminados, lojas de lã e malharias com arquitetura suíça alpina, ideal para passeios noturnos em clima frio.':
    'Charming complex of galleries, lit bistros, wool boutiques, and knitwear shops with Swiss-alpine architecture, ideal for evening strolls.',
  'As luzes acesas à noite dão o clima perfeito de vila europeia. Ótimo ponto para passear a pé.':
    'The evening lights create a true European village atmosphere. Great spot to walk around.',
  'Famoso pelo teto floral instagramável, doces artesanais franceses, croissants crocantes e cardápio de bistrô contemporâneo de alto nível.':
    'Famous for its floral ceiling, handmade French pastries, flaky croissants, and refined contemporary bistro menu.',
  'Chegue cedo para o café da tarde para evitar filas e garantir uma foto na fachada florida.':
    'Arrive early for afternoon tea to skip lines and snap a photo by the floral facade.',
  'Área preservada com mais de 100 mil m² de Mata Atlântica e araucárias centenárias, com trilhas suspensas, arvorismo, tirolesa e quiosque de café.':
    'Preserved reserve of over 100,000 m² of Atlantic Forest and centuries-old araucaria pines with suspended trails, treetop courses, ziplines, and a coffee kiosk.',
  'Passeio muito tranquilo para desacelerar, ouvir o canto dos pássaros e respirar o ar puro das montanhas.':
    'Peaceful outing to slow down, listen to birdsong, and breathe crisp mountain air.',
  'Famosa casa de fondue e carnes nobres de Campos do Jordão, incluindo carnes exóticas e rodízio completo de queijo, carnes na pedra e chocolate.':
    'Famous fondue and steakhouse in Campos do Jordão featuring exotic meats and a full cheese, hot-stone, and chocolate fondue feast.',
  'O festival de fondue é farto e perfeito para a noite fria. Peça o fondue doce com morango e marshmallow.':
    'The fondue feast is generous and ideal for cold nights. Order the sweet chocolate fondue with strawberries and marshmallows.',
  'Marco turístico clássico na entrada da cidade pela Rodovia Floriano Rodrigues Pinheiro. Arquitetura alpina clássica e centro de atendimento ao turista.':
    'Classic landmark at the city entrance along Floriano Rodrigues Pinheiro Highway, with alpine architecture and tourist info center.',
  'Parada obrigatória logo na chegada para registrar a foto clássica de boas-vindas a Campos do Jordão!':
    'A must-stop right upon arrival for the classic Campos do Jordão welcome photo!',
  'Supermercado completo com ampla adega de vinhos importados e nacionais, queijos finos, pães artesanais e suprimentos para quem aluga chalé ou Airbnb.':
    'Full-service supermarket with a wide cellar of imported and local wines, fine cheeses, artisan breads, and chalet supplies.',
  'Ótimo para abastecer a lareira com lenha, comprar queijo para fondue caseiro e chocolates com preços de mercado.':
    'Great for stocking firewood, fondue cheese, and chocolates at supermarket prices.',
  'Hotel-escola histórico em meio a 440 mil m² de bosque privativo com alta gastronomia, fondues premiados e chá da tarde elegante.':
    'Historic hospitality hotel set in 440,000 m² of private woodland offering fine dining, award-winning fondues, and elegant afternoon tea.',
  'Mesmo sem se hospedar, é possível agendar o chá da tarde colonial ou jantar no restaurante Arte da Cozinha.':
    'Even as a non-guest, you can book colonial afternoon tea or dinner at Arte da Cozinha restaurant.',
  'Coração turístico de Campos do Jordão com teleférico, pedalinhos, roda-gigante e áreas de passeio ao redor do lago.':
    'Tourist heart of Campos do Jordão featuring a cable car, paddleboats, Ferris wheel, and lakeside walkways.',
  'Pioneira no chocolate artesanal em Campos do Jordão desde 1991. Espaço envidraçado onde os visitantes podem assistir à fabricação de trufas, bombons e chocolates quentes.':
    'Pioneer in artisanal chocolate in Campos do Jordão since 1991, with glass viewing areas to watch truffles, bonbons, and hot cocoa being crafted.',
  'Farmácia central e completa no coração de Capivari, com medicamentos, protetor solar labial para o frio, cosméticos e itens de primeiros socorros.':
    'Central full-service pharmacy in the heart of Capivari carrying medications, cold-weather lip balm, cosmetics, and first-aid items.',
  'Farmácia completa com medicamentos, linha de cuidados para o frio, chás e conveniência.':
    'Full-service pharmacy with medications, cold-weather care, teas, and convenience items.',
  'Mirante a 1.800 metros de altitude com visão privilegiada de todo o bairro Capivari. Conta com o novo teleférico com cabines fechadas e trenó de montanha.':
    'Viewpoint at 1,800m altitude overlooking all of Capivari, featuring an enclosed cable car and mountain coaster.',
  'O passeio de teleférico é imperdível para famílias e casais. Se quiser adrenalina, experimente o trenó alpino!':
    'The cable car ride is a must for families and couples. For adrenaline, try the alpine coaster!',
  'Ponto turístico clássico na pracinha de Capivari. Famoso pelos chocolates em formato de araucária, fondue express no copo com morangos frescos e waffles.':
    'Classic spot on Capivari square, famous for pine-shaped chocolates, express fondue cups with fresh strawberries, and waffles.',
  'O chocolate quente com marshmallow tostado na hora é a melhor pedida em noites de frio.':
    'Hot chocolate topped with freshly toasted marshmallow is the best pick on chilly nights.',

  // Saved, Profile, Settings, Wallet, Gold, Legal & Social
  'Configurações': 'Settings',
  'Configurações do Perfil': 'Profile Settings',
  'Configurações da conta': 'Account settings',
  'Aparência e preferências do Monvian': 'Monvian appearance and preferences',
  'Fechar configurações': 'Close settings',
  'Efeitos & Relevo': 'Effects & Terrain',
  'Preferências & Efeitos': 'Preferences & Effects',
  'Chuva Dinâmica': 'Dynamic Rain',
  'Chuva dinâmica': 'Dynamic rain',
  'Precipitação no mapa 3D': 'Precipitation on the 3D map',
  'Chuva Dinâmica no Relevo': 'Dynamic Terrain Rain',
  'Simulação de precipitação no mapa 3D': 'Precipitation simulation on 3D map',
  'Neve das Montanhas': 'Mountain Snow',
  'Neve das montanhas': 'Mountain snow',
  'Flocos de neve sobre Campos': 'Snowflakes over Campos',
  'Flocos de neve caindo sobre Campos': 'Snowflakes falling over Campos',
  'Idioma': 'Language',
  'Idioma do aplicativo': 'App language',
  'Português / English': 'Português / English',
  'Minha Conta & Permissões': 'My Account & Permissions',
  'Gerenciar perfil, GPS e notificações': 'Manage profile, GPS & notifications',
  'Gerenciar privacidade': 'Manage privacy',
  'Gerenciar privacidade e dados pessoais': 'Manage privacy & personal data',
  'Editar Perfil': 'Edit Profile',
  'Editar Perfil e Foto': 'Edit Profile & Photo',
  'Nome': 'Name',
  'Nome de usuário': 'Username',
  'Nome de usuário disponível': 'Username available',
  'Nome de usuário indisponível': 'Username unavailable',
  'Nome de usuário indisponível. Escolha outro.': 'Username unavailable. Choose another.',
  'O nome de usuário é obrigatório.': 'Username is required.',
  'Apenas letras, números e _': 'Letters, numbers and _ only',
  'Mínimo 3 caracteres': 'Minimum 3 characters',
  'Biografia': 'Bio',
  'Biografia do perfil': 'Profile bio',
  'Conte sobre sua paixão por Campos do Jordão...': 'Tell us about your love for Campos do Jordão...',
  'Locais salvos': 'Saved places',
  'Locais turísticos e roteiros salvos na sua lista de favoritos.': 'Tourist spots and itineraries saved to your favorites.',
  'Suas coleções e lugares marcados em Campos do Jordão': 'Your collections and saved places in Campos do Jordão',
  'Quero Visitar': 'Want to Visit',
  'Nenhum lugar curtido ainda.': 'No liked places yet.',
  'Toque no ícone de coração nos pontos turísticos do mapa para adicioná-los aqui.': 'Tap the heart icon on map spots to add them here.',
  'Toque no coração de qualquer ponto para salvar aqui!': 'Tap the heart on any spot to save it here!',
  'Itens removidos de roteiros ou descurtidos aparecerão nesta lista.': 'Items removed from itineraries or unliked will appear here.',
  'Restaurar para salvos': 'Restore to saved',
  'Todos os pontos explorados · Nível máximo!': 'All spots explored · Max level!',
  'XP · MÁX': 'XP · MAX',
  'Carteira': 'Wallet',
  'Fechar carteira': 'Close wallet',
  'Seus Plátanos': 'Your Plátanos',
  'Plátano disponível': 'Plátano available',
  'Plátanos disponíveis': 'Plátanos available',
  'Seu saldo atual': 'Your current balance',
  'Saldo após liberar': 'Balance after unlock',
  'Comprar Plátanos': 'Buy Plátanos',
  'Nenhuma movimentação ainda': 'No transactions yet',
  'Suas compras de Plátanos e roteiros liberados aparecerão aqui.': 'Your Plátano purchases and unlocked itineraries will appear here.',
  'Pagamento seguro processado via Stripe · O saldo não expira': 'Secure payment via Stripe · Balance never expires',
  'Melhor valor': 'Best value',
  'Acesso vitalício': 'Lifetime access',
  'PAGAMENTO ÚNICO · ACESSO VITALÍCIO': 'ONE-TIME PAYMENT · LIFETIME ACCESS',
  'ATIVAR ELITE GOLD': 'ACTIVATE ELITE GOLD',
  'Monvian Elite Gold.': 'Monvian Elite Gold.',
  'Monvian Gold Ativado!': 'Monvian Gold Activated!',
  'Campos do Jordão Monvian Gold': 'Campos do Jordão Monvian Gold',
  'Experiências exclusivas, roteiros selecionados e lugares especiais em Campos do Jordão.':
    'Exclusive experiences, curated itineraries, and special spots in Campos do Jordão.',
  'Acesso ilimitado liberado a todos os roteiros exclusivos de Campos do Jordão.':
    'Unlimited access unlocked to all exclusive Campos do Jordão itineraries.',
  'Libera até 1 roteiro premium': 'Unlocks 1 premium itinerary',
  'Notificações': 'Notifications',
  'Notificações e Atividade': 'Notifications & Activity',
  'Ainda não há notificações': 'No notifications yet',
  'Carregando notificações...': 'Loading notifications...',
  'Marcar todas como lidas': 'Mark all as read',
  'Ao chegar aos pontos turísticos de Campos do Jordão, seus alertas aparecerão aqui.':
    'When you arrive at Campos do Jordão sights, your alerts will appear here.',
  'Sair da conta': 'Sign out',
  'Encerrar Sessão': 'Sign Out',
  'Voltar ao Perfil': 'Back to Profile',
  'Voltar para Perfil': 'Back to Profile',
  'Voltar para o mapa': 'Back to map',
  'Voltar para o perfil': 'Back to profile',
  'Carregando perfil...': 'Loading profile...',

  // Help, Legal & Privacy
  'Ajuda e Informações': 'Help & Information',
  'Ajuda e informações': 'Help & information',
  'Central de ajuda': 'Help center',
  'Fale conosco': 'Contact us',
  'Suporte, privacidade, termos e exclusão de conta': 'Support, privacy, terms & account deletion',
  'Suporte Técnico': 'Technical Support',
  'Dúvida sobre Roteiros e Locais': 'Question about Itineraries & Places',
  'Sugestão ou Correção de Estabelecimento': 'Venue Suggestion or Correction',
  'Outros Assuntos': 'Other Topics',
  'Buscar dúvida ou palavra-chave...': 'Search question or keyword...',
  'Nenhuma pergunta encontrada para sua busca.': 'No questions found for your search.',
  'Não encontrou o que procurava?': "Didn't find what you were looking for?",
  'Envie sua dúvida diretamente para o suporte do Monvian.': 'Send your question directly to Monvian support.',
  'Tente outro termo ou fale diretamente com nossa equipe na página Fale conosco.':
    'Try another term or reach our team directly on the Contact us page.',
  'Canal oficial de suporte e atendimento ao usuário.': 'Official support and user care channel.',
  'Horário de atendimento: Segunda a sábado, das 09h às 19h (horário de Brasília)':
    'Support hours: Monday to Saturday, 9 AM – 7 PM (BRT)',
  'Atendimento registrado com sucesso': 'Support ticket submitted successfully',
  'Nossa equipe recebeu sua mensagem e responderá no e-mail informado.':
    'Our team received your message and will reply to the email provided.',
  'Assunto': 'Subject',
  'Categoria do atendimento': 'Support category',
  'E-mail para resposta': 'Reply email',
  'Mensagem detalhada': 'Detailed message',
  'Termos de Uso': 'Terms of Use',
  'Termos de uso': 'Terms of use',
  'Política de Privacidade': 'Privacy Policy',
  'Política de privacidade': 'Privacy policy',
  'Privacidade e Proteção de Dados (LGPD)': 'Privacy & Data Protection (LGPD)',
  'Excluir minha conta': 'Delete my account',
  'Excluir dados selecionados': 'Delete selected data',
  'Exclusão de dados': 'Data deletion',
  'Resumo da sua solicitação': 'Summary of your request',
  'Confirmar correção de dados': 'Confirm data correction',
  'Sobre o Monvian': 'About Monvian',
  'Informações institucionais, versão e conformidade.': 'Company info, version & compliance.',
  'Versão da plataforma': 'Platform version',
  'Região de cobertura principal': 'Primary coverage region',
  'Permissão GPS': 'GPS Permission',
  'Localização GPS': 'GPS Location',
  'Obtendo localização...': 'Getting location...',
  'Conexões': 'Connections',
  'Seguidores': 'Followers',
  'Seguindo': 'Following',
  'Seguir': 'Follow',
  'Nenhum seguidor ainda': 'No followers yet',
  'Pesquisar Usuários': 'Search Users',
  'Pesquisar pessoas, @username...': 'Search people, @username...',
  'Nenhum usuário disponível': 'No users available',
  'Usuário não encontrado': 'User not found',
  'Publicação': 'Post',
  'Publicações': 'Posts',
  'Nova Publicação': 'New Post',
  'Nenhuma publicação ainda': 'No posts yet',
  'As fotos publicadas por este usuário aparecerão aqui.': 'Photos posted by this user will appear here.',
  'Nenhuma outra foto deste usuário.': 'No other photos from this user.',
  'Escreva uma legenda para sua foto...': 'Write a caption for your photo...',
  'Adicionar Story': 'Add Story',
  'Adicionar ao story': 'Add to story',
  'Publicar Story': 'Post Story',
  'Excluir Story': 'Delete Story',
  'Carregando stories...': 'Loading stories...',
  'Campos do Jordão • Stories 24h': 'Campos do Jordão • 24h Stories',
  'Seus stories ficam visíveis por 24 horas para todos os visitantes de Campos do Jordão.':
    'Your stories remain visible for 24 hours to all visitors in Campos do Jordão.',
  'Comentários': 'Comments',
  'Carregando comentários...': 'Loading comments...',
  'Nenhum comentário ainda': 'No comments yet',
  'Nenhum comentário ainda. Seja o primeiro a comentar!': 'No comments yet. Be the first to comment!',
  'Seja o primeiro a deixar um comentário!': 'Be the first to leave a comment!',
  'Adicione um comentário...': 'Add a comment...',
  'Deixe um comentário...': 'Leave a comment...',
  'Abrir Câmera': 'Open Camera',
  'Escolher da Galeria (Foto ou Vídeo)': 'Choose from Gallery (Photo or Video)',
  'Galeria Local': 'Local Gallery',
  'Adicionar Texto': 'Add Text',
  'Pré-visualização': 'Preview',
  'Pré-visualização do story': 'Story preview',
  'Modo Offline': 'Offline Mode',
  'Instalar app': 'Install app',
  'Instalar': 'Install',
  'Instalado': 'Installed',
  'Painel Admin': 'Admin Panel',
  'Painel ADM': 'Admin Panel',
  'Link copiado para a área de transferência!': 'Link copied to clipboard!',
  'Salvo com sucesso': 'Saved successfully',
  'Ops, ocorreu um erro.': 'Oops, an error occurred.',
  'Erro de conexão': 'Connection error',

  // Help & Legal Section (complete coverage)
  'Perguntas frequentes organizadas por categorias.': 'Frequently asked questions organized by category.',
  'Como coletamos, utilizamos e protegemos seus dados.': 'How we collect, use, and protect your data.',
  'Regras e condições de utilização da plataforma.': 'Platform usage rules and conditions.',
  'Privacidade e dados': 'Privacy & Data',
  'Acesso, correção e exclusão de dados pessoais.': 'Access, correction, and deletion of personal data.',
  'Encerramento permanente da conta e dos dados associados.': 'Permanent termination of your account and associated data.',
  'Suporte ao visitante, diretrizes de uso, controle de dados pessoais e informações institucionais do Monvian.':
    'Visitor support, usage guidelines, personal data control, and Monvian institutional information.',
  'Monvian Campos do Jordão': 'Monvian Campos do Jordão',
  'Conformidade LGPD • Lei nº 13.709/2018': 'LGPD Compliance • Law No. 13.709/2018',
  'Conformidade regulatória': 'Regulatory compliance',
  'Campos do Jordão • Serra da Mantiqueira, SP': 'Campos do Jordão • Serra da Mantiqueira, SP',
  'Selecione uma categoria ou pesquise abaixo para encontrar respostas rápidas sobre o funcionamento do Monvian.':
    'Select a category or search below to find quick answers about how Monvian works.',
  'Conta e Acesso': 'Account & Access',
  'Mapa e Navegação': 'Map & Navigation',
  'Roteiros e Lugares': 'Itineraries & Places',
  'Privacidade e Dados': 'Privacy & Data',
  'Como altero meu nome, @usuário ou e-mail de acesso?': 'How do I change my name, @username, or login email?',
  'Você pode atualizar seu nome de exibição, identificador @usuário, biografia, foto e e-mail diretamente no seu Perfil tocando em "Editar" ou acessando a página "Gerenciar privacidade e dados pessoais" na seção Ajuda e informações.':
    'You can update your display name, @username, bio, photo, and email directly in your Profile by tapping "Edit" or visiting "Manage Privacy & Personal Data" under Help & Information.',
  'Como funciona a recuperação de acesso à minha conta?': 'How does account access recovery work?',
  'Na tela de entrada do aplicativo, selecione a opção de recuperação de senha e informe o e-mail vinculado à sua conta. Caso necessite de suporte adicional com seu cadastro, utilize a página "Fale conosco".':
    'On the app sign-in screen, choose password recovery and enter the email linked to your account. If you need further assistance with your account, use the "Contact Us" page.',
  'Por que o Monvian solicita permissão de localização e movimento?':
    'Why does Monvian request location and motion permissions?',
  'A localização GPS é utilizada exclusivamente para exibir sua posição em tempo real no mapa de Campos do Jordão, calcular distâncias até pontos turísticos e orientar rotas. O sensor de movimento permite alinhar a direção do mapa conforme você gira o aparelho.':
    'GPS location is used exclusively to show your real-time position on the Campos do Jordão map, calculate distances to attractions, and guide routes. The motion sensor aligns the map orientation as you turn your device.',
  'Posso usar o aplicativo sem compartilhar minha localização?': 'Can I use the app without sharing my location?',
  'Sim. Caso opte por não conceder ou revogar a permissão de localização, você continuará tendo acesso normal aos pontos turísticos, roteiros, busca e Monviangram, com o mapa centralizado na região de Campos do Jordão.':
    'Yes. If you choose not to grant or revoke location permission, you will still have normal access to attractions, itineraries, search, and Monviangram, with the map centered on Campos do Jordão.',
  'Como salvar lugares e roteiros favoritos?': 'How do I save favorite places and itineraries?',
  'Ao visualizar qualquer ponto turístico no mapa ou um roteiro na aba Roteiros, toque no botão de salvar para adicioná-lo à sua lista pessoal na aba Salvos. Seus itens ficam sincronizados com sua conta.':
    'When viewing any spot on the map or an itinerary in the Itineraries tab, tap the save button to add it to your personal Saved list. Your items stay synced with your account.',
  'As informações de horários e endereços dos locais são atualizadas?':
    'Are venue hours and addresses kept up to date?',
  'A curadoria do Monvian revisa periodicamente horários estimados, endereços e dicas práticas dos estabelecimentos e atrações de Campos do Jordão. Caso identifique alguma alteração recente em um local, envie um aviso pelo canal "Fale conosco".':
    'Monvian curators periodically review estimated hours, addresses, and practical tips for venues and attractions in Campos do Jordão. If you notice any recent change at a venue, please send us a note via "Contact Us".',
  'Quem pode ver minhas publicações e stories no Monviangram?':
    'Who can see my posts and stories on Monviangram?',
  'As fotos, stories e comentários publicados no Monviangram são visíveis para os demais usuários autenticados na comunidade do aplicativo. Você pode excluir suas publicações a qualquer momento pelo próprio feed ou em "Gerenciar privacidade e dados pessoais".':
    'Photos, stories, and comments published on Monviangram are visible to other authenticated users in the app community. You can delete your posts at any time from the feed or under "Manage Privacy & Personal Data".',
  'Como solicitar acesso, correção ou exclusão dos meus dados pessoais?':
    'How do I request access, correction, or deletion of my personal data?',
  'Acesse "Gerenciar privacidade e dados pessoais" nesta seção. Lá você pode consultar todos os dados vinculados à sua conta, baixar uma cópia estruturada, corrigir informações cadastrais IMEDIATAMENTE ou remover dados específicos.':
    'Go to "Manage Privacy & Personal Data" in this section. There you can review all data linked to your account, download a structured copy, correct registration info immediately, or remove specific data.',
  'O que acontece quando eu excluo minha conta?': 'What happens when I delete my account?',
  'Ao confirmar a exclusão em "Excluir minha conta", seu perfil, sessões ativas, locais salvos, publicações, stories e comentários são removidos permanentemente da plataforma, mantendo-se apenas registros técnicos anonimizados exigidos por obrigação legal (Marco Civil da Internet e LGPD).':
    'When you confirm deletion under "Delete My Account", your profile, active sessions, saved places, posts, stories, and comments are permanently removed from the platform, keeping only anonymized technical records required by law.',
  'Documento Legal • Vigente em 2026': 'Legal Document • Effective 2026',
  'Transparência sobre os dados pessoais coletados, finalidades de uso, armazenamento e seus direitos como titular no aplicativo Monvian.':
    'Transparency regarding collected personal data, purposes of use, storage, and your rights as a data subject in the Monvian app.',
  'Controlador e Escopo desta Política': 'Controller and Scope of this Policy',
  'Esta Política de Privacidade descreve de forma transparente como o Monvian coleta, utiliza, armazena e protege os dados pessoais dos usuários ao utilizar nossa plataforma digital de turismo e navegação em Campos do Jordão.':
    'This Privacy Policy transparently describes how Monvian collects, uses, stores, and protects users’ personal data when using our digital tourism and navigation platform in Campos do Jordão.',
  'O tratamento de dados pessoais é realizado em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD) e com o Marco Civil da Internet (Lei nº 12.965/2014).':
    'Personal data processing is carried out in strict compliance with the Brazilian General Data Protection Law (Law No. 13.709/2018 — LGPD) and the Brazilian Civil Rights Framework for the Internet (Law No. 12.965/2014).',
  'Dados Pessoais Efetivamente Coletados': 'Personal Data Collected',
  'Dados cadastrais e de perfil: nome de exibição, nome de usuário (@usuário), endereço de e-mail ou contato informado no cadastro, senha criptografada (hash seguro), biografia opcional e fotografia de perfil.':
    'Account and profile data: display name, username (@username), email address or contact provided at signup, encrypted password (secure hash), optional bio, and profile photo.',
  'Dados de localização e sensores (mediante permissão): coordenadas geográficas (GPS) e orientação de bússola do dispositivo quando autorizados pelo usuário no sistema operacional, utilizados para posicionar o usuário no mapa interativo e indicar proximidade de pontos turísticos.':
    'Location and sensor data (with permission): GPS coordinates and device compass orientation when authorized by the user in the OS, used to position the user on the interactive map and indicate proximity to landmarks.',
  'Dados de uso e interações na plataforma: locais turísticos e roteiros salvos como favoritos, preferências visuais do aplicativo (como tema de exibição), além de fotos, stories, legendas, curtidas e comentários publicados voluntariamente pelo usuário no Monviangram.':
    'Platform usage and interaction data: favorite spots and itineraries, visual app preferences, as well as photos, stories, captions, likes, and comments voluntarily posted by the user on Monviangram.',
  'Finalidades do Tratamento de Dados': 'Purposes of Data Processing',
  'Autenticar sua conta, manter sua sessão ativa com segurança e sincronizar seus locais e roteiros favoritos entre acessos.':
    'Authenticate your account, securely maintain your active session, and sync your favorite spots and itineraries across visits.',
  'Exibir sua posição geográfica em tempo real no mapa de Campos do Jordão e calcular distâncias até atrações, restaurantes, cafés e serviços, exclusivamente quando a permissão de localização estiver ativa.':
    'Display your real-time geographic position on the Campos do Jordão map and calculate distances to attractions, restaurants, cafes, and services only while location permission is enabled.',
  'Permitir sua participação nas funcionalidades sociais do Monviangram, exibindo seu nome, @usuário e foto de perfil junto às publicações e interações que você escolher compartilhar.':
    'Enable your participation in Monviangram social features, showing your name, @username, and profile photo alongside posts and interactions you choose to share.',
  'Atender solicitações de suporte enviadas pelo canal "Fale conosco" e solicitações relativas aos seus direitos de privacidade.':
    'Respond to support requests sent through "Contact Us" and requests related to your privacy rights.',
  'Armazenamento, Segurança e Compartilhamento': 'Storage, Security, and Sharing',
  'Os dados são armazenados em infraestrutura de banco de dados protegida por controles de acesso, conexões criptografadas (HTTPS/TLS) e armazenamento de credenciais com algoritmo de hash criptográfico (bcrypt).':
    'Data is stored on database infrastructure protected by access controls, encrypted connections (HTTPS/TLS), and credential hashing (bcrypt).',
  'O Monvian não comercializa, não aluga e não compartilha seus dados pessoais com terceiros para fins publicitários.':
    'Monvian does not sell, rent, or share your personal data with third parties for advertising purposes.',
  'O compartilhamento restringe-se apenas aos provedores essenciais de infraestrutura tecnológica (banco de dados em nuvem e serviços de renderização cartográfica) estritamente necessários para a execução técnica do aplicativo, ou mediante requisição de autoridade competente na forma da lei.':
    'Sharing is strictly limited to essential technology infrastructure providers (cloud database and map rendering services) required for technical operation, or upon request by competent authorities as required by law.',
  'Direitos do Titular dos Dados (Art. 18 da LGPD)': 'Data Subject Rights (Art. 18 of LGPD)',
  'Confirmação e Acesso: você pode consultar a qualquer momento a totalidade dos dados cadastrais e registros de interação vinculados à sua conta e exportar uma cópia estruturada.':
    'Confirmation and Access: you may review all registration data and interaction logs linked to your account at any time and export a structured copy.',
  'Correção: você pode atualizar e retificar dados incompletos, inexatos ou desatualizados diretamente na ferramenta "Gerenciar privacidade e dados pessoais".':
    'Correction: you can update and rectify incomplete, inaccurate, or outdated data directly in the "Manage Privacy & Personal Data" tool.',
  'Eliminação e Revogação de Consentimento: você pode revogar permissões de localização, excluir histórico de favoritos e publicações ou realizar a exclusão definitiva da sua conta.':
    'Deletion and Withdrawal of Consent: you can revoke location permissions, delete favorites history and posts, or permanently delete your account.',
  'Retenção e Exclusão de Dados': 'Data Retention and Deletion',
  'Seus dados pessoais são mantidos apenas durante o período em que sua conta permanecer ativa ou conforme necessário para a prestação dos serviços.':
    'Your personal data is retained only for as long as your account remains active or as needed to provide the services.',
  'Quando você solicita a exclusão da conta, todos os dados pessoais de perfil, favoritos e conteúdos publicados são imediatamente excluídos do banco de dados ativo. Registros técnicos estritamente necessários ao cumprimento de obrigação legal (como registros de acesso sob sigilo previstos no Art. 15 do Marco Civil da Internet e Art. 16, I da LGPD) são retidos de forma isolada pelo prazo legal aplicável e posteriormente eliminados.':
    'When you request account deletion, all personal profile data, favorites, and published content are immediately deleted from the active database. Technical logs strictly required to comply with legal obligations are retained in isolation for the applicable statutory period and subsequently purged.',
  'Exercer seus direitos de titular': 'Exercise your data subject rights',
  'Acesse, exporte, retifique ou exclua seus dados pessoais a qualquer momento.':
    'Access, export, rectify, or delete your personal data at any time.',
  'Condições Gerais da Plataforma': 'Platform General Conditions',
  'Regras de utilização do mapa interativo, roteiros turísticos, conta de usuário e publicações comunitárias no Monvian.':
    'Rules for using the interactive map, tourist itineraries, user account, and community posts on Monvian.',
  'Aceitação dos Termos': 'Acceptance of Terms',
  'Ao criar uma conta ou utilizar o aplicativo Monvian, você concorda integralmente com estes Termos de Uso e com a nossa Política de Privacidade. Caso não concorde com qualquer disposição aqui prevista, recomendamos que não utilize a plataforma.':
    'By creating an account or using the Monvian app, you fully agree to these Terms of Use and our Privacy Policy. If you do not agree with any provision herein, please do not use the platform.',
  'Objetivo da Plataforma': 'Purpose of the Platform',
  'O Monvian é uma plataforma digital voltada à experiência turística em Campos do Jordão, oferecendo mapa interativo, curadoria de pontos turísticos, roteiros organizados e espaço comunitário de compartilhamento fotográfico (Monviangram).':
    'Monvian is a digital platform dedicated to the tourism experience in Campos do Jordão, offering an interactive map, curated landmarks, organized itineraries, and a community photo-sharing space (Monviangram).',
  'Cadastro, Conta e Responsabilidade do Usuário': 'Registration, Account, and User Responsibility',
  'O usuário compromete-se a fornecer informações verdadeiras, exatas e atualizadas no momento do cadastro, sendo o único responsável pela guarda de sua senha e por todas as atividades realizadas em sua conta.':
    'Users agree to provide truthful, accurate, and up-to-date information at registration and are solely responsible for safeguarding their password and all account activity.',
  'Não é permitido criar contas com dados de terceiros sem autorização, utilizar nomes de usuário ofensivos ou tentar acessar áreas administrativas ou contas de outros usuários.':
    'It is prohibited to create accounts using third-party data without authorization, use offensive usernames, or attempt to access administrative areas or other users’ accounts.',
  'Regras de Convivência e Conteúdo no Monviangram': 'Community Guidelines & Content on Monviangram',
  'Ao publicar fotos, vídeos temporários (stories), legendas ou comentários no Monviangram, o usuário declara possuir os direitos sobre o conteúdo enviado e garante que ele não viola direitos de imagem, propriedade intelectual ou privacidade de terceiros.':
    'When posting photos, temporary videos (stories), captions, or comments on Monviangram, users represent that they hold rights to the submitted content and warrant that it does not infringe third-party image rights, intellectual property, or privacy.',
  'É estritamente proibida a publicação de conteúdo ilegal, difamatório, discriminatório, violento, pornográfico, enganoso ou que configure spam comercial. O Monvian reserva-se o direito de remover publicações e suspender contas que violem estas diretrizes.':
    'Posting illegal, defamatory, discriminatory, violent, pornographic, deceptive, or commercial spam content is strictly prohibited. Monvian reserves the right to remove posts and suspend accounts that violate these guidelines.',
  'Informações Turísticas e Estabelecimentos': 'Tourist Information and Venues',
  'Os horários de funcionamento, faixas de preço, endereços e descrições de pontos turísticos, restaurantes, cafés e hotéis possuem caráter informativo para auxílio ao visitante. Condições climáticas, trânsito ou decisões operacionais de cada estabelecimento podem alterar seu funcionamento sem aviso prévio.':
    'Opening hours, price ranges, addresses, and descriptions of landmarks, restaurants, cafes, and hotels are informational to assist visitors. Weather, traffic, or operational decisions by each venue may alter hours without prior notice.',
  'Propriedade Intelectual': 'Intellectual Property',
  'A marca Monvian, a interface visual, o design do mapa, os textos autorais dos roteiros, o código-fonte e a organização da plataforma são protegidos pela legislação de propriedade intelectual, sendo vedada sua reprodução ou engenharia reversa sem autorização expressa.':
    'The Monvian brand, visual interface, map design, authored itinerary copy, source code, and platform organization are protected by intellectual property law; reproduction or reverse engineering without express authorization is prohibited.',
  'Suspensão, Cancelamento e Encerramento': 'Suspension, Cancellation, and Termination',
  'O usuário pode encerrar sua conta a qualquer momento, de forma autônoma e imediata, utilizando a opção "Excluir minha conta" disponível na seção Ajuda e informações.':
    'Users may close their account at any time autonomously and immediately using the "Delete My Account" option under Help & Information.',
  'O Monvian poderá suspender ou encerrar o acesso de contas que descumprirem estes Termos de Uso ou praticarem atos que comprometam a segurança técnica da plataforma.':
    'Monvian may suspend or terminate access for accounts that violate these Terms of Use or engage in actions that compromise platform technical security.',
  'Legislação Aplicável e Foro': 'Governing Law and Jurisdiction',
  'Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Campos do Jordão, Estado de São Paulo, ou o foro do domicílio do usuário consumidor, conforme aplicável pela legislação vigente.':
    'These Terms of Use are governed by the laws of the Federative Republic of Brazil, with venue in Campos do Jordão, State of São Paulo, or the consumer user’s domicile as applicable by law.',
  'Consulte os dados armazenados na sua conta, baixe uma cópia para portabilidade, retifique informações cadastrais ou solicite a exclusão de registros específicos.':
    'Review data stored in your account, download a portable copy, rectify registration details, or request deletion of specific records.',
  '1. Acesso aos dados armazenados': '1. Access stored data',
  'Resumo em tempo real das informações vinculadas à sua conta no banco de dados.':
    'Real-time summary of information linked to your account in the database.',
  'Autorizada': 'Authorized',
  'Desativada': 'Disabled',
  'Gere um arquivo estruturado (JSON) contendo todos os seus dados cadastrais e registros de atividade.':
    'Generate a structured (JSON) file containing all your registration data and activity records.',
  'Gerando arquivo...': 'Generating file...',
  'Solicitar e baixar meus dados': 'Request and download my data',
  '2. Correção de dados pessoais': '2. Personal data correction',
  'Atualize imediatamente qualquer dado cadastral incorreto ou desatualizado.':
    'Immediately update any incorrect or outdated registration details.',
  'Nome de usuário (@)': 'Username (@)',
  '3. Exclusão de dados específicos': '3. Delete specific data',
  'Selecione os registros pessoais que deseja eliminar da sua conta sem encerrar seu acesso ao aplicativo.':
    'Select personal records you want to remove from your account without closing your access to the app.',
  'Histórico de locais e roteiros salvos': 'Saved spots and itineraries history',
  'Remove todos os lugares e roteiros marcados como favoritos na sua conta.':
    'Removes all places and itineraries marked as favorites on your account.',
  'Publicações, stories e comentários no Monviangram': 'Monviangram posts, stories, and comments',
  'Exclui suas fotos publicadas, stories ativos, comentários e curtidas.':
    'Deletes your published photos, active stories, comments, and likes.',
  'Biografia e informações complementares de perfil': 'Bio and additional profile info',
  'Limpa o texto de biografia pública do seu perfil.': 'Clears your public profile bio text.',
  'Registros de permissão de localização e última coordenada': 'Location permission records and last coordinate',
  'Revoga o consentimento de GPS/movimento salvo e apaga a última posição registrada.':
    'Revokes saved GPS/motion consent and erases the last recorded position.',
  'Deseja encerrar toda a conta? Acesse': 'Want to close your entire account? Go to',
  'Excluindo dados...': 'Deleting data...',
  'Histórico de solicitações registradas': 'Registered request history',
  'Acesso e exportação': 'Access & export',
  'Correção cadastral': 'Registration correction',
  'Não foi possível processar a solicitação de acesso.': 'Could not process access request.',
  'Relatório de dados pessoais gerado e baixado no seu dispositivo.': 'Personal data report generated and downloaded to your device.',
  'Erro ao solicitar acesso aos dados.': 'Error requesting data access.',
  'Nome e e-mail são obrigatórios para atualização cadastral.': 'Name and email are required to update registration.',
  'Erro ao corrigir dados pessoais.': 'Error correcting personal data.',
  'Seus dados pessoais foram corrigidos e sincronizados com sucesso.': 'Your personal data has been corrected and synced successfully.',
  'Não foi possível salvar a correção dos dados.': 'Could not save data correction.',
  'Selecione pelo menos uma categoria de dados pessoais para excluir.': 'Select at least one personal data category to delete.',
  'Erro ao excluir dados selecionados.': 'Error deleting selected data.',
  'Os dados pessoais selecionados foram excluídos permanentemente.': 'Selected personal data was permanently deleted.',
  'Não foi possível concluir a exclusão dos dados selecionados.': 'Could not complete deletion of selected data.',
  'Esta ação encerra permanentemente seu acesso ao Monvian e remove seus dados pessoais associados.':
    'This action permanently terminates your access to Monvian and removes your associated personal data.',
  'O que será permanentemente excluído:': 'What will be permanently deleted:',
  'Dados de perfil (nome, @usuário, e-mail, biografia e foto).': 'Profile data (name, @username, email, bio, and photo).',
  'Publicações, stories, comentários, curtidas e conexões no Monviangram.': 'Posts, stories, comments, likes, and connections on Monviangram.',
  'Sessões ativas e preferências vinculadas ao seu identificador.': 'Active sessions and preferences linked to your identifier.',
  'Obrigações legais de retenção (LGPD e Marco Civil da Internet)': 'Legal retention obligations (LGPD & Internet Law)',
  'Em cumprimento ao Art. 15 da Lei nº 12.965/2014 (Marco Civil da Internet) e ao Art. 16, inciso I da Lei nº 13.709/2018 (LGPD), apenas o registro técnico anonimizado do protocolo de exclusão e logs de conexão exigidos por lei são mantidos sob sigilo pelo prazo legal obrigatório, sem qualquer exibição pública ou uso comercial.':
    'In compliance with Art. 15 of Law No. 12.965/2014 and Art. 16(I) of Law No. 13.709/2018 (LGPD), only the anonymized deletion protocol technical record and connection logs required by law are confidentially retained for the mandatory legal term, without public display or commercial use.',
  'Motivo do encerramento (opcional)': 'Reason for closing (optional)',
  'Conte-nos brevemente se desejar...': 'Tell us briefly if you wish...',
  'Para confirmar, digite EXCLUIR abaixo:': 'To confirm, type EXCLUIR below:',
  'Para confirmar, digite': 'To confirm, type',
  'abaixo:': 'below:',
  'Excluindo conta...': 'Deleting account...',
  'Confirme que está ciente da exclusão permanente da conta e dos dados associados.':
    'Confirm that you understand the permanent deletion of your account and associated data.',
  'Digite a palavra EXCLUIR no campo de confirmação para prosseguir.': 'Type EXCLUIR in the confirmation field to proceed.',
  'Não foi possível excluir a conta neste momento.': 'Could not delete account right now.',
  'Erro ao executar a exclusão da conta.': 'Error executing account deletion.',
  'Envie dúvidas, sugestões, relatos técnicos ou solicitações jurídicas diretamente para a equipe do Monvian.':
    'Send questions, suggestions, technical reports, or legal requests directly to the Monvian team.',
  'Denúncia de Conteúdo (Monviangram)': 'Content Report (Monviangram)',
  'Descreva como podemos ajudar...': 'Describe how we can help...',
  'Enviar mensagem': 'Send message',
  'Seus chamados recentes': 'Your recent tickets',
  'Preencha todos os campos para enviar sua mensagem à equipe de atendimento.':
    'Fill in all fields to send your message to the support team.',
  'Não foi possível registrar seu atendimento.': 'Could not register your support request.',
  'Erro ao enviar mensagem.': 'Error sending message.',
  'E-mail de suporte e privacidade: suporte@monvian.com.br': 'Support and privacy email: suporte@monvian.com.br',

  // OnboardingFlow missing entries
  'Boas-vindas!': 'Welcome!',
  'Fondues à luz de velas, lareira e mirantes': 'Candlelit fondues, fireplaces, and viewpoints',
  'Aproveitar o melhor da serra em 1 ou 2 dias': 'Enjoy the best of the mountains in 1 or 2 days',
  'Alta gastronomia e fondues imperdíveis': 'Fine dining and must-try fondues',
  'Vistas panorâmicas e fotos inesquecíveis': 'Panoramic views and unforgettable photos',
  'Chocolate artesanal da serra e cafés especiais': 'Artisanal mountain chocolate and specialty coffees',
  'Reels, stories e publicações da serra': 'Reels, stories, and mountain posts',
  'Vídeos de dicas e roteiros': 'Tip and itinerary videos',
  'Recomendação de quem já usou': 'Recommendation from someone who used it',
  'Qual o seu estilo de viagem?': 'What is your travel style?',

  // InstallAppOption fragments
  'Aplicativo instalado neste dispositivo': 'App installed on this device',
  'Instale no seu iPhone ou iPad': 'Install on your iPhone or iPad',
  'Toque no botão de': 'Tap the',
  'na barra do Safari.': 'button in the Safari bar.',
  'Role a lista e selecione o item com o ícone': 'Scroll the list and select the item with the',
  'Toque em': 'Tap',
  'no canto superior direito.': 'in the top right corner.',
  'No seu navegador': 'In your browser',
  'Você pode instalar este aplicativo diretamente pelo menu do seu navegador (clicando no ícone de instalação na barra de endereços ou no menu de opções).':
    'You can install this app directly from your browser menu (by clicking the install icon in the address bar or options menu).',

  // Auth, App, Weather, Search, Saved, Spots & Itineraries missing items
  'Informe seu e-mail e senha.': 'Enter your email and password.',
  'Por favor, selecione um arquivo de imagem.': 'Please select an image file.',
  'Erro ao carregar a imagem selecionada.': 'Error loading the selected image.',
  'Erro ao ler a imagem.': 'Error reading the image.',
  'Selecionar foto de perfil': 'Select profile photo',
  'Foto de perfil selecionada': 'Profile photo selected',
  'Seu e-mail cadastrado': 'Your registered email',
  'Evento exclusivo em Campos do Jordão': 'Exclusive event in Campos do Jordão',
  'Programação especial do evento': 'Special event schedule',
  'Campos do Jordão, SP': 'Campos do Jordão, SP',
  'Seu navegador não suporta reconhecimento de voz.': 'Your browser does not support voice recognition.',
  'Céu estrelado': 'Starry sky',
  'Ouvindo... Fale o local': 'Listening... Say the place',
  'Dica para o Turista': 'Tip for Visitors',
  'Não foi possível carregar os roteiros. Verifique sua conexão e tente novamente.':
    'Could not load itineraries. Check your connection and try again.',
  'Falha ao carregar mais roteiros.': 'Failed to load more itineraries.',
  'Todos os roteiros': 'All itineraries',
  'Para descobrir': 'To discover',
  'Explorar todas as opções de Campos do Jordão': 'Explore all options in Campos do Jordão',
  'O roteiro precisa ter pelo menos 1 ponto.': 'The itinerary must have at least 1 stop.',
  'Detalhes do Roteiro': 'Itinerary Details',
  'Ditado por voz não é suportado neste navegador.': 'Voice dictation is not supported in this browser.',
  'Viagem para Campos do Jordão': 'Trip to Campos do Jordão',
  'Ouvindo... toque para parar': 'Listening... tap to stop',
  'Nenhum lugar selecionado.': 'No place selected.',
  'Não foi possível concluir a operação.': 'Could not complete operation.',
  'Roteiro liberado': 'Itinerary unlocked',
  'Liberar roteiro premium': 'Unlock premium itinerary',
  'Custo do roteiro': 'Itinerary cost',
  '0 (Já adquirido)': '0 (Already owned)',
  'Faltam para liberar': 'Needed to unlock',
  'Erro ao iniciar pagamento no Stripe.': 'Error starting Stripe checkout.',
  'roteiro premium liberado': 'premium itinerary unlocked',
  'roteiros premium liberados': 'premium itineraries unlocked',
  'Experiências e recomendações especiais': 'Experiences and special recommendations',
  'Não foi possível iniciar o checkout no Stripe.': 'Could not start Stripe checkout.',
  'Erro ao conectar ao Stripe. Tente novamente.': 'Error connecting to Stripe. Please try again.',
  'Selecione uma imagem válida (JPEG, PNG ou WEBP).': 'Select a valid image (JPEG, PNG, or WEBP).',
  'Troféu': 'Trophy',
  'Foto da publicação': 'Post photo',
  'Falha ao salvar publicação': 'Failed to save post',
  'Não foi possível publicar a foto. Tente novamente.': 'Could not publish photo. Please try again.',
  'Confira esta publicação em Campos do Jordão no Monvian Life': 'Check out this post from Campos do Jordão on Monvian Life',
  'Nenhum item removido': 'No item removed',
  'Nenhum item salvo': 'No saved items',
  'Explore roteiros selecionados de Campos do Jordão e curta os que mais gostar.':
    'Explore curated itineraries in Campos do Jordão and like your favorites.',
  'Toque na seta para voltar às categorias.': 'Tap the arrow to return to categories.',
  'Detalhes do Local': 'Spot Details',
  'QR Code do Local': 'Spot QR Code',
  'Mirante panorâmico com vista de tirar o fôlego para vales e montanhas': 'Panoramic viewpoint with breathtaking valley and mountain views',
  'Excelente ponto para fotografia e contemplação do pôr do sol': 'Excellent spot for photography and sunset watching',
  'Estacionamento e cafés típicos nas imediações': 'Parking and cozy cafes nearby',
  'Seu story': 'Your story',
  'Toque nas laterais para navegar': 'Tap the sides to navigate',
  'Deseja excluir este story?': 'Delete this story?',
  'Não foi possível excluir o story.': 'Could not delete the story.',
  'AGORA': 'NOW',
  'HÁ 1 DIA': '1 DAY AGO',
  'Confira esta publicação no Movea!': 'Check out this post on Monvian!',
  'Verifique a digitação ou tente procurar pelo nome completo.': 'Check spelling or try searching by full name.',
  'Descubra criadores em Campos do Jordão.': 'Discover creators in Campos do Jordão.',
  'Por favor, selecione uma foto ou vídeo.': 'Please select a photo or video.',
  'Falha ao salvar story': 'Failed to save story',
  'Não foi possível publicar o story. Tente novamente.': 'Could not publish story. Please try again.',
  'Sua vez': 'Your turn',
  'Mídia de Campos do Jordão': 'Campos do Jordão Media',
  'Digite sua legenda...': 'Type your caption...',
  'Marcar Localização': 'Tag Location',
  'Campos do Jordão (Geral)': 'Campos do Jordão (General)',
  'Roteiro Salvo': 'Saved Itinerary',
  'Meu Roteiro em Campos': 'My Campos Itinerary',
  'Mapa do Roteiro': 'Itinerary Map',
  'grátis': 'free',

  // Spots & Tinder Helpers & Default Itineraries remaining items
  'Imperdível': 'Must-see',
  'Tradição': 'Tradition',
  'Recepção 24 horas': '24-hour front desk',
  'Consultar no local': 'Check on site',
  'R$ 20 / veículo': 'R$ 20 / vehicle',
  'R$ 0 / Acesso Grátis': 'R$ 0 / Free Admission',
  'Experiência imperdível na montanha de Campos do Jordão.': 'Must-try mountain experience in Campos do Jordão.',
  'Antiga residência de inverno com acervo clássico de arte brasileira.': 'Former winter residence with a classic collection of Brazilian art.',
  '26 jardins temáticos do mundo e o famoso labirinto verde.': '26 themed gardens from around the world and the famous green hedge maze.',
  'Vista panorâmica a mais de 2.030m para 15 cidades da Serra.': 'Panoramic view at over 2,030m overlooking 15 mountain towns.',
  'Cervejas artesanais icônicas e gastronomia alemã no Capivari.': 'Iconic craft beers and German cuisine in Capivari.',
  'Esculturas ao ar livre e pôr do sol inesquecível na montanha.': 'Open-air sculptures and an unforgettable mountain sunset.',
  'Fábrica tradicional com vista para produção e degustação.': 'Traditional factory with production viewing and tasting.',
  'Mirante clássico do Capivari com vista para toda a vila.': 'Classic Capivari viewpoint overlooking the entire village.',
  'Parque estadual com trilhas na mata atlântica e araucárias.': 'State park with trails through Atlantic Forest and araucaria pines.',
  'Vila charmosa com arquitetura alpina, bistrôs e lojas de lã.': 'Charming village with alpine architecture, bistros, and knitwear shops.',
  'Bistrôs e lojas elegantes com luzes aconchegantes à noite.': 'Elegant bistros and shops with cozy lights at night.',
  'Tradicional fondue suíço e gastronomia europeia no Capivari.': 'Traditional Swiss fondue and European cuisine in Capivari.',
  'Formação rochosa histórica esculpida pela natureza na serra.': 'Historic rock formation sculpted by nature in the mountains.',
  'Passeio nostálgico de trem e bondinho pelas montanhas.': 'Nostalgic train and tram ride through the mountains.',
  'Mais de 26 jardins temáticos do mundo e o famoso labirinto verde.': 'Over 26 themed gardens from around the world and the famous green maze.',
  'Coração turístico com teleférico, pedalinhos e roda gigante.': 'Tourist heart featuring cable car, paddle boats, and Ferris wheel.',
  'Cervejaria clássica com culinária alemã e ambiente acolhedor.': 'Classic brewery with German cuisine and cozy atmosphere.',
  'Vista panorâmica espetacular da cidade a partir do alto do Morro do Elefante.': 'Spectacular panoramic city view from the top of Morro do Elefante.',
  'Mirante a 1.800 metros de altitude com vista para todo o vale.': 'Viewpoint at 1,800m altitude overlooking the entire valley.',
  'Bosque relaxante de cerejeiras para contemplar o pôr do sol.': 'Relaxing cherry blossom grove for sunset watching.',
  'Passeio a dois pelos labirintos e jardins botânicos.': 'Couple stroll through botanical gardens and mazes.',
  'Vista do teleférico e mirante do Morro do Elefante.': 'Cable car ride and Morro do Elefante viewpoint.',
  'Jantar romântico com fondue suíço e vinho nas lareiras do Capivari.': 'Romantic dinner with Swiss fondue and wine by Capivari fireplaces.',
  'Para quem ama trilhas, tirolesas, arborismo e contato direto com a natureza preservada da Serra da Mantiqueira.':
    'For lovers of trails, zip lines, treetop courses, and direct contact with preserved Serra da Mantiqueira nature.',
  'Use calçados confortáveis para caminhada e leve protetor solar.': 'Wear comfortable walking shoes and bring sunscreen.',
  'Mais de 25 atrações de aventura em meio a 500 mil m² de mata.': 'Over 25 adventure attractions set amidst 500,000 m² of forest.',
  'Trilhas entre araucárias centenárias e natureza preservada.': 'Trails among centuries-old araucaria pines and preserved nature.',
  'Trilhas ecológicas e araucárias centenárias na Serra da Mantiqueira.': 'Ecological trails and centuries-old araucarias in Serra da Mantiqueira.',
  'Passeio gastronômico no centro e cervejarias artesanais.': 'Gastronomic tour downtown and craft breweries.',
  'Degustação na tradicional fábrica de chocolates artesanais.': 'Tasting at the traditional artisanal chocolate factory.',
  'Tradição em chocolates artesanais e chocolate quente na serra.': 'Tradition in artisanal chocolates and hot cocoa in the mountains.',
  'Chegue cedo para aproveitar a luz natural e estacione no centro para caminhar.': 'Arrive early for natural light and park downtown to walk.',
  'Diversão para todos com roda-gigante, teleférico e lago.': 'Fun for everyone with Ferris wheel, cable car, and lake.',
  'Diversão para todos': 'Fun for everyone',
  'Mesmo não hospedado, vale visitar a fazendinha do Toriba ou tomar um drinque com vista ao pôr do sol.':
    'Even if not staying overnight, it is worth visiting Toriba’s mini-farm or enjoying a sunset drink.',
  'Chalés aconchegantes com hidromassagem e vista espetacular para as montanhas e o vale de Capivari.':
    'Cozy chalets with whirlpool tubs and spectacular views of the mountains and Capivari valley.',
  'Excelente custo-benefício para casais que buscam vista e proximidade com o centro turístico.':
    'Great value for couples looking for views and proximity to the tourist center.',
  'Deguste o chocolate quente cremoso e traga as ramas de chocolate e drágeas de licor como presente!':
    'Taste the creamy hot chocolate and bring home chocolate bark and liqueur truffles as gifts!',
  'O maior festival de música clássica e erudita da América Latina, com apresentações gratuitas na Praça de Capivari e concertos de orquestras no Auditório Cláudio Santoro.':
    'Latin America’s largest classical music festival, featuring free performances at Capivari Square and orchestral concerts at Cláudio Santoro Auditorium.',
  'Consulte a programação antecipada dos concertos na praça; chegue 30 minutos antes para garantir bons assentos.':
    'Check the concert schedule in advance; arrive 30 minutes early for good seating.',
  'Feiras com estandes de produtores da Mantiqueira, pratos à base de pinhão, doces artesanais, música ao vivo e artesanato regional.':
    'Fairs with Serra da Mantiqueira producer booths, pine-nut dishes, artisanal sweets, live music, and regional crafts.',
  'Experimente o entrevero de pinhão na brasa com carnes selecionadas.': 'Try grilled pine-nut entrevero with selected meats.',
  'Ótima opção central com estacionamento próximo.': 'Great central option with nearby parking.',
  'Tenha sempre hidratante labial e antialérgico para as mudanças bruscas de temperatura na serra.':
    'Always carry lip balm and allergy medication for sudden mountain temperature changes.',
  '1.628m (Altitude Média)': '1,628m (Average Altitude)',

  // Social Demo Captions / Seed Posts
  'Manhã mágica entre as montanhas e araucárias de Campos do Jordão.': 'Magical morning among the mountains and araucaria pines of Campos do Jordão.',
  'Que foto linda! Esse clima frio é perfeito.': 'What a gorgeous photo! This chilly weather is perfect.',
  'Campos tem uma energia única no outono.': 'Campos has a unique energy in autumn.',
  'Fondue tradicional no friozinho de 11°C. Impossível vir e não experimentar.': 'Traditional fondue in chilly 11°C weather. Impossible to visit without trying it.',
  'Combinação perfeita com vinho tinto.': 'Perfect pairing with red wine.',
  'Vista deslumbrante do Morro do Elefante com o teleférico novinho em folha.': 'Stunning view of Morro do Elefante with the brand-new cable car.',
  'O teleférico de cabine é incrível!': 'The enclosed cable car is amazing!',
  'Paz absoluta caminhando pelas trilhas do Bosque do Silêncio.': 'Pure peace walking along the trails of Bosque do Silêncio.',
  'Entardecer dourado na Pedra do Baú. A Mantiqueira nunca decepciona.': 'Golden dusk at Pedra do Baú. Serra da Mantiqueira never disappoints.',
  'Café da tarde quentinho com chocolate artesanal no Baden Baden.': 'Warm afternoon coffee with artisanal chocolate in Capivari.',
  'Jardins de Amantikir: arte que fala através das flores e labirintos verdes.': 'Amantikir Gardens: art spoken through flowers and green mazes.',
  'O labirinto de grama é um clássico!': 'The grass maze is a classic!',
  'Névoa matinal atravessando as árvores centenárias do Horto Florestal.': 'Morning mist drifting through the ancient trees at Horto Florestal.',
  'Degustação especial de vinhos da serra. Rótulos locais surpreendentes.': 'Special mountain wine tasting. Surprising local labels.',
  'Parece uma vila na Suíça!': 'Looks like a village in Switzerland!',
  'Pôr do sol cinematográfico no Mirante da Vista Chinesa.': 'Cinematic sunset at Vista Chinesa Viewpoint.',
  'A serra toda no horizonte, inesquecível.': 'The entire mountain range on the horizon—unforgettable.',
  'Lugar histórico e delicioso para fotos.': 'Historic and lovely spot for photos.',
  'Pico do Itapeva a mais de 2.000 metros de altitude. Dá para ver o Vale todo!': 'Pico do Itapeva at over 2,000 meters altitude. You can see the whole valley!',
  'O lavandário lá de cima é surreal.': 'The lavender field up there is surreal.',
  'A vista das cidades do Vale é sensacional.': 'The view of the valley towns is sensational.',
  'O charme nostálgico do bondinho elétrico percorrendo a cidade.': 'The nostalgic charm of the electric tram running through town.',
  'As crianças adoram esse passeio!': 'The kids love this ride!',
  'Café da manhã de conto de fadas em uma das pousadas charmosas da serra.': 'Fairytale breakfast at one of the charming mountain inns.',
  'Que delícia de lugar!': 'What a delightful place!',
  'Manhã fria de geada no Vale do Lajeado. Termômetro marcou 4°C!': 'Crisp frosty morning in Vale do Lajeado. Thermometer hit 4°C!',
  'Noite de truta com pinhão e vinho quente na lareira.': 'Trout with pine nuts and mulled wine by the fireplace.',
  'Chocolate quente cremoso da fábrica Spinassi. Tradição imperdível!': 'Creamy hot chocolate from Spinassi factory. A must-try tradition!',
  'Passeio a cavalo pelas montanhas ao pôr do sol.': 'Horseback ride through the mountains at sunset.',
  'Orquidário e estufas do Amantikir. Cores vivas no inverno.': 'Amantikir orchid house and greenhouses. Vivid colors in winter.',
  'Mais um fim de tarde inesquecível nessa cidade mágica.': 'Another unforgettable late afternoon in this magical town.',
  'Cachoeira do Gavião Gonzaga no meio da mata atlântica serrana.': 'Gavião Gonzaga Waterfall deep in the mountain Atlantic Forest.',
  'Céu estrelado limpo de altitude na Pedra do Baú. Incomparável!': 'Crystal-clear high-altitude starry sky at Pedra do Baú. Incomparable!',
  'Brinde especial nas vinícolas das montanhas.': 'Special toast at the mountain wineries.',
  'Aquele cafezinho com strudel de maçã quentinho.': 'That afternoon coffee with warm apple strudel.',
  'Manhã linda em Campos do Jordão! 🌲☀️': 'Beautiful morning in Campos do Jordão! 🌲☀️',
  'Almoço perfeito no Capivari com fondue': 'Perfect lunch in Capivari with fondue',
  'Café quente e ar puro da serra ☕❄️': 'Hot coffee and crisp mountain air ☕❄️',
  'Luzes mágicas do Capivari à noite ✨': 'Magical Capivari lights at night ✨',
  'Passeio imperdível no teleférico!': 'Must-do cable car ride!',

  // Profile, XP, Explorer, Store, Supabase Live Records & All Remaining UI Strings
  'Viagens': 'Trips',
  'Nível': 'Level',
  'Explorador': 'Explorer',
  'Aventureiro': 'Adventurer',
  'Desbravador': 'Pathfinder',
  'Elite Monvian': 'Monvian Elite',
  'Lenda Monvian': 'Monvian Legend',
  'Explorador da Serra': 'Mountain Explorer',
  'Guia Local': 'Local Guide',
  'Mestre da Mantiqueira': 'Mantiqueira Master',
  'Lenda de Campos': 'Legend of Campos',
  'lugar descoberto': 'place discovered',
  'lugares descobertos': 'places discovered',
  'Nível máximo atingido na Serra!': 'Max level reached in the mountains!',
  'Destaques': 'Featured',
  'Destaque': 'Featured',
  'destaques': 'featured',
  'Recomendado': 'Recommended',
  'Recomendados': 'Recommended',
  'Mais procurados': 'Most Popular',
  'Casais': 'Couples',
  'Terror': 'Horror & Mystery',
  'Gastronomia': 'Gastronomy',
  'Hospedagem': 'Lodging',
  'Mirantes': 'Viewpoints',
  'Parques': 'Parks',
  'História': 'History',
  'Noturno': 'Nightlife',
  'dia': 'day',
  'dias': 'days',
  '1 dia': '1 day',
  '2 dias': '2 days',
  '3 dias': '3 days',
  'parada': 'stop',
  'paradas': 'stops',
  'Parada': 'Stop',
  'Paradas': 'Stops',
  'PARADAS': 'STOPS',
  'Roteiro': 'Itinerary',
  'Roteiros · Destaques': 'Itineraries · Featured',
  'Roteiros · Para descobrir': 'Itineraries · To discover',
  'Roteiros · Natureza': 'Itineraries · Nature',
  'Roteiros · Romântico': 'Itineraries · Romantic',
  'Roteiros · Casais': 'Itineraries · Couples',
  'Roteiros · Gastronomia': 'Itineraries · Gastronomy',
  'Roteiros · Terror': 'Itineraries · Horror & Mystery',
  'Roteiros · Família': 'Itineraries · Family',
  'Roteiros · Aventura': 'Itineraries · Adventure',
  'Roteiros · Cultura': 'Itineraries · Culture',
  'Roteiros · Recomendados': 'Itineraries · Recommended',
  'Roteiros · Mais procurados': 'Itineraries · Most Popular',
  'Experiências e Paradas': 'Experiences & Stops',
  'Dia 1: Experiências e Paradas': 'Day 1: Experiences & Stops',
  'Desfrute de um fim de semana romântico em meio à natureza de Campos do Jordão. Um roteiro especial para casais que desejam desacelerar, conhecer lugares encantadores, apreciar paisagens deslumbrantes e criar momentos inesquecíveis a dois. São 6 paradas cuidadosamente selecionadas para transformar cada momento em uma experiência especial.':
    'Enjoy a romantic weekend surrounded by the nature of Campos do Jordão. A special itinerary crafted for couples looking to slow down, discover enchanting places, admire breathtaking views, and create unforgettable moments together. Featuring 6 carefully selected stops to turn every moment into a special experience.',
  'Comece o passeio pela manhã, aproveitando a luz natural para tirar fotos e conhecer cada lugar com tranquilidade. Reserve um tempo para apreciar a paisagem, experimentar a gastronomia local e não tenha pressa entre as paradas. Minha dica é deixar o pôr do sol como um dos últimos momentos do roteiro: é o cenário perfeito para fechar o dia a dois. ❤️':
    'Start your tour in the morning, taking advantage of the natural light to take photos and explore each spot at an unhurried pace. Take time to admire the scenery, savor the local cuisine, and never rush between stops. My tip is to save the sunset for one of the final moments of the itinerary: it is the perfect backdrop to end the day together. ❤️',
  'O Tarundu é um dos principais parques de aventura de Campos do Jordão, cercado por uma extensa área de natureza e belas paisagens. O espaço reúne diversas atividades ao ar livre para diferentes idades, incluindo atrações de aventura, experiências em meio à natureza e momentos de lazer para toda a família. É uma ótima opção para quem deseja fugir do roteiro tradicional e aproveitar Campos do Jordão de uma forma mais divertida e ativa.':
    'Tarundu is one of Campos do Jordão’s premier adventure parks, surrounded by expansive nature and scenic landscapes. The park brings together outdoor activities for all ages, including adventure attractions, nature experiences, and family leisure. It is a great choice for anyone looking to step off the traditional path and enjoy Campos do Jordão in a more fun, active way.',
  'A Cervejaria Baden Baden é um dos destinos mais tradicionais de Campos do Jordão para quem aprecia cervejas artesanais e boa gastronomia. Com arquitetura inspirada no estilo europeu, o espaço combina um ambiente aconchegante com mesas ao ar livre, onde é possível degustar rótulos premiados enquanto aproveita o clima serrano da cidade. Além da experiência gastronômica, os visitantes podem conhecer a história da marca e participar da visita à fábrica, descobrindo como as cervejas são produzidas. É uma excelente opção para casais, grupos de amigos e turistas que desejam viver um dos passeios mais icônicos de Campos do Jordão.':
    'Baden Baden Brewery is one of Campos do Jordão’s most traditional destinations for lovers of craft beer and fine dining. With European-inspired architecture, the space combines a cozy atmosphere with outdoor seating where you can taste award-winning labels while enjoying the mountain climate. Beyond the culinary experience, visitors can learn the brand’s history and tour the brewery to see how the beers are crafted. It is an excellent choice for couples, friends, and travelers seeking one of Campos do Jordão’s most iconic outings.',
  'Mirante deslumbrante com vista panorâmica para a Serra da Mantiqueira.':
    'Breathtaking viewpoint with panoramic views of the Serra da Mantiqueira.',
  'Restaurante / Gastronomia': 'Restaurant / Gastronomy',
  'Chocolates & Doces': 'Chocolates & Sweets',
  'Chocolataria & Doces': 'Chocolate Shop & Sweets',
  'Morro': 'Hilltop Viewpoint',
  'Morro do elefante': 'Elephant Hill (Morro do Elefante)',
  'PARQUE CAPIVARI': 'Capivari Park',
  'Parque das cerejeiras': 'Cherry Blossom Park',
  'Ponte dos guardas chuvas': 'Umbrella Bridge',
  'Tirolesas, passeios a cavalo e arborismo no Tarundu.': 'Zip lines, horseback riding, and treetop courses at Tarundu.',
  'Passeio pelas passarelas da Ducha de Prata.': 'Stroll along the suspended walkways at Ducha de Prata.',
  'Foto tradicional de boas-vindas no Portal da Cidade.': 'Traditional welcome photo at the City Portal.',
  'Passeio completo pela Vila Capivari e almoço.': 'Complete walk through Vila Capivari and lunch.',
  'Atividades ao ar livre no Tarundu e cachoeiras da Ducha de Prata.': 'Outdoor activities at Tarundu and waterfalls at Ducha de Prata.',
  'Os roteiros mais bem avaliados pelos viajantes': 'Top-rated itineraries by travelers',
  'Jardins, bosques, cachoeiras e mirantes': 'Gardens, woods, waterfalls, and viewpoints',
  'Alta gastronomia alpina, fondues e chocolates': 'Alpine fine dining, fondues, and chocolates',
  'Trilhas, arvorismo e passeios radicais': 'Trails, treetop courses, and adventure tours',
  'Cafés coloniais e bistrôs acolhedores na montanha': 'Colonial cafes and cozy mountain bistros',
  'Ecoturismo & Aventura na Serra': 'Mountain Ecotourism & Adventure',
  'Bate-e-Volta: O Melhor de Campos em 24h': 'Day Trip: The Best of Campos in 24h',

  // Auth, Profile, Modals & Remaining JSX Strings
  'Conectando sua conta...': 'Connecting your account...',
  'Conectando sua conta…': 'Connecting your account…',
  'Alterar e-mail': 'Change email',
  'Adicione uma': 'Add a',
  'foto de perfil': 'profile photo',
  'Criar nova conta →': 'Create new account →',
  'Criar nova senha': 'Create new password',
  'Conta:': 'Account:',
  'Conta': 'Account',
  'Categorias': 'Categories',
  'Criar Story': 'Create Story',
  'Compartilhe seu momento': 'Share your moment',
  'Câmera': 'Camera',
  'Colagem': 'Collage',
  'Marcar Ponto em Campos': 'Tag a Spot in Campos',
  'Dispensar': 'Dismiss',
  'Canais diretos de atendimento': 'Direct support channels',
  'Plataforma digital de turismo, mobilidade e experiências em Campos do Jordão.':
    'Digital tourism, mobility, and experiences platform in Campos do Jordão.',
  'foi desenvolvido para oferecer aos visitantes e moradores de Campos do Jordão uma experiência de descoberta urbana e natural clara, precisa e integrada ao ecossistema iOS.':
    'was built to offer visitors and residents of Campos do Jordão a clear, accurate urban and nature discovery experience integrated with the iOS ecosystem.',
  'A plataforma reúne cartografia interativa em tempo real, curadoria de gastronomia, hotelaria, cafés, parques e atrações da Serra da Mantiqueira, roteiros estruturados por perfil de viagem e a comunidade fotográfica Monviangram.':
    'The platform brings together real-time interactive mapping, curated dining, hospitality, cafes, parks, and Serra da Mantiqueira attractions, travel-profile itineraries, and the Monviangram photo community.',
  'Aplicativo': 'Application',
  '★ Verificado': '★ Verified',
  'Desbloqueie o': 'Unlock',
  'Permissões do Dispositivo': 'Device Permissions',
  'Calcular rotas e proximidade de locais': 'Calculate routes and proximity to spots',
  'Sons do Aplicativo': 'App Sounds',
  'Efeitos sonoros e confirmações': 'Sound effects and confirmations',
  'Deseja encerrar a sessão?': 'Sign out of your account?',
  'Lugares Curtidos': 'Liked Places',
  'Salvo!': 'Saved!',
  'Toque no botão + no canto superior esquerdo e compartilhe sua primeira foto em Campos do Jordão!':
    'Tap the + button in the top left corner and share your first photo in Campos do Jordão!',
  'Publicar Primeira Foto': 'Post First Photo',
  'mais': 'more',
  'Carregando mais fotos...': 'Loading more photos...',
  'Você viu todas as fotos de Campos do Jordão ✨': 'You’ve seen all photos from Campos do Jordão ✨',
  'Respondendo a': 'Replying to',
  'Legenda': 'Caption',
  'selecionado': 'selected',
  'Rota': 'Route',
  'Dica de quem foi': 'Visitor tip',
  'de 5.0 estrelas': 'out of 5.0 stars',
  'Armazenados na nuvem no formato original enviado': 'Stored in the cloud in the original uploaded format',
  'Seu Nome ou Perfil': 'Your Name or Profile',
  'Expira em 24h': 'Expires in 24h',
  '1.628m • Altitude Média': '1,628m • Average Altitude',
  'Detalhes': 'Details',
  'O que deseja fazer?': 'What would you like to do?',
  'Criar Novo Roteiro': 'Create New Itinerary',
  'Data Escolhida': 'Selected Date',
  'Seu saldo é insuficiente para liberar este roteiro. Adicione Plátanos à sua carteira para continuar.':
    'Your balance is insufficient to unlock this itinerary. Add Plátanos to your wallet to continue.',
  'Lugares selecionados por guias': 'Guide-curated places',
  'Experiência': 'Experience',
  'Vídeos': 'Videos',
  'Aberto hoje': 'Open today',
  'Pôr do Sol': 'Sunset',
  'Lugares em Destaque': 'Featured Places',
  'Aberto 24 horas': 'Open 24 hours',
  'Não foi possível iniciar o pagamento no Stripe.': 'Could not start Stripe payment.',
  'Não foi possível concluir a compra.': 'Could not complete purchase.',
  'Sobre': 'About',
  'avaliações reais': 'real reviews',
  'avaliação real': 'real review',
  'avaliações': 'reviews',
  'avaliação': 'review',
  'Nota 1.0 selecionada': 'Rating 1.0 selected',
  'Nota 2.0 selecionada': 'Rating 2.0 selected',
  'Nota 3.0 selecionada': 'Rating 3.0 selected',
  'Nota 4.0 selecionada': 'Rating 4.0 selected',
  'Nota 5.0 selecionada': 'Rating 5.0 selected',
  '.0 selecionada': '.0 selected',
  'selecionada': 'selected',
  'Nota': 'Rating',
  'Salvando...': 'Saving...',
  'Visitante': 'Visitor',
  'Visitante Monvian': 'Monvian Visitor',
  'Visitante MONVIAN': 'MONVIAN Visitor',
  'Visitante de Campos': 'Campos Visitor',
  'Recente': 'Recent',
  'Recentes ▾': 'Recent ▾',
  'ontem': 'yesterday',
  'Ontem': 'Yesterday',
  'Consultar': 'Inquire',
  'Entrada Franca': 'Free Admission',
  'Acesso Livre': 'Free Access',
  'Ativar som': 'Unmute sound',
  'Desativar som': 'Mute sound',
  'Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!':
    'Bring a warm jacket, especially in the late afternoon, as the altitude makes temperatures drop quickly!',
  'Muito bom, recomendo a visita.': 'Very good, I recommend visiting.',
  'Mais Famoso': 'Most Famous',
  'Popular': 'Popular',
  'Eventos & Shows': 'Events & Shows',
  'Gastronomia & Folclore': 'Gastronomy & Folklore',
  'Desde 1943, um dos hotéis mais tradicionais e elegantes do Brasil. Rodeado por araucárias, oferece chalés suíços, spa L\'Occitane e alta gastronomia com lareiras acesas.':
    'Since 1943, one of Brazil’s most traditional and elegant hotels. Surrounded by araucaria pines, it offers Swiss chalets, an L’Occitane spa, and fine dining by warm fireplaces.',
  'Reserve algumas horas para conhecer o parque com calma e aproveite para fazer as atividades ao ar livre. Vá com roupas confortáveis e consulte previamente os horários e condições das atrações que deseja experimentar.':
    'Set aside a few hours to explore the park at an easy pace and enjoy the outdoor activities. Wear comfortable clothes and check the schedule and conditions of the attractions beforehand.',
  'Cachoeiras refrescantes, pontes de madeira e feirinha tradicional.':
    'Refreshing waterfalls, wooden bridges, and a traditional craft market.',
  'Criado sob medida para casais, unindo cenários apaixonantes, café especial em bosque com araucárias e fondue romântico.':
    'Tailor-made for couples, combining breathtaking scenery, specialty coffee in an araucaria forest, and romantic fondue.',
  'Recomendamos fazer reserva prévia nos restaurantes de fondue nos finais de semana.':
    'We recommend booking fondue restaurants in advance on weekends.',
  'Campos em Família: Diversão para Todas as Idades':
    'Family in Campos: Fun for All Ages',
  'Parques ao ar livre com segurança, arvorismo, tirolesas, contato com animais e cenários mágicos que encantam crianças e adultos.':
    'Safe outdoor parks, treetop courses, ziplines, animal encounters, and magical scenery that delight both kids and adults.',
  'Programe os passeios ao ar livre com calçados confortáveis e agasalhos para as crianças.':
    'Plan outdoor outings with comfortable footwear and warm layers for children.',
  'Dia Romântico Exclusivo': 'Exclusive Romantic Day',
  'Um dia aconchegante para viver momentos especiais na Serra da Mantiqueira.':
    'A cozy day to experience special moments in the Mantiqueira Mountains.',
  'Exploração de mirantes e fotografia panorâmica.':
    'Viewpoint exploration and panoramic photography.',
  'Experiência gastronômica completa com chopes nobres e chocolates artesanais.':
    'Complete culinary experience with craft draft beers and artisanal chocolates.',
  'Atividades recreativas dinâmicas ao ar livre com segurança total.':
    'Dynamic outdoor recreational activities with complete safety.',
  'Labirinto verde no Amantikir e passarelas na Ducha de Prata.':
    'Green maze at Amantikir and wooden walkways at Ducha de Prata.',
  'Passeio a dois pelos labirintos e jardins floridos.':
    'Romantic stroll for two through the mazes and blooming gardens.',
  'Chocolate quente e vista panorâmica para as montanhas no mirante.':
    'Hot chocolate and panoramic mountain views at the lookout.',
  'Jantar romântico com sequência de queijos e chocolates.':
    'Romantic dinner with cheese and chocolate fondue courses.',
  'Passarelas sobre a água e ar puro da serra.':
    'Walkways over the water and fresh mountain air.',
  'Mirantes e contemplação das cerejeiras.':
    'Viewpoints and cherry blossom contemplation.',
  'Almoço clássico com pratos alemães e chopes artesanais.':
    'Classic lunch with German dishes and craft beers.',
  'Passeio pelo boulevard com visita a cafés coloniais.':
    'Stroll along the boulevard visiting traditional mountain cafes.',
  'Chocolate quente cremoso e vista das montanhas.':
    'Creamy hot chocolate and mountain views.',
  'Mais de 30 atrações ao ar livre, tirolesas e passeios a cavalo.':
    'Over 30 outdoor attractions, ziplines, and horseback riding.',
  'Teleférico panorâmico e pedalinhos no lago central.':
    'Panoramic cable car and paddle boats on the central lake.',
  'Labirinto de arbustos verde e jardins de vários países.':
    'Green hedge maze and gardens inspired by different countries.',
  'Passarelas de madeira e tirolesa sobre as cachoeiras.':
    'Wooden walkways and zipline over the waterfalls.',
  'Arquitetura alpina iluminada ao cair da noite no centro do Capivari.':
    'Illuminated Alpine architecture at nightfall in downtown Capivari.',
  'Passeio refrescante na Ducha de Prata pelas passarelas de madeira.':
    'Refreshing walk at Ducha de Prata along the wooden walkways.',
  'Caminhada matinal pelo Parque da Lagoinha. O lago estava como um espelho.':
    'Morning walk through Lagoinha Park. The lake looked like a mirror.',
  'Serra da Mantiqueira coberta por nuvens baixas ao amanhecer.':
    'Mantiqueira Mountains covered by low clouds at dawn.',
  'Lojas de malhas e aconchego nas ruelas europeias do Capivari.':
    'Knitwear shops and cozy charm in the European alleys of Capivari.',
  'Casas enxaimel e pinheiros da Mantiqueira ao redor.':
    'Half-timbered houses surrounded by Mantiqueira pines.',
  'Fechando a viagem com chave de ouro: o mirante do Pico do Itapeva.':
    'Ending the trip on a high note: the Pico do Itapeva viewpoint.',
  'Tirada de qual mirante?': 'Taken from which viewpoint?',
  'O melhor fondue da serra!': 'The best fondue in the mountains!',
  'Um dos meus lugares favoritos de Campos.': 'One of my favorite places in Campos.',
  'Uau! Que foto espetacular!': 'Wow! What a spectacular photo!',
  'Subiu pela trilha da Ana Chata?': 'Did you hike up the Ana Chata trail?',
  'Pediu a cerveja de trigo e o pastel de truta?': 'Did you order the wheat beer and trout pastry?',
  'O ar puro daqui revigora qualquer um.': 'The fresh air here revitalizes everyone.',
  'Vinhos de altitude surpreendendo sempre.': 'High-altitude wines always impressing.',
  'Adoro o inverno rigoroso daqui!': 'I love the crisp winter here!',
  'Apresentação ao vivo e degustação especial no coração da Vila Capivari.':
    'Live performance and special tasting in the heart of Vila Capivari.',
  'Atendimento móvel de urgência 24 horas em Campos do Jordão.':
    '24-hour mobile emergency medical service in Campos do Jordão.',
  'Resgate, salvamento em montanha e emergências.':
    'Mountain rescue, fire department, and emergency response.',
  'Segurança pública e policiamento turístico.':
    'Public safety and tourist police assistance.',
  'Pronto atendimento médico municipal 24 horas.':
    '24-hour municipal emergency medical care.',
  'Melhor custo-benefício': 'Best value',
  'Visualizações': 'Views',
  'visualizações': 'views',
  'visualização': 'view',
  'Parcialmente nublado': 'Partly cloudy',
  'Tempo nublado': 'Cloudy',
  'Nevoeiro na serra': 'Mountain fog',
  'Pancadas de neve': 'Snow showers',
  'Tempestade com raios': 'Thunderstorm',
};

const normalizeLookupKey = (s: string): string =>
  s.trim().replace(/\s+/g, ' ').replace(/…/g, '...');

// Case-insensitive lookup index built lazily once
const PT_TO_EN_LOWER = new Map<string, string>();
for (const [pt, en] of Object.entries(PT_TO_EN_RAW)) {
  const key = normalizeLookupKey(pt).toLowerCase();
  if (!PT_TO_EN_LOWER.has(key)) {
    PT_TO_EN_LOWER.set(key, en);
  }
}

// Dynamic phrase templates (order matters: specific before general)
const DYNAMIC_RULES: Array<[RegExp, (...args: string[]) => string]> = [
  [/^Seja bem[\s-]vindo (.+)!$/i, (_m, name) => `Welcome ${name}!`],
  [/^Boas[\s-]vindas,\s*(.+)!$/i, (_m, name) => `Welcome, ${name}!`],
  [/^Olá,\s*(.+)$/i, (_m, name) => `Hello, ${name}`],
  [/^Nível\s+(\d+)\s*[·•-]\s*(.+)$/i, (_m, lvl, title) => `Level ${lvl} · ${translatePtToEn(title.trim())}`],
  [/^Nível\s+(\d+)$/i, (_m, lvl) => `Level ${lvl}`],
  [/^([\d.,]+)\s*avaliaç(?:ão|ões)\s+reais$/i, (_m, n) => `${n} real ${Number(n.replace(/[.,]/g, '')) === 1 ? 'review' : 'reviews'}`],
  [/^\(([\d.,]+)\s*avaliaç(?:ão|ões)\)$/i, (_m, n) => `(${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'review' : 'reviews'})`],
  [/^([\d.,]+)\s*avaliaç(?:ão|ões)$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'review' : 'reviews'}`],
  [/^Nota\s+([\d.,]+)\s+selecionada$/i, (_m, n) => `Rating ${n} selected`],
  [/^Avaliação registrada com sucesso!\s*Média atual:\s*([\d.,]+)\.?$/i, (_m, avg) => `Review submitted! Current average: ${avg}.`],
  [/^([\d.,]+)\s*estrelas?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'star' : 'stars'}`],
  [/^Vídeo\s+(\d+)\s+de\s+(\d+)$/i, (_m, a, b) => `Video ${a} of ${b}`],
  [/^([\d.,]+)\s*MB\s*[•·-]\s*Clique para trocar$/i, (_m, mb) => `${mb} MB • Tap to change`],
  [/^Ex:\s*Tour imperdível no\s+(.+)$/i, (_m, spot) => `E.g.: Must-see tour at ${spot}`],
  [/^([\d.,]+)\s*viajantes?\s+hoje$/i, (_m, n) => `${n} travelers today`],
  [/^([\d.,]+)\s*turistas?\s+já\s+usaram$/i, (_m, n) => `${n} travelers have used this`],
  [/^Permanência:\s*~?(\d+)\s*min$/i, (_m, min) => `Duration: ~${min} min`],
  [/^Você escolheu\s+(\d+)\s+experiências?\s+para\s+o\s+seu\s+roteiro\s+inteligente\s+em\s+Campos\s+do\s+Jordão\.?$/i, (_m, n) => `You selected ${n} ${Number(n) === 1 ? 'experience' : 'experiences'} for your smart itinerary in Campos do Jordão.`],
  [/^([\d.,]+)\s*lugar(?:es)?\s+descobertos?$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'place discovered' : 'places discovered'}`],
  [/^Faltam\s+([\d.,]+)\s*XP\s+para\s+o\s+próximo\s+nível$/i, (_m, xp) => `${xp} XP to next level`],
  [/^Paradas\s*\(([\d.,]+)\)$/i, (_m, n) => `Stops (${n})`],
  [/^Resultados\s*\(([\d.,]+)\)$/i, (_m, n) => `Results (${n})`],
  [/^Roteiros\s*[·•]\s*(.+)$/i, (_m, cat) => `Itineraries · ${translatePtToEn(cat.trim())}`],
  [/^(\d+(?:[.,]\d+)?)\s*mil$/i, (_m, n) => `${n.replace(',', '.')}k`],
  [/^([\d.,]+)\s*paradas?$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'stop' : 'stops'}`],
  [/^([\d.,]+)\s*dias?$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'day' : 'days'}`],
  [/^([\d.,]+)\s*lugar(?:es)?$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'place' : 'places'}`],
  [/^([\d.,]+)\s*curtidas?$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'like' : 'likes'}`],
  [/^Ver todos os ([\d.,]+) comentários$/i, (_m, n) => `View all ${n} comments`],
  [/^Você poderá entrar novamente a qualquer momento com sua conta (.+)\.$/i, (_m, email) => `You can sign back in anytime with your account ${email}.`],
  [/^Libera até ([\d.,]+) roteiros? premium$/i, (_m, n) => `Unlocks up to ${n} premium ${Number(n) === 1 ? 'itinerary' : 'itineraries'}`],
  [/^(\d+)\s+de\s+(\d+)$/i, (_m, a, b) => `${a} of ${b}`],
  [/^Dia (\d+):\s*(.+)$/i, (_m, d, rest) => `Day ${d}: ${translatePtToEn(rest)}`],
  [/^Dia (\d+)\s*[•·-]\s*Dia (\d+)$/i, (_m, d1, d2) => `Day ${d1} • Day ${d2}`],
  [/^Dia (\d+)$/i, (_m, d) => `Day ${d}`],
  [/^Ponto (\d+)$/i, (_m, n) => `Stop ${n}`],
  [/^Local (\d+):\s*(.+)$/i, (_m, n, rest) => `Stop ${n}: ${translatePtToEn(rest)}`],
  [/^Local (\d+)$/i, (_m, n) => `Stop ${n}`],
  [/^Parada (\d+)$/i, (_m, n) => `Stop ${n}`],
  [/^(.+?)\.\s*Deslize para a esquerda para excluir\.$/i, (_m, prefix) => `${translatePtToEn(prefix)}. Swipe left to delete.`],
  [/^(\d+)\s*min até o próximo (?:ponto|local)$/i, (_m, min) => `${min} min to next stop`],
  [/^([\d.,]+)\s*locais planejados$/i, (_m, n) => `${n} planned spots`],
  [/^([\d.,]+)\s*local planejado$/i, (_m, n) => `${n} planned spot`],
  [/^([\d.,]+)\s*locais encontrados$/i, (_m, n) => `${n} spots found`],
  [/^([\d.,]+)\s*local encontrado$/i, (_m, n) => `${n} spot found`],
  [/^([\d.,]+)\s*opções disponíveis$/i, (_m, n) => `${n} options available`],
  [/^([\d.,]+)\s*opção disponível$/i, (_m, n) => `${n} option available`],
  [/^([\d.,]+)\s*adultos?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'adult' : 'adults'}`],
  [/^([\d.,]+)\s*crianças?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'child' : 'children'}`],
  [/^([\d.,]+)\s*visualizações?$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'view' : 'views'}`],
  [/^([\d.,]+)\s*visualização$/i, (_m, n) => `${n} view`],
  [/^([\d.,]+)\s*publica(?:ção|ções)$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'post' : 'posts'}`],
  [/^Ver ([\d.,]+) comentários?$/i, (_m, n) => `View ${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'comment' : 'comments'}`],
  [/^([\d.,]+)\s*comentários?$/i, (_m, n) => `${n} ${Number(n.replace(/[.,]/g, '')) === 1 ? 'comment' : 'comments'}`],
  [/^Há (\d+) dias?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'day' : 'days'} ago`],
  [/^HÁ (\d+) DIAS?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'DAY' : 'DAYS'} AGO`],
  [/^HÁ (\d+) HORAS?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'HOUR' : 'HOURS'} AGO`],
  [/^HÁ (\d+) MIN$/i, (_m, n) => `${n} MIN AGO`],
  [/^há (\d+)d$/i, (_m, n) => `${n}d ago`],
  [/^há (\d+)h$/i, (_m, n) => `${n}h ago`],
  [/^há (\d+)m$/i, (_m, n) => `${n}m ago`],
  [/^Há (\d+) semanas?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'week' : 'weeks'} ago`],
  [/^Há (\d+) horas?$/i, (_m, n) => `${n} ${Number(n) === 1 ? 'hour' : 'hours'} ago`],
  [/^Há (\d+) min(uto)?s?$/i, (_m, n) => `${n} min ago`],
  [/^Instruções enviadas para (.+)$/i, (_m, email) => `Instructions sent to ${email}`],
  [/^Local "(.+)" adicionado ao roteiro!$/i, (_m, name) => `"${name}" added to itinerary!`],
  [/^Respondendo a (.+)$/i, (_m, user) => `Replying to ${user}`],
  [/^Você chegou (?:ao|à|aos|às) (.+)$/i, (_m, place) => `You arrived at ${place}`],
  [/^Roteiro Personalizado de (\d+) Dias em Campos do Jordão$/i, (_m, n) => `Custom ${n}-Day Itinerary in Campos do Jordão`],
  [/^Experiência em Campos do Jordão \(1 Dia\)$/i, () => `Campos do Jordão Experience (1 Day)`],
  [/^Experiência em (.+)$/i, (_m, place) => `Experience at ${place}`],
  [/^Campos do Jordão:\s*(.+)$/i, (_m, cond) => `Campos do Jordão: ${translatePtToEn(cond)}`],
  [/^Todos os dias das (.+) às (.+)$/i, (_m, a, b) => `Daily ${a}–${b}`],
  [/^Aberto diariamente das (.+) às (.+)$/i, (_m, a, b) => `Open daily ${a}–${b}`],
  [/^Diariamente das (.+) às (.+)$/i, (_m, a, b) => `Daily ${a}–${b}`],
  [/^Segunda a Domingo das (.+) às (.+)$/i, (_m, a, b) => `Mon–Sun ${a}–${b}`],
  [/^Terça a Domingo das (.+) às (.+)$/i, (_m, a, b) => `Tue–Sun ${a}–${b}`],
  [/^Quarta a Domingo das (.+) às (.+)$/i, (_m, a, b) => `Wed–Sun ${a}–${b}`],
  [/^Segunda a Sábado (.+) \| Domingo (.+)$/i, (_m, a, b) => `Mon–Sat ${a} | Sun ${b}`],
  [/^Domingo a Quinta (.+) \| Sex e Sáb (.+)$/i, (_m, a, b) => `Sun–Thu ${a} | Fri & Sat ${b}`],
  [/^Finais de semana e feriados das (.+) às (.+)$/i, (_m, a, b) => `Weekends & holidays ${a}–${b}`],
  [/^Temporada de Julho e Finais de Semana das (.+) às (.+)$/i, (_m, a, b) => `July season & weekends ${a}–${b}`],
  [/^(\d{1,2}:\d{2})\s+às\s+(\d{1,2}:\d{2})$/i, (_m, a, b) => `${a} to ${b}`],
  [/^Aberto 24 horas \((.+)\)$/i, (_m, inner) => `Open 24 hours (${translatePtToEn(inner)})`],
  [/^Centro de turismo:\s*(.+)$/i, (_m, h) => `Tourist center: ${h}`],
  [/^Atendimento aos restaurantes sob reserva$/i, () => `Restaurant dining by reservation`],
  [/^Protocolo de registro:\s*(.+)$/i, (_m, p) => `Reference number: ${p}`],
  [/^Protocolo:\s*(.+)$/i, (_m, p) => `Reference: ${p}`],
  [/^Compreendo que esta operação é irreversível e que minha conta \((.+)\) e os dados associados serão excluídos\.$/i, (_m, acc) => `I understand that this operation is irreversible and that my account (${acc}) and associated data will be deleted.`],
];

// High-frequency standalone month/day replacements for calendar headers and dates
const WORD_PHRASES: Array<[RegExp, string]> = [
  [/\bJaneiro\b/g, 'January'],
  [/\bFevereiro\b/g, 'February'],
  [/\bMarço\b/g, 'March'],
  [/\bAbril\b/g, 'April'],
  [/\bMaio\b/g, 'May'],
  [/\bJunho\b/g, 'June'],
  [/\bJulho\b/g, 'July'],
  [/\bAgosto\b/g, 'August'],
  [/\bSetembro\b/g, 'September'],
  [/\bOutubro\b/g, 'October'],
  [/\bNovembro\b/g, 'November'],
  [/\bDezembro\b/g, 'December'],
  [/\bDom\b/g, 'Sun'],
  [/\bSeg\b/g, 'Mon'],
  [/\bTer\b/g, 'Tue'],
  [/\bQua\b/g, 'Wed'],
  [/\bQui\b/g, 'Thu'],
  [/\bSex\b/g, 'Fri'],
  [/\bSáb\b/g, 'Sat'],
];

export function translatePtToEn(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2) return raw;
  // Skip URLs, emails, pure numbers, single tokens like @user or R$
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ||
    /^@[A-Za-z0-9_.]+$/.test(trimmed) ||
    /^[0-9.,:%+\-\s°/·•()]+$/.test(trimmed)
  ) {
    return raw;
  }

  const lead = raw.match(/^\s*/)?.[0] ?? '';
  const trail = raw.match(/\s*$/)?.[0] ?? '';
  const normalized = normalizeLookupKey(trimmed);

  // 1. Exact dictionary match
  const exact = PT_TO_EN_RAW[trimmed] ?? PT_TO_EN_RAW[normalized];
  if (exact) {
    return `${lead}${exact}${trail}`;
  }

  // 2. Case-insensitive match preserving uppercase styling if source was ALL CAPS
  const lowerMatch = PT_TO_EN_LOWER.get(normalized.toLowerCase());
  if (lowerMatch) {
    const isAllUpper =
      trimmed.length > 2 &&
      trimmed === trimmed.toUpperCase() &&
      trimmed !== trimmed.toLowerCase();
    return `${lead}${isAllUpper ? lowerMatch.toUpperCase() : lowerMatch}${trail}`;
  }

  // 3. Dynamic regex template matching
  for (const [regex, replacer] of DYNAMIC_RULES) {
    const match = normalized.match(regex);
    if (match) {
      const result = replacer(...match);
      if (result && result !== normalized) {
        const isAllUpper =
          trimmed.length > 2 &&
          trimmed === trimmed.toUpperCase() &&
          trimmed !== trimmed.toLowerCase();
        return `${lead}${isAllUpper ? result.toUpperCase() : result}${trail}`;
      }
    }
  }

  // 4. Compound strings with · or • separators (including leading/trailing separators)
  if (/[·•]/.test(normalized)) {
    const parts = normalized.split(/(\s*[·•]\s*)/);
    if (parts.length > 1) {
      let changed = false;
      const mapped = parts.map((part) => {
        if (!part || /^\s*[·•]\s*$/.test(part)) return part;
        const trPart = translatePtToEn(part);
        if (trPart !== part) changed = true;
        return trPart;
      });
      if (changed) {
        return `${lead}${mapped.join('')}${trail}`;
      }
    }
  }

  // 5. Calendar month/weekday token replacement when standalone or short date label
  if (normalized.length <= 36) {
    let replaced = normalized;
    for (const [rx, en] of WORD_PHRASES) {
      replaced = replaced.replace(rx, en);
    }
    if (replaced !== normalized) {
      return `${lead}${replaced}${trail}`;
    }
  }

  return raw;
}

import { translatePtToEs } from './ptToEsDictionary';
import { translatePtToJa } from './ptToJaDictionary';

export type SupportedAppLanguage = 'pt' | 'en' | 'es' | 'ja';

export function translateFromPt(raw: string, lang: SupportedAppLanguage): string {
  if (!raw || lang === 'pt') return raw;
  if (lang === 'en') return translatePtToEn(raw);
  if (lang === 'es') return translatePtToEs(raw);
  if (lang === 'ja') return translatePtToJa(raw);
  return raw;
}


