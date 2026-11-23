export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

export interface SerializedRational {
  readonly num: string;
  readonly den: string;
}

function absBigInt(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = absBigInt(a);
  let y = absBigInt(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

export function normalizeRational(num: bigint, den: bigint): Rational {
  if (den === 0n) {
    throw new Error('Division by zero in ExactNumber.');
  }
  if (num === 0n) {
    return { num: 0n, den: 1n };
  }
  const sign = den < 0n ? -1n : 1n;
  const sNum = num * sign;
  const sDen = absBigInt(den);
  const g = gcdBigInt(sNum, sDen);
  return { num: sNum / g, den: sDen / g };
}

export function fromInteger(value: number | bigint): Rational {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(`Expected safe integer, got ${value}`);
  }
  return { num: BigInt(value), den: 1n };
}

export function fromDecimalString(raw: string): Rational {
  const trimmed = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\d{1,3}(?:,\d{3})+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    throw new Error(`Invalid decimal number: "${raw}"`);
  }
  const normalized = trimmed.replace(/,/g, '');
  const negative = normalized.startsWith('-');
  const unsigned = normalized.replace(/^[+-]/, '');
  const parts = unsigned.split('.');
  const wholePart = parts[0] ?? '0';
  const fracPart = parts[1] ?? '';
  const digits = `${wholePart}${fracPart}`.replace(/^0+(?=\d)/, '') || '0';
  const den = 10n ** BigInt(fracPart.length);
  const num = BigInt(digits) * (negative ? -1n : 1n);
  return normalizeRational(num, den);
}

export function tryFromDecimalString(raw: string): Rational | null {
  try {
    return fromDecimalString(raw);
  } catch {
    return null;
  }
}

export function add(a: Rational, b: Rational): Rational {
  return normalizeRational(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sub(a: Rational, b: Rational): Rational {
  return normalizeRational(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function mul(a: Rational, b: Rational): Rational {
  return normalizeRational(a.num * b.num, a.den * b.den);
}

export function div(a: Rational, b: Rational): Rational {
  if (b.num === 0n) {
    throw new Error('Division by zero in ExactNumber.');
  }
  return normalizeRational(a.num * b.den, a.den * b.num);
}

export function neg(a: Rational): Rational {
  return { num: -a.num, den: a.den };
}

export function abs(a: Rational): Rational {
  return { num: absBigInt(a.num), den: a.den };
}

export function cmp(a: Rational, b: Rational): -1 | 0 | 1 {
  const diff = a.num * b.den - b.num * a.den;
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

export function isPositive(a: Rational): boolean {
  return a.num > 0n;
}

export function isNegative(a: Rational): boolean {
  return a.num < 0n;
}

export function isZero(a: Rational): boolean {
  return a.num === 0n;
}

export function toDecimalString(value: Rational, scale = 2): string {
  const negative = value.num < 0n;
  const factor = 10n ** BigInt(scale);
  const absNum = absBigInt(value.num);
  // Half-away-from-zero rounding at display boundary
  const scaled = (absNum * factor * 2n + value.den) / (value.den * 2n);
  const whole = scaled / factor;
  const frac = scaled % factor;
  const sign = negative && scaled !== 0n ? '-' : '';
  if (scale === 0) {
    return `${sign}${whole.toString()}`;
  }
  return `${sign}${whole.toString()}.${frac.toString().padStart(scale, '0')}`;
}

function addThousandsSeparators(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function toMoneyString(value: Rational, showPlus = false): string {
  const raw = toDecimalString(value, 2);
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, frac] = unsigned.split('.');
  const formatted = `$${addThousandsSeparators(whole ?? '0')}.${frac ?? '00'}`;
  if (negative) return `-${formatted}`;
  if (showPlus && !isZero(value)) return `+${formatted}`;
  return formatted;
}

export function toRatioString(value: Rational, showPlus = false): string {
  const raw = toDecimalString(value, 2);
  const negative = raw.startsWith('-');
  if (negative) return `${raw}R`;
  if (showPlus && !isZero(value)) return `+${raw}R`;
  return `${raw}R`;
}

export const ExactNumber = {
  fromInteger,
  fromDecimalString,
  tryFromDecimalString,
  toJSON(value: Rational): SerializedRational {
    return { num: value.num.toString(), den: value.den.toString() };
  },
  fromJSON(raw: SerializedRational): Rational {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      typeof raw.num !== 'string' ||
      typeof raw.den !== 'string' ||
      !/^-?\d+$/.test(raw.num) ||
      !/^\d+$/.test(raw.den)
    ) {
      throw new Error('Corrupt serialized ExactNumber payload.');
    }
    return normalizeRational(BigInt(raw.num), BigInt(raw.den));
  },
};
