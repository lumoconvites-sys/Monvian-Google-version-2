export interface SpotInfoCardData {
  primary: string;
  secondary?: string;
}

const PLACEHOLDER_VALUES = new Set([
  '-',
  '—',
  '–',
  'n/a',
  'na',
  'null',
  'undefined',
  'consultar',
  'a consultar',
  'sob consulta',
  'nao informado',
  'não informado',
  'nao disponivel',
  'não disponível',
  'indisponivel',
  'indisponível',
  'sem informacao',
  'sem informação',
]);

function normalizeText(value?: string | null): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function isPlaceholder(value: string): boolean {
  if (!value) return true;
  const lower = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return !lower || PLACEHOLDER_VALUES.has(lower);
}

function formatHourPart(rawHour: string, rawMinute?: string): string {
  const hourNum = Number(rawHour);
  const paddedHour = Number.isFinite(hourNum)
    ? String(hourNum).padStart(2, '0')
    : rawHour;
  const min = rawMinute ? rawMinute.padStart(2, '0') : '00';
  return min === '00' ? `${paddedHour}h` : `${paddedHour}h${min}`;
}

function extractDaysSecondary(segment: string): string | undefined {
  const lower = segment
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    /\b(todos os dias|diariamente|diario|segunda a domingo|seg\.?\s*a\s*dom\.?)\b/.test(
      lower
    )
  ) {
    return 'Todos os dias';
  }
  if (/\b(terca a domingo|ter\.?\s*a\s*dom\.?)\b/.test(lower)) {
    return 'Ter a Dom';
  }
  if (/\b(quarta a domingo|qua\.?\s*a\s*dom\.?)\b/.test(lower)) {
    return 'Qua a Dom';
  }
  if (/\b(quinta a domingo|qui\.?\s*a\s*dom\.?)\b/.test(lower)) {
    return 'Qui a Dom';
  }
  if (/\b(sexta a domingo|sex\.?\s*a\s*dom\.?)\b/.test(lower)) {
    return 'Sex a Dom';
  }
  if (/\b(segunda a sabado|seg\.?\s*a\s*sab\.?)\b/.test(lower)) {
    return 'Seg a Sáb';
  }
  if (/\b(segunda a sexta|seg\.?\s*a\s*sex\.?|dias uteis)\b/.test(lower)) {
    return 'Seg a Sex';
  }
  if (/\b(terca a sabado|ter\.?\s*a\s*sab\.?)\b/.test(lower)) {
    return 'Ter a Sáb';
  }
  if (/\b(quarta a sabado|qua\.?\s*a\s*sab\.?)\b/.test(lower)) {
    return 'Qua a Sáb';
  }
  if (/\b(domingo a quinta|dom\.?\s*a\s*qui\.?)\b/.test(lower)) {
    return 'Dom a Qui';
  }
  if (/\b(domingo a sexta|dom\.?\s*a\s*sex\.?)\b/.test(lower)) {
    return 'Dom a Sex';
  }
  if (/\b(quinta a segunda|qui\.?\s*a\s*seg\.?)\b/.test(lower)) {
    return 'Qui a Seg';
  }
  if (/\b(sexta e sabado|sex\.?\s*e\s*sab\.?)\b/.test(lower)) {
    return 'Sex e Sáb';
  }
  if (
    /\b(sabados? e domingos?|sab\.?\s*e\s*dom\.?|finais? de semana|fins de semana)\b/.test(
      lower
    )
  ) {
    return 'Sáb e Dom';
  }

  return undefined;
}

/**
 * Parses a spot's registered opening hours strictly from real data.
 * Returns null if no valid hours are registered — never invents values.
 */
export function parseSpotHoursCard(hours?: string | null): SpotInfoCardData | null {
  const raw = normalizeText(hours);
  if (isPlaceholder(raw)) return null;

  // Use the primary segment when multiple schedules are separated by "|" or ";"
  const primarySegment = raw.split(/\s*[|;]\s*/)[0].trim();
  const normalizedSegment = primarySegment
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const daysSecondary = extractDaysSecondary(primarySegment);

  // Explicit 24h schedule
  if (/\b24\s*(h|horas)\b/.test(normalizedSegment)) {
    return {
      primary: '24 horas',
      secondary: daysSecondary || (/\baberto\s+24/.test(normalizedSegment) ? 'Todos os dias' : undefined),
    };
  }

  // Match time ranges like "09h00 às 17h00", "09:00 - 18:00", "9h as 17h30", "11:00 às 00:00"
  const timeRangeRegex =
    /(\d{1,2})(?:[:h](\d{2}))?\s*h?\s*(?:às|as|a|-|–|—)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?/i;
  const match = primarySegment.match(timeRangeRegex);

  if (match) {
    const start = formatHourPart(match[1], match[2]);
    const end = formatHourPart(match[3], match[4]);
    return {
      primary: `${start} às ${end}`,
      secondary: daysSecondary,
    };
  }

  // Fallback for real descriptive schedules (e.g. "Mediante reserva")
  return {
    primary: primarySegment,
    secondary: daysSecondary,
  };
}

function formatReaisAmount(rawNumber: string): string {
  const cleaned = rawNumber.replace(/\s+/g, '').trim();
  // Strip trailing ",00" or ".00" for crisp iOS display (e.g. "30,00" -> "30")
  const wholeMatch = cleaned.match(/^(\d+(?:\.\d{3})*)[,.]00$/);
  if (wholeMatch) {
    return `R$ ${wholeMatch[1]}`;
  }
  return `R$ ${cleaned.replace('.', ',')}`;
}

function detectPriceUnitSecondary(normalizedRaw: string, hasExplicitAmount: boolean): string | undefined {
  if (/\b(por\s+veiculo|\/veiculo|por\s+carro|\/carro|estacionamento)\b/.test(normalizedRaw)) {
    return 'Por veículo';
  }
  if (/\b(por\s+casal|\/casal)\b/.test(normalizedRaw)) {
    return 'Por casal';
  }
  if (/\b(por\s+grupo|\/grupo|por\s+familia|\/familia)\b/.test(normalizedRaw)) {
    return 'Por grupo';
  }
  if (/\b(por\s+diaria|\/diaria|por\s+noite|\/noite)\b/.test(normalizedRaw)) {
    return 'Por diária';
  }
  if (/\b(por\s+hora|\/hora|\/h)\b/.test(normalizedRaw)) {
    return 'Por hora';
  }
  if (/\b(a\s+partir\s+de|partir\s+de)\b/.test(normalizedRaw)) {
    return 'A partir de';
  }
  if (/\b(por\s+pessoa|\/pessoa|individual|ingresso|entrada|inteira|adulto)\b/.test(normalizedRaw)) {
    return 'Por pessoa';
  }
  // Standard single ticket amount registered in spot.price
  if (hasExplicitAmount) {
    return 'Por pessoa';
  }
  return undefined;
}

/**
 * Parses a spot's registered entrance fee / price strictly from real data.
 * Returns null if neither price nor priceRange is registered — never invents values.
 */
export function parseSpotPriceCard(
  price?: string | null,
  priceRange?: string | null
): SpotInfoCardData | null {
  const rawPrice = normalizeText(price);
  const rawRange = normalizeText(priceRange);

  const hasRealPrice = !isPlaceholder(rawPrice);
  const hasRealRange = !isPlaceholder(rawRange);

  if (!hasRealPrice && !hasRealRange) return null;

  if (hasRealPrice) {
    const normalized = rawPrice
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Free entrance
    if (
      /\b(gratis|gratuito|gratuita|entrada franca|acesso livre|livre|sem custo)\b/.test(
        normalized
      ) ||
      /^r\$\s*0(?:[,.]00)?$/.test(normalized)
    ) {
      return { primary: 'Gratuito' };
    }

    // Currency range e.g. "R$ 20 a R$ 40" or "R$ 20 - 40"
    const rangeMatch = rawPrice.match(
      /R\$\s*(\d+(?:[.,]\d{1,2})?)\s*(?:a|às|as|-|–|—)\s*(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)/i
    );
    if (rangeMatch) {
      const minVal = formatReaisAmount(rangeMatch[1]);
      const maxVal = formatReaisAmount(rangeMatch[2]).replace(/^R\$\s*/, '');
      const unitSecondary = detectPriceUnitSecondary(normalized, false);
      return {
        primary: `${minVal} a ${maxVal}`,
        secondary: unitSecondary,
      };
    }

    // Single currency value e.g. "R$ 30", "R$ 30,00 por pessoa"
    const singleMatch = rawPrice.match(/R\$\s*(\d+(?:\.\d{3})*(?:[.,]\d{1,2})?)/i);
    if (singleMatch) {
      const formatted = formatReaisAmount(singleMatch[1]);
      const unitSecondary = detectPriceUnitSecondary(normalized, true);
      return {
        primary: formatted,
        secondary: unitSecondary,
      };
    }

    // Dollar-sign price range stored directly in price
    if (/^\${1,4}$/.test(rawPrice)) {
      return {
        primary: rawPrice,
        secondary: 'Faixa de preço',
      };
    }

    // Real descriptive text registered by admin
    return {
      primary: rawPrice,
    };
  }

  // Fallback strictly to registered priceRange
  const normalizedRange = rawRange
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\b(gratis|gratuito|gratuita|entrada franca)\b/.test(normalizedRange)) {
    return { primary: 'Gratuito' };
  }

  if (/^\${1,4}$/.test(rawRange)) {
    return {
      primary: rawRange,
      secondary: 'Faixa de preço',
    };
  }

  return {
    primary: rawRange,
  };
}
