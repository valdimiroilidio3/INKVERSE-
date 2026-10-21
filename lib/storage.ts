import { z } from 'zod';

const PREFIX = 'inkverse:v1:';

export const STORAGE_KEYS = {
  studio: `${PREFIX}studio`,
  favorites: `${PREFIX}favorites`,
  compositions: `${PREFIX}compositions`,
} as const;

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Reads + validates a JSON blob from localStorage. Corrupt or outdated data is
 * discarded rather than crashing the studio.
 */
export function readStorage<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      window.localStorage.removeItem(key);
      return fallback;
    }
    return result.data;
  } catch {
    return fallback;
  }
}

export type WriteResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'error' };

export function writeStorage(key: string, value: unknown): WriteResult {
  if (!isBrowser()) return { ok: false, reason: 'unavailable' };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { ok: false, reason: 'quota' };
    }
    return { ok: false, reason: 'error' };
  }
}

export function clearStorage(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
