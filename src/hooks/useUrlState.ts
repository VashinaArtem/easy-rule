import { useCallback, useState } from 'react';

export interface Codec<T> {
  parse: (raw: string) => T | undefined;
  format: (value: T) => string;
}

export const numberCodec = (min: number, max: number, digits = 4): Codec<number> => ({
  parse: (raw) => {
    const v = Number(raw);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
  },
  format: (v) => String(Number(v.toFixed(digits))),
});

export const intCodec = (min: number, max: number): Codec<number> => ({
  parse: (raw) => {
    const v = Math.round(Number(raw));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
  },
  format: (v) => String(Math.round(v)),
});

export const enumCodec = <T extends string>(values: readonly T[]): Codec<T> => ({
  parse: (raw) => (values.includes(raw as T) ? (raw as T) : undefined),
  format: (v) => v,
});

export const boolCodec: Codec<boolean> = {
  parse: (raw) => (raw === '1' ? true : raw === '0' ? false : undefined),
  format: (v) => (v ? '1' : '0'),
};

const pending = new Map<string, string | null>();
let timer: number | undefined;

function flush() {
  timer = undefined;
  const url = new URL(window.location.href);
  for (const [key, value] of pending) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  pending.clear();
  // Keep the router's history.state so Back/Forward still work.
  window.history.replaceState(window.history.state, '', url);
}

/** Writes a query parameter without adding history entries; `null` removes it. */
export function writeUrlParam(key: string, value: string | null) {
  pending.set(key, value);
  if (timer === undefined) timer = window.setTimeout(flush, 250);
}

export function readUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

/** React state mirrored into the query string, so a view can be shared by link. */
export function useUrlState<T>(key: string, initial: T, codec: Codec<T>): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = readUrlParam(key);
    return (raw !== null ? codec.parse(raw) : undefined) ?? initial;
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      const formatted = codec.format(v);
      writeUrlParam(key, formatted === codec.format(initial) ? null : formatted);
    },
    [key, codec, initial],
  );
  return [value, set];
}
