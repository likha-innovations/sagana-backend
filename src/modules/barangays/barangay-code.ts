import { randomInt } from 'crypto';
import { BadRequestException } from '@nestjs/common';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const BARANGAY_CODE_MAX_ATTEMPTS = 5;

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export function normalizeBarangayCode(code: unknown): string {
  if (typeof code !== 'string')
    throw new BadRequestException('Invalid barangay code');
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized))
    throw new BadRequestException('Invalid barangay code');
  return normalized;
}

export function generateBarangayCode(): string {
  return Array.from(
    { length: 6 },
    () => alphabet[randomInt(alphabet.length)],
  ).join('');
}
