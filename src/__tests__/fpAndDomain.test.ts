import { describe, it, expect } from 'vitest';
import {
  Result,
  ok,
  err,
  isOk,
  isErr,
  mapResult,
  flatMapResult,
  matchResult,
  unwrapOr,
  combineResults,
  pipe,
  clampString,
  sanitizeIdentifier,
} from '../fp/result';
import {
  generateIdentityHash,
  generateAttestationSignature,
  generateCharterHash,
  generateVouchSignature,
  formatShortHash,
} from '../domain/crypto';
import {
  validateId,
  validateProfileInput,
  validatePrivateVaultInput,
  validateCreateGroupInput,
  validateProposalInput,
  validateVouchInput,
} from '../domain/validators';
import {
  computeVerificationTier,
  calculateTrustIndex,
  evaluateGroupJoinEligibility,
  filterGroupsPure,
  computeGroupGovernanceStats,
} from '../domain/groupLogic';

describe('Functional Programming Core & Domain Logic Tests', () => {
  it('evaluates Result monad operations (ok, err, mapResult, flatMapResult, matchResult, combineResults)', () => {
    const r1: Result<number, string> = ok(10);
    const r2 = mapResult<number, number, string>((x: number) => x * 3)(r1);
    expect(isOk(r2) && r2.value).toBe(30);

    const r3 = flatMapResult<number, number, string>((x: number) =>
      x > 20 ? ok(x + 5) : err('too small')
    )(r2);
    expect(unwrapOr(0)(r3)).toBe(35);

    const failed = err<string>('invalid');
    expect(isErr(failed)).toBe(true);
    expect(unwrapOr(99)(failed)).toBe(99);

    const matched = matchResult<number, string, string>({
      onOk: (v) => `val:${v}`,
      onErr: (e) => `err:${e}`,
    })(r3);
    expect(matched).toBe('val:35');

    const combinedOk = combineResults([ok('a'), ok('b')]);
    expect(isOk(combinedOk) && combinedOk.value).toEqual(['a', 'b']);

    const combinedErr = combineResults([ok('a'), err('boom')]);
    expect(isErr(combinedErr) && combinedErr.error).toBe('boom');
  });

  it('composes pure functions with pipe and string sanitizers', () => {
    const transform = pipe(
      (s: string) => clampString(12)(s),
      (s: string) => sanitizeIdentifier(s)
    );
    expect(transform('  hello@world#2026!  ')).toBe('hello_world');
  });

  it('generates deterministic URL-safe cryptographic commitments matching firestore.rules regex', () => {
    const idHash1 = generateIdentityHash({
      uid: 'uid_123',
      handle: 'alice_v',
      organization: 'TrustOrg',
      tier: 'credential_attested',
    });
    const idHash2 = generateIdentityHash({
      uid: 'uid_123',
      handle: 'alice_v',
      organization: 'TrustOrg',
      tier: 'credential_attested',
    });
    expect(idHash1).toBe(idHash2);
    expect(idHash1).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(idHash1.length).toBeGreaterThanOrEqual(16);

    const attSig = generateAttestationSignature({
      uid: 'uid_123',
      jurisdiction: 'DE',
      documentType: 'passport',
      documentLastFour: '94A2',
    });
    expect(attSig).toMatch(/^[a-zA-Z0-9_-]+$/);

    const charterHash = generateCharterHash({
      name: 'Council',
      purpose: 'Verified governance charter.',
      category: 'governance',
      requiredTier: 'basic_oauth',
    });
    expect(charterHash).toMatch(/^[a-zA-Z0-9_-]+$/);

    const vouchSig = generateVouchSignature({
      voucherId: 'u1',
      targetUserId: 'u2',
      context: 'Confirmed passport in person',
    });
    expect(vouchSig).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(formatShortHash(vouchSig)).toContain('…');
  });

  it('validates profile, private vault, group, proposal, and vouch inputs against blueprint bounds', () => {
    expect(validateId('ID')('valid_id-123').tag).toBe('ok');
    expect(validateId('ID')('bad id with spaces!').tag).toBe('err');

    const profileRes = validateProfileInput({
      uid: 'user_1',
      displayName: 'Marcus Vance',
      handle: 'marcus_v',
      organization: 'Security Lab',
      roleTitle: 'Auditor',
      verificationTier: 'basic_oauth',
      bio: 'Verified auditor',
    });
    expect(profileRes.tag).toBe('ok');

    const vaultRes = validatePrivateVaultInput({
      uid: 'user_1',
      email: 'marcus@lab.org',
      jurisdiction: 'Germany',
      documentType: 'passport',
      documentLastFour: '94a2',
    });
    expect(vaultRes.tag).toBe('ok');
    if (vaultRes.tag === 'ok') {
      expect(vaultRes.value.documentLastFour).toBe('94A2');
    }

    const badVaultRes = validatePrivateVaultInput({
      uid: 'user_1',
      email: 'marcus@lab.org',
      jurisdiction: 'Germany',
      documentType: 'passport',
      documentLastFour: '12', // Must be 4 chars
    });
    expect(badVaultRes.tag).toBe('err');

    const groupRes = validateCreateGroupInput({
      name: 'Verified Security Assembly',
      purpose: 'Coordinating cryptographic incident response across verified peers.',
      category: 'security',
      requiredTier: 'credential_attested',
      visibility: 'public_verified',
      tags: ['t1', 't2', 't3', 't4', 't5', 't6_trimmed'],
    });
    expect(groupRes.tag).toBe('ok');
    if (groupRes.tag === 'ok') {
      expect(groupRes.value.tags.length).toBe(5);
    }

    const propRes = validateProposalInput({
      groupId: 'grp_1',
      title: 'Charter Ratification',
      summary: 'Approve the baseline cryptographic attestation standard.',
    });
    expect(propRes.tag).toBe('ok');

    // Self-vouching must be rejected
    const selfVouchRes = validateVouchInput({
      voucherId: 'user_1',
      targetUserId: 'user_1',
      context: 'Trying to vouch for myself.',
    });
    expect(selfVouchRes.tag).toBe('err');
  });

  it('computes verification tiers, join eligibility, filtering, and governance quorum', () => {
    expect(computeVerificationTier({ hasAttestedVault: false, activeVouchCount: 0 })).toBe('basic_oauth');
    expect(computeVerificationTier({ hasAttestedVault: true, activeVouchCount: 0 })).toBe('credential_attested');
    expect(computeVerificationTier({ hasAttestedVault: true, activeVouchCount: 2 })).toBe('multi_party_vouched');

    const tier1Profile = {
      uid: 'u1',
      displayName: 'Alice',
      handle: 'alice',
      organization: 'Org',
      roleTitle: 'Role',
      verificationTier: 'basic_oauth' as const,
      identityHash: 'id_sha256_1234567890abcdef',
      vouchCount: 1,
      bio: '',
      createdAt: '2026-10-07T00:00:00Z',
      updatedAt: '2026-10-07T00:00:00Z',
    };
    expect(calculateTrustIndex(tier1Profile)).toBe(35);

    const tier3Group = {
      id: 'g1',
      name: 'High Trust Board',
      purpose: 'Requires Tier 3 identity.',
      category: 'governance' as const,
      requiredTier: 'multi_party_vouched' as const,
      visibility: 'public_verified' as const,
      ownerId: 'founder_1',
      ownerName: 'Founder',
      memberCount: 2,
      status: 'active' as const,
      tags: ['board'],
      charterHash: 'chr_sha256_1234567890abcdef',
      createdAt: '2026-10-07T00:00:00Z',
      updatedAt: '2026-10-07T00:00:00Z',
    };

    const ineligible = evaluateGroupJoinEligibility(tier1Profile, tier3Group, []);
    expect(ineligible.tag).toBe('err');

    const tier3Profile = { ...tier1Profile, verificationTier: 'multi_party_vouched' as const };
    const eligible = evaluateGroupJoinEligibility(tier3Profile, tier3Group, []);
    expect(eligible.tag).toBe('ok');

    const filtered = filterGroupsPure({
      searchQuery: 'High Trust',
      category: 'governance',
      requiredTier: 'all',
      onlyEligibleForTier: 'multi_party_vouched',
    })([tier3Group]);
    expect(filtered.length).toBe(1);

    const stats = computeGroupGovernanceStats(
      [
        {
          uid: 'u1',
          groupId: 'g1',
          displayName: 'Alice',
          role: 'founder',
          verificationTier: 'multi_party_vouched',
          identityHash: 'id_sha256_1234567890abcdef',
          membershipStatus: 'active',
          joinedAt: '2026-10-07T00:00:00Z',
          updatedAt: '2026-10-07T00:00:00Z',
        },
      ],
      []
    );
    expect(stats.activeMembersCount).toBe(1);
    expect(stats.quorumThreshold).toBe(1);
  });
});
