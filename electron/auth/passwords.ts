/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Secure Password Hashing & Authentication Utilities (Scrypt + Salt)
 */

import crypto from 'crypto';

export interface HashedPassword {
  hash: string;
  salt: string;
}

/**
 * Hashes a plaintext password with a unique cryptographic salt using scrypt.
 */
export function hashPassword(password: string, existingSalt?: string): HashedPassword {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Timing-safe password verification.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (keyBuffer.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(keyBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Developer Authorization Code for credential changes.
 * Protected inside Electron main process — never exposed to Renderer.
 */
export const DEVELOPER_AUTH_CODE = 'Akasha249';

/**
 * Validates the developer authorization code using timing-safe comparison.
 */
export function verifyDeveloperCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const inputBuffer = Buffer.from(code.trim());
  const expectedBuffer = Buffer.from(DEVELOPER_AUTH_CODE);
  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}
