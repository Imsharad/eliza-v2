import { sha1 } from 'js-sha1';
import { z } from 'zod';
import type { UUID } from './types';

export const uuidSchema = z.string().uuid() as z.ZodType<UUID>;

/**
 * Validates a UUID value.
 *
 * @param {unknown} value - The value to validate.
 * @returns {UUID | null} Returns the validated UUID value or null if validation fails.
 */
/**
 * Validate if the given value is a valid UUID.
 *
 * @param {unknown} value - The value to be validated.
 * @returns {UUID | null} The validated UUID value or null if validation fails.
 */
export function validateUuid(value: unknown): UUID | null {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Converts a string or number to a UUID.
 *
 * @param {string | number} target - The string or number to convert to a UUID.
 * @returns {UUID} The UUID generated from the input target.
 * @throws {TypeError} Throws an error if the input target is not a string.
 */
export function stringToUuid(target: string | number): UUID {
  if (typeof target === 'number') {
    target = (target as number).toString();
  }

  if (typeof target !== 'string') {
    throw TypeError('Value must be string');
  }

  const _uint8ToHex = (ubyte: number): string => {
    const first = ubyte >> 4;
    const second = ubyte - (first << 4);
    const HEX_DIGITS = '0123456789abcdef'.split('');
    return HEX_DIGITS[first] + HEX_DIGITS[second];
  };

  const _uint8ArrayToHex = (buf: Uint8Array): string => {
    let out = '';
    for (let i = 0; i < buf.length; i++) {
      out += _uint8ToHex(buf[i]);
    }
    return out;
  };

  const escapedStr = encodeURIComponent(target);
  const buffer = new Uint8Array(escapedStr.length);
  for (let i = 0; i < escapedStr.length; i++) {
    buffer[i] = escapedStr[i].charCodeAt(0);
  }

  const hash = sha1(buffer);
  const hashBuffer = new Uint8Array(hash.length / 2);
  for (let i = 0; i < hash.length; i += 2) {
    hashBuffer[i / 2] = Number.parseInt(hash.slice(i, i + 2), 16);
  }

  return `${_uint8ArrayToHex(hashBuffer.slice(0, 4))}-${_uint8ArrayToHex(hashBuffer.slice(4, 6))}-${_uint8ToHex(hashBuffer[6] & 0x0f)}${_uint8ToHex(hashBuffer[7])}-${_uint8ToHex((hashBuffer[8] & 0x3f) | 0x80)}${_uint8ToHex(hashBuffer[9])}-${_uint8ArrayToHex(hashBuffer.slice(10, 16))}` as UUID;
}
