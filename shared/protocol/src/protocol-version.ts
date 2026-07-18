/** Current wire protocol major.minor for Companion ↔ future host. */
export const PROTOCOL_VERSION = "1.0" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

/** Major versions accepted by this package (strict major match). */
export const SUPPORTED_PROTOCOL_MAJORS = Object.freeze([1] as const);

export function parseProtocolMajor(version: string): number | null {
  const match = /^([0-9]+)\.([0-9]+)$/.exec(version);
  if (!match) return null;
  const major = Number(match[1]);
  if (!Number.isInteger(major) || major < 0) return null;
  return major;
}

export function isCompatibleProtocolVersion(version: string): boolean {
  const major = parseProtocolMajor(version);
  if (major === null) return false;
  return (SUPPORTED_PROTOCOL_MAJORS as readonly number[]).includes(major);
}
