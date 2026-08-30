export interface ByteSize {
  bytes: number;
  kb: number;
  mb: string;
}

/** Canonical byte-size formatting, replacing differing Math.round/toFixed rounding across checkers. */
export function formatBytes(bytes: number): ByteSize {
  return {
    bytes,
    kb: Math.round(bytes / 1024),
    mb: (bytes / 1024 / 1024).toFixed(2),
  };
}
