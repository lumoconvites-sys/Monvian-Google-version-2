# Alterar cor da frase para verde no repositório

- **Agente Responsável**: Gabriel Nogueira (Desenvolvimento)
- **Aprovado em**: 2026-11-21T19:57:27.865Z
- **Nota do Proprietário**: Missão aprovada pelo proprietário e autorizada para sincronização.

---

### Status da Execução e Limitação de Acesso

Não possuo acesso à internet, ao GitHub ou a ferramentas de sistema de arquivos neste ambiente de execução. Por esse motivo, **não foi possível**:
- Clonar ou ler os arquivos do repositório `https://github.com/lumoconvites-sys/Monvian-Google-version-2`;
- Confirmar o caminho exato do componente e o sistema de estilização utilizado (ex.: Tailwind CSS, CSS Modules, Styled Components ou CSS tradicional);
- Criar a branch remota, aplicar o commit ou abrir o Pull Request diretamente no GitHub.

Abaixo está a entrega técnica estruturada com os passos exatos, os padrões de diff em TypeScript/React e o modelo de Pull Request pronto para execução e aprovação assim que houver acesso ao repositório.

---

### 1. Análise Técnica e Checagem do Catálogo MONVI

- **Tipo de alteração:** Ajuste exclusivo de interface/estilização (UI) na frase `"Campos do Jordão do seu jeito"`.
- **Impacto no Catálogo MONVI:** Nenhum estabelecimento novo está sendo cadastrado ou editado nesta tarefa. Não há risco de duplicidade em relação aos registros existentes (*Hotel Toriba*, *Grande Hotel Campos do Jordão*, *Baden Baden Choperia* e *Parque Amantikir*).
- **Regra de versionamento:** A alteração deve ser feita em uma **branch isolada**, com merge na `main` condicionado à aprovação via Pull Request.

---

### 2. Procedimento para Execução em Branch Isolada

Execute os comandos abaixo localmente no repositório clonado:

```bash
# 1. Garantir que a base está atualizada a partir da main
git checkout main
git pull origin main

# 2. Criar branch isolada (nunca commitar direto na main)
git checkout -b style/frase-verde-campos-do-jordao

# 3. Localizar exatamente onde a frase está declarada
git grep -n "Campos do Jordão do seu jeito"
```

---

### 3. Proposta de Diff (TypeScript / React)

Como o código-fonte do repositório não pôde ser lido, valide qual padrão de estilo o componente encontrado utiliza e aplique o diff correspondente (mantendo o restante do componente inalterado):

#### Cenário A: Projeto utilizando Tailwind CSS
Substitua a classe de cor atual (ex.: `text-gray-900`, `text-slate-700`, `text-white` etc.) pela tonalidade verde padrão do projeto (ex.: `text-green-600` ou o token verde da identidade visual do MONVI):

```diff
- <p className="text-lg text-gray-800">
+ <p className="text-lg text-green-600">
    Campos do Jordão do seu jeito
  </p>
```

#### Cenário B: Projeto utilizando CSS tradicional / CSS Modules
Adicione ou atualize a regra de cor no arquivo `.css` / `.module.css` associado ao componente (respeitando o token de cor verde do design system, se houver):

```diff
  .hero-subtitle {
-   color: #333333;
+   color: #16a34a; /* Verde - ajustar para o token oficial do projeto, se existente */
  }
```

#### Cenário C: Estilização inline no TSX
```diff
- <span style={{ color: '#000000' }}>Campos do Jordão do seu jeito</span>
+ <span style={{ color: '#16a34a' }}>Campos do Jordão do seu jeito</span>
```

> **Ponto de atenção antes do commit:** Verifique contraste de acessibilidade (WCAG) da cor verde escolhida contra a cor de fundo onde a frase é exibida e rode o build/lint do projeto (`npm run build` / `npm run lint`) para assegurar ausência de erros de TypeScript.

---

### 4. Comandos para Publicação e Solicitação de Pull Request

```bash
# Validar alterações
git status
git diff

# Criar commit limpo
git add <caminho-do-arquivo-alterado>
git commit -m "style: altera cor da frase 'Campos do Jordão do seu jeito' para verde"

# Enviar branch isolada para o repositório remoto
git push -u origin style/frase-verde-campos-do-jordao
```

---

### 5. Modelo de Pull Request (Para Aprovação do Proprietário)

- **Base:** `main` ← **Compare:** `style/frase-verde-campos-do-jordao`
- **Título:** `style: altera cor da frase "Campos do Jordão do seu jeito" para verde`
- **Descrição:**

```markdown
## Resumo
Atualiza a estilização da frase `"Campos do Jordão do seu jeito"` para a cor verde, conforme solicitado.

## Alterações realizadas
- Localizada a ocorrência da frase `"Campos do Jordão do seu jeito"` em `<inserir caminho do arquivo alterado>`.
- Atualizada a cor do texto para verde (`<inserir classe/hex aplicado>`).

## Checklist
- [x] Alteração isolada em branch dedicada (`style/frase-verde-campos-do-jordao`), sem commit direto na `main`.
- [ ] Build TypeScript/React validado sem erros.
- [ ] Contraste visual verificado na tela em desktop e mobile.
- [ ] Aguardando revisão e aprovação do proprietário para merge na `main`.
```

Se desejar que eu gere o diff exato com nome de arquivo, linhas e token de cor oficial do projeto, cole aqui o conteúdo do arquivo onde `git grep -n "Campos do Jordão do seu jeito"` encontrou a frase (e o `tailwind.config.*` ou arquivo CSS correspondente).
