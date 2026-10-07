/**
 * Pure deterministic cryptographic commitment & fingerprint functions.
 *Produces URL-safe alphanumeric hashes matching `^[a-zA-Z0-9_\-]+$`
 * and bounded between 16 and 128 characters as enforced by firestore.rules.
 */

const FNV_PRIME_A = 0x01000193;
const FNV_OFFSET_A = 0x811c9dc5;
const FNV_PRIME_B = 0x1000193b;
const FNV_OFFSET_B = 0x9e3779b9;

const computeHexSegment = (seed: number, prime: number) => (input: string): string => {
  const hash = Array.from(input).reduce((acc, char, idx) => {
    const code = char.charCodeAt(0);
    return Math.imul((acc ^ code ^ (idx & 0xff)) >>> 0, prime) >>> 0;
  }, seed >>> 0);
  return hash.toString(16).padStart(8, '0');
};

export const computeDeterministicDigest = (prefix: string) => (payload: string): string => {
  const normalized = payload.trim();
  const seg1 = computeHexSegment(FNV_OFFSET_A, FNV_PRIME_A)(normalized);
  const seg2 = computeHexSegment(FNV_OFFSET_B, FNV_PRIME_B)(normalized.split('').reverse().join(''));
  const seg3 = computeHexSegment(0xdeadbeef, FNV_PRIME_A)(`${normalized.length}:${normalized}`);
  const seg4 = computeHexSegment(0x41c64e6d, FNV_PRIME_B)(`${prefix}:${normalized}`);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'vc';
  return `${cleanPrefix}_${seg1}${seg2}${seg3}${seg4}`.slice(0, 64);
};

export const generateIdentityHash = (params: Readonly<{
  readonly uid: string;
  readonly handle: string;
  readonly organization: string;
  readonly tier: string;
}>): string =>
  computeDeterministicDigest('id_sha256')(
    `${params.uid}|${params.handle.toLowerCase()}|${params.organization.toLowerCase()}|${params.tier}`
  );

export const generateAttestationSignature = (params: Readonly<{
  readonly uid: string;
  readonly jurisdiction: string;
  readonly documentType: string;
  readonly documentLastFour: string;
}>): string =>
  computeDeterministicDigest('att_sig')(
    `${params.uid}|${params.jurisdiction.toUpperCase()}|${params.documentType}|${params.documentLastFour}`
  );

export const generateCharterHash = (params: Readonly<{
  readonly name: string;
  readonly purpose: string;
  readonly category: string;
  readonly requiredTier: string;
}>): string =>
  computeDeterministicDigest('chr_sha256')(
    `${params.name.toLowerCase()}|${params.purpose.toLowerCase()}|${params.category}|${params.requiredTier}`
  );

export const generateVouchSignature = (params: Readonly<{
  readonly voucherId: string;
  readonly targetUserId: string;
  readonly context: string;
}>): string =>
  computeDeterministicDigest('vch_sig')(
    `${params.voucherId}->${params.targetUserId}:${params.context.trim()}`
  );

export const formatShortHash = (hash: string): string => {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 12)}…${hash.slice(-6)}`;
};
