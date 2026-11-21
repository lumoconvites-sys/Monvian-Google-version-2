# Aplicar cor #7FFFD4 na frase 'Campos do Jordão do seu jeito'

- **Agente Responsável**: Gabriel Nogueira (Desenvolvimento)
- **Aprovado em**: 2026-11-21T20:13:55.642Z
- **Nota do Proprietário**: Missão aprovada pelo proprietário e autorizada para sincronização.

---

### Status da Execução e Lacunas Identificadas

Não foi possível concluir a alteração diretamente no repositório porque **este ambiente não possui ferramentas de acesso ao GitHub, terminal (`git`/`gh`) ou sistema de arquivos**. Em razão disso, não há como:

1. Acessar o repositório `https://github.com/lumoconvites-sys/Monvian-Google-version-2`.
2. Inspecionar os arquivos-fonte para localizar exatamente onde a frase `"Campos do Jordão do seu jeito"` está definida e qual solução de estilização o projeto utiliza (Tailwind CSS, CSS Modules, `styled-components`, CSS global ou estilo inline).
3. Criar a branch isolada, validar build/testes/lint e abrir o Pull Request para aprovação.

---

### Escopo da Tarefa e Impacto no Catálogo MONVI

* **Tipo de tarefa:** Alteração exclusivamente visual (aplicação da cor hexadecimal `#7FFFD4` no texto `"Campos do Jordão do seu jeito"`).
* **Estabelecimentos de Campos do Jordão:** Esta demanda **não inclui nem modifica estabelecimentos**; portanto, não há novos registros a validar ou confrontar para checagem de duplicidade com o catálogo atual (`Hotel Toriba`, `Grande Hotel Campos do Jordão`, `Baden Baden Choperia`, `Parque Amantikir`).

---

### Plano Técnico para Execução (sem commit na `main`)

Assim que houver acesso ao repositório (ou caso você cole aqui o arquivo onde a frase aparece), o fluxo seguro para aplicar a mudança é:

#### 1. Criar branch isolada a partir da `main` atualizada
```bash
git checkout main
git pull origin main
git checkout -b feat/cor-titulo-campos-do-jordao
```

#### 2. Localizar a frase no código-fonte
```bash
git grep -n "Campos do Jordão do seu jeito"
```

#### 3. Aplicar a cor `#7FFFD4` conforme o padrão do componente
*(Os trechos abaixo são apenas referências genéricas, pois o código real do repositório não pôde ser lido neste ambiente.)*

* **Se o projeto usar Tailwind CSS:**
```tsx
<span className="text-[#7FFFD4]">Campos do Jordão do seu jeito</span>
```
* **Se o projeto usar estilo inline em React/TypeScript:**
```tsx
<span style={{ color: '#7FFFD4' }}>Campos do Jordão do seu jeito</span>
```
* **Se o projeto usar CSS / CSS Modules:**
```css
.destaqueTitulo {
  color: #7FFFD4;
}
```

> **Observação de acessibilidade/contraste:** `#7FFFD4` (aquamarine claro) possui bom contraste sobre fundos escuros, mas baixo contraste sobre fundos brancos ou muito claros. Caso o texto esteja sobre fundo claro ou imagem, recomenda-se verificar visualmente a legibilidade antes do merge.

#### 4. Validar, commitar e abrir o Pull Request
```bash
# Executar validação de tipos/lint/build conforme scripts do package.json do projeto
npm run build

git status
git add <arquivo-alterado>
git commit -m "style: aplica cor #7FFFD4 na frase Campos do Jordão do seu jeito"
git push -u origin feat/cor-titulo-campos-do-jordao
```

Em seguida, abrir o Pull Request da branch `feat/cor-titulo-campos-do-jordao` para `main` solicitando aprovação do proprietário.

---

### Próximo Passo Sugerido

Se quiser que eu gere o **diff exato** pronto para aplicação no arquivo correto, cole aqui o conteúdo do componente/arquivo onde está a frase `"Campos do Jordão do seu jeito"` (e o `package.json`, se desejar confirmar a stack de estilização).
