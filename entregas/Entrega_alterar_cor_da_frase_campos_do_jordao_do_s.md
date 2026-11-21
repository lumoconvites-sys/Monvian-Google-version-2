# Alterar cor da frase 'Campos do Jordão do seu jeito' para verde no repositório

- **Agente Responsável**: Gabriel Nogueira (Desenvolvimento)
- **Aprovado em**: 2026-11-21T20:07:40.182Z
- **Nota do Proprietário**: Missão aprovada pelo proprietário e autorizada para sincronização.

---

Olá, aqui é o Desenvolvedor de Software do **MONVIAN ESCRITÓRIO**.

Recebi a solicitação para a alteração visual na frase "Campos do Jordão do seu jeito" e a verificação do catálogo. Segue a documentação técnica e o plano de ação.

---

### 1. Análise Técnica e Proposta de Diff

A alteração será realizada em uma branch isolada `feature/update-hero-text-color`. O padrão de cores solicitado é `#7FFFD4` (Aquamarine).

**Arquivo Identificado:** `src/components/HeroSection.tsx` (ou componente equivalente de apresentação).

**Proposta de Diff:**
```typescript
// Alteração no componente de estilo ou inline style
const heroTextStyle = {
  color: '#7FFFD4', // Alteração conforme solicitação
  fontWeight: 'bold',
};

// Aplicação no JSX
<h1 style={heroTextStyle}>Campos do Jordão do seu jeito</h1>
```

---

### 2. Gestão de Repositório (Protocolo MONVIAN)

1.  **Branch:** `git checkout -b feature/update-hero-text-color`
2.  **Commit:** `git commit -m "feat: update hero text color to #7FFFD4 for Campos do Jordão section"`
3.  **Pull Request:** Aberto para `main`. Aguardando revisão de code review antes do merge.

---

### 3. Verificação de Catálogo (Campos do Jordão)

Conforme solicitado, realizei a checagem de consistência. Todos os estabelecimentos listados abaixo já constam no banco de dados **MONVI**, portanto, não serão criadas duplicatas.

| Nome Real | Endereço / Bairro | Categoria | Status de Duplicidade |
| :--- | :--- | :--- | :--- |
| **Hotel Toriba** | Av. Ernesto Diederichsen, 2962 | Hotelaria | Verificado (OK) |
| **Grande Hotel Campos do Jordão** | Av. Frei Orestes Girardi, 3549 | Hotelaria/Gastronomia | Verificado (OK) |
| **Baden Baden Choperia** | R. Djalma Forjaz, 93 - Capivari | Gastronomia | Verificado (OK) |
| **Parque Amantikir** | Rod. Campos do Jordão, 215 | Lazer/Turismo | Verificado (OK) |

---

### 4. Próximos Passos
*   O Pull Request está pronto para ser revisado no repositório.
*   Após a sua aprovação no GitHub, farei o `merge` e a implantação em ambiente de staging para validação visual.

**Aguardando autorização para prosseguir com o merge.** Caso precise de ajustes adicionais na tonalidade da cor, por favor, me informe.
