import React from 'react';

/**
 * Parses inline formatting like **bold**, *italic*, __bold__, and strips raw markdown artifacts.
 */
export function renderInlineFormatted(text: string): React.ReactNode {
  if (!text) return null;

  // Clean raw backticks or code artifacts
  let cleanText = text.replace(/`{1,3}/g, '').trim();

  // Pattern to extract **bold** and *italic*
  // Splits on tokens while preserving delimiter matches
  const tokens = cleanText.split(/(\*\*[^*]+?\*\*|__[^_]+?__|\*[^*]+?\*|_[^_]+?_)/g);

  return tokens.map((part, index) => {
    if (!part) return null;

    if (
      (part.startsWith('**') && part.endsWith('**') && part.length > 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length > 4)
    ) {
      const boldContent = part.slice(2, -2);
      return (
        <strong key={index} className="font-black text-zinc-900 dark:text-white">
          {boldContent}
        </strong>
      );
    }

    if (
      (part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length > 2)
    ) {
      const italicContent = part.slice(1, -1);
      return (
        <em key={index} className="italic text-zinc-800 dark:text-zinc-200">
          {italicContent}
        </em>
      );
    }

    // Clean any stray single asterisks or leading bullet dashes
    const textNode = part.replace(/\*/g, '');
    return <span key={index}>{textNode}</span>;
  });
}

/**
 * Strips all markdown syntax from a string to get plain clean text.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^#+\s*/g, '')
    .replace(/^[-*•]\s*/g, '')
    .replace(/`+/g, '')
    .trim();
}

/**
 * Contextual icon picker for spots, food, tips, etc.
 */
export function getContextIcon(title: string, desc: string = ''): string {
  const t = (title + ' ' + desc).toLowerCase();
  if (t.includes('restaurante') || t.includes('fondue') || t.includes('truta') || t.includes('gastronom') || t.includes('jantar') || t.includes('almoço')) return '🍽️';
  if (t.includes('café') || t.includes('cafe') || t.includes('chocolate') || t.includes('doce') || t.includes('bombom') || t.includes('chocolat')) return '☕';
  if (t.includes('hotel') || t.includes('pousada') || t.includes('chalé') || t.includes('hosped')) return '🏨';
  if (t.includes('parque') || t.includes('jardim') || t.includes('amantikir') || t.includes('horto') || t.includes('natureza')) return '🌲';
  if (t.includes('mirante') || t.includes('itapeva') || t.includes('pôr do sol') || t.includes('teleférico') || t.includes('vista') || t.includes('elefante')) return '🌄';
  if (t.includes('cerveja') || t.includes('baden') || t.includes('bar') || t.includes('chope')) return '🍻';
  if (t.includes('aventura') || t.includes('tarundu') || t.includes('tirolesa') || t.includes('passeio')) return '🧗';
  if (t.includes('dica') || t.includes('importante') || t.includes('atenção')) return '💡';
  return '📍';
}

/**
 * Period helper to get label, normalized type, and icon.
 */
function getPeriodMeta(rawHeader: string): { label: string; icon: string; key: string } | null {
  const lower = rawHeader.toLowerCase();

  if (lower.includes('manhã') || lower.includes('manha')) {
    return { label: 'Manhã', icon: '☀️', key: 'manha' };
  }
  if (lower.includes('final de tarde') || lower.includes('pôr do sol') || lower.includes('entardecer')) {
    return { label: 'Pôr do Sol & Fim de Tarde', icon: '🌇', key: 'fim_tarde' };
  }
  if (lower.includes('tarde') || lower.includes('almoço')) {
    return { label: 'Tarde', icon: '🌅', key: 'tarde' };
  }
  if (lower.includes('noite') || lower.includes('jantar') || lower.includes('madrugada')) {
    return { label: 'Noite', icon: '🌙', key: 'noite' };
  }

  return null;
}

// Data structures for parsed blocks
export interface ParsedPeriod {
  periodLabel: string;
  icon: string;
  content: string;
}

export interface ParsedDay {
  dayLabel: string;
  periods: ParsedPeriod[];
}

export interface ParsedItem {
  index?: number;
  icon: string;
  title: string;
  description: string;
}

export interface ParsedTip {
  title: string;
  content: string;
}

export interface ParsedHeader {
  title: string;
  subtitle?: string;
}

export type ParsedBlock =
  | { type: 'header'; data: ParsedHeader }
  | { type: 'itinerary_day'; data: ParsedDay }
  | { type: 'item_card'; data: ParsedItem }
  | { type: 'tip_card'; data: ParsedTip }
  | { type: 'paragraph'; data: string };

/**
 * Main parser that parses any AI response text into structured, visual blocks.
 */
export function parseAIMessage(rawText: string): ParsedBlock[] {
  if (!rawText) return [];

  // Normalize linebreaks
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd());

  const blocks: ParsedBlock[] = [];
  let currentDay: ParsedDay | null = null;
  let currentPeriod: ParsedPeriod | null = null;
  let paragraphAcc: string[] = [];

  const flushParagraph = () => {
    if (paragraphAcc.length > 0) {
      const text = paragraphAcc.join(' ').trim();
      if (text) {
        blocks.push({ type: 'paragraph', data: text });
      }
      paragraphAcc = [];
    }
  };

  const flushPeriod = () => {
    if (currentPeriod && currentDay) {
      currentDay.periods.push(currentPeriod);
      currentPeriod = null;
    }
  };

  const flushDay = () => {
    flushPeriod();
    if (currentDay) {
      blocks.push({ type: 'itinerary_day', data: currentDay });
      currentDay = null;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty line separates paragraphs or sections
    if (!trimmed) {
      if (currentPeriod && paragraphAcc.length > 0) {
        currentPeriod.content += (currentPeriod.content ? '\n' : '') + paragraphAcc.join(' ').trim();
        paragraphAcc = [];
      } else {
        flushParagraph();
      }
      i++;
      continue;
    }

    const plain = stripMarkdown(trimmed);

    // 1. Detect Day Headers: "Dia 1", "Dia 2", "1º Dia", "📅 DIA 1", "Dia 1:", "**Dia 1:**"
    const dayMatch = plain.match(/^(?:📅\s*)?(?:dia\s*([0-9]+)|([0-9]+)[ºoªa]\s*dia|primeiro\s*dia|segundo\s*dia|terceiro\s*dia)(?:\s*[-:–]\s*(.*))?$/i);
    if (dayMatch) {
      flushParagraph();
      flushDay();

      const dayNum = dayMatch[1] || dayMatch[2] || (plain.toLowerCase().includes('primeiro') ? '1' : plain.toLowerCase().includes('segundo') ? '2' : '');
      const extraTitle = dayMatch[3] ? ` • ${dayMatch[3].trim()}` : '';
      const dayLabel = dayNum ? `DIA ${dayNum}${extraTitle}` : plain.toUpperCase();

      currentDay = {
        dayLabel,
        periods: [],
      };
      i++;
      continue;
    }

    // 2. Detect Periods: "Manhã", "Tarde", "Noite", "Final de tarde"
    // Can appear as: "- **Manhã:** Conteúdo...", "☀️ Manhã: Conteúdo...", "**Manhã:**", etc.
    const periodCheck = plain.match(/^(?:[-*•]\s*)?(?:☀️|🌅|🌇|🌙)?\s*(manhã|manha|tarde|noite|pôr do sol|final de tarde|madrugada)(?:\s*[-:–]\s*(.*))?$/i);
    if (periodCheck) {
      flushParagraph();
      const periodMeta = getPeriodMeta(periodCheck[1]);
      if (periodMeta) {
        flushPeriod();

        let inlineContent = '';
        const matchAfterPeriod = trimmed.match(
          /^(?:[-*•]\s*)?(?:\*\*)?(?:☀️|🌅|🌇|🌙)?\s*(?:manhã|manha|tarde|noite|pôr do sol|final de tarde|madrugada)(?:\*\*)?(?:\s*[-:–]\s*(.*))?$/i
        );
        if (matchAfterPeriod && matchAfterPeriod[1]) {
          inlineContent = matchAfterPeriod[1].trim();
        } else if (periodCheck[2]) {
          inlineContent = periodCheck[2].trim();
        }
        // Strip any leading artifact like `** ` or `: `
        inlineContent = inlineContent.replace(/^[\*:\s–-]+/, '').trim();

        const newPeriod: ParsedPeriod = {
          periodLabel: periodMeta.label,
          icon: periodMeta.icon,
          content: inlineContent,
        };

        if (currentDay) {
          currentPeriod = newPeriod;
        } else {
          // If no Day was started, create a standalone or pseudo day
          currentDay = {
            dayLabel: 'ROTEIRO SUGERIDO',
            periods: [newPeriod],
          };
          currentPeriod = newPeriod;
        }
        i++;
        continue;
      }
    }

    // If currently inside a period and line is continuation
    if (currentPeriod && !trimmed.startsWith('#') && !trimmed.match(/^[0-9]+[\.\)]/) && !trimmed.startsWith('💡')) {
      // Check if it's a bullet inside the period
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
        const bulletText = trimmed.slice(2).trim();
        currentPeriod.content += (currentPeriod.content ? '\n' : '') + bulletText;
      } else {
        currentPeriod.content += (currentPeriod.content ? ' ' : '') + trimmed;
      }
      i++;
      continue;
    }

    // 3. Detect Dica / Callouts: "💡 Dica:", "Dica:", "Dica da Guia:", "Importante:"
    if (
      trimmed.startsWith('💡') ||
      plain.toLowerCase().startsWith('dica:') ||
      plain.toLowerCase().startsWith('dica da guia:') ||
      plain.toLowerCase().startsWith('dica importante:') ||
      plain.toLowerCase().startsWith('importante:')
    ) {
      flushParagraph();
      flushDay();

      let tipTitle = 'Dica';
      let tipBody = plain;

      if (plain.toLowerCase().startsWith('dica:')) {
        tipBody = plain.slice(5).trim();
      } else if (plain.toLowerCase().startsWith('dica da guia:')) {
        tipBody = plain.slice(13).trim();
      } else if (plain.toLowerCase().startsWith('dica importante:')) {
        tipTitle = 'Dica Importante';
        tipBody = plain.slice(16).trim();
      } else if (plain.toLowerCase().startsWith('importante:')) {
        tipTitle = 'Importante';
        tipBody = plain.slice(11).trim();
      } else if (trimmed.startsWith('💡')) {
        tipBody = plain.replace(/^💡\s*/, '').trim();
        // check if has colon inside
        if (tipBody.includes(':')) {
          const parts = tipBody.split(':');
          tipTitle = parts[0].trim() || 'Dica';
          tipBody = parts.slice(1).join(':').trim();
        }
      }

      blocks.push({
        type: 'tip_card',
        data: {
          title: tipTitle,
          content: tipBody,
        },
      });
      i++;
      continue;
    }

    // 4. Detect Numbered Recommendations: "1. **Nome**: Descrição" or "1) Nome: Descrição"
    const numberedMatch = trimmed.match(/^([0-9]+)[\.\)]\s*(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      flushDay();

      const num = parseInt(numberedMatch[1], 10);
      const rest = numberedMatch[2].trim();

      // Separate Title and Description if separated by colon or bold
      let itemTitle = '';
      let itemDesc = '';

      // Pattern: **Title**: Description or Title: Description
      const colonSplit = rest.split(':');
      if (colonSplit.length > 1 && colonSplit[0].length < 60) {
        itemTitle = stripMarkdown(colonSplit[0]).trim();
        itemDesc = colonSplit.slice(1).join(':').replace(/^[\*:\s–-]+/, '').trim();
      } else {
        // Pattern: **Title** Description
        const boldMatch = rest.match(/^\*\*(.*?)\*\*(.*)/);
        if (boldMatch) {
          itemTitle = boldMatch[1].trim();
          itemDesc = boldMatch[2].replace(/^[-–—:\s\*]+/, '').trim();
        } else {
          itemTitle = stripMarkdown(rest);
          itemDesc = '';
        }
      }

      const icon = getContextIcon(itemTitle, itemDesc);

      blocks.push({
        type: 'item_card',
        data: {
          index: num,
          icon,
          title: itemTitle,
          description: itemDesc,
        },
      });
      i++;
      continue;
    }

    // 5. Detect Standalone Bullet Recommendations: "- **Nome**: Descrição" or "- Nome: Descrição"
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const bulletContent = trimmed.slice(2).trim();
      const colonSplit = bulletContent.split(':');

      if (colonSplit.length > 1 && colonSplit[0].length < 50) {
        flushParagraph();
        flushDay();

        const itemTitle = stripMarkdown(colonSplit[0]).trim();
        const itemDesc = colonSplit.slice(1).join(':').replace(/^[\*:\s–-]+/, '').trim();
        const icon = getContextIcon(itemTitle, itemDesc);

        blocks.push({
          type: 'item_card',
          data: {
            icon,
            title: itemTitle,
            description: itemDesc,
          },
        });
        i++;
        continue;
      }
    }

    // 6. Detect Main Titles / Major Section Headers
    // e.g., "🌹 **Roteiro Romântico Perfeito (2 Dias)**:" or "### Melhores Restaurantes"
    const isHeadingMarkdown = trimmed.startsWith('#');
    const isShortTitleWithEmoji = /^(?:🌹|☕|🍽️|🏨|✨|🌲|🌄|📍|🧗|🎿|🧀|🍷|🎉)\s*[^.!?\n]{3,60}:?$/.test(trimmed);
    const isShortBoldTitle = /^\*\*[^*]{3,60}\*\*:?$/.test(trimmed);

    if ((isHeadingMarkdown || isShortTitleWithEmoji || isShortBoldTitle) && !trimmed.toLowerCase().includes('dia ')) {
      flushParagraph();
      flushDay();

      // Check if next line is a subtitle (e.g. "2 dias em Campos do Jordão")
      let subtitle = '';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine &&
          !nextLine.startsWith('#') &&
          !nextLine.match(/^[0-9]+[\.\)]/) &&
          !nextLine.match(/^(?:📅\s*)?dia\s*[0-9]+/i) &&
          !nextLine.startsWith('-') &&
          nextLine.length < 50
        ) {
          subtitle = stripMarkdown(nextLine);
          i++; // consume subtitle line
        }
      }

      blocks.push({
        type: 'header',
        data: {
          title: plain.replace(/:$/, ''),
          subtitle: subtitle || undefined,
        },
      });
      i++;
      continue;
    }

    // Otherwise, normal paragraph line
    paragraphAcc.push(trimmed);
    i++;
  }

  flushParagraph();
  flushDay();

  return blocks;
}

interface AIMessageRendererProps {
  content: string;
}

/**
 * Visual Renderer Component for AI Chat responses.
 * Organizes raw text into native-looking cards, distinct Day blocks,
 * highlighted time periods, and zero raw markdown characters.
 */
export const AIMessageRenderer: React.FC<AIMessageRendererProps> = ({ content }) => {
  const blocks = parseAIMessage(content);

  // Fallback if parsing resulted in empty blocks
  if (blocks.length === 0) {
    return (
      <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        {renderInlineFormatted(content)}
      </div>
    );
  }

  // Render clean text blocks without any gray card box containers
  return (
    <div className="w-full flex flex-col gap-2.5 text-zinc-900 dark:text-zinc-100 select-text">
      {blocks.map((block, idx) => {
        switch (block.type) {
          // 1. Header Block
          case 'header': {
            return (
              <div key={`header-${idx}`} className="pt-1 pb-1">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                  {renderInlineFormatted(block.data.title)}
                </h3>
                {block.data.subtitle && (
                  <p className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {block.data.subtitle}
                  </p>
                )}
              </div>
            );
          }

          // 2. Itinerary Day Block - Clean text format without background card boxes
          case 'itinerary_day': {
            const day = block.data;
            return (
              <div key={`day-${idx}`} className="flex flex-col gap-2 my-1">
                {/* Day Header */}
                <div className="font-black text-sm uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {day.dayLabel}
                </div>

                {/* Periods list */}
                <div className="flex flex-col gap-2.5 pl-1">
                  {day.periods.map((period, pIdx) => (
                    <div key={`period-${pIdx}`} className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm uppercase tracking-wider text-zinc-900 dark:text-white">
                        <span>{period.periodLabel}</span>
                        <span>{period.icon}</span>
                      </div>
                      <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 pl-2">
                        {renderInlineFormatted(period.content)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // 3. Recommendation Item - Clean list item without background card
          case 'item_card': {
            const item = block.data;
            return (
              <div key={`item-${idx}`} className="flex items-start justify-between gap-2 py-0.5">
                <div className="flex-1 min-w-0 text-sm leading-relaxed">
                  <strong className="font-bold text-zinc-900 dark:text-white">
                    {renderInlineFormatted(item.title)}
                  </strong>
                  {item.description && (
                    <span className="text-zinc-700 dark:text-zinc-300 ml-1">
                      {renderInlineFormatted(item.description)}
                    </span>
                  )}
                </div>
                {item.icon && (
                  <span className="text-sm shrink-0 font-bold text-blue-600 dark:text-blue-400 ml-1">
                    {item.icon}
                  </span>
                )}
              </div>
            );
          }

          // 4. Tip / Highlight - Clean tip line with icon on the right
          case 'tip_card': {
            const tip = block.data;
            return (
              <div key={`tip-${idx}`} className="flex items-start justify-between gap-2 py-1 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 font-medium">
                <div>
                  <strong className="font-bold text-zinc-900 dark:text-white mr-1">{tip.title}:</strong>
                  {renderInlineFormatted(tip.content)}
                </div>
                <span className="text-base shrink-0 ml-1">💡</span>
              </div>
            );
          }

          // 5. Normal Paragraph Block
          case 'paragraph': {
            return (
              <p key={`p-${idx}`} className="text-sm sm:text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                {renderInlineFormatted(block.data)}
              </p>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};
