import { Result, ok, err } from '../fp/result';
import {
  VerificationTier,
  VerifiedProfile,
  VerifiedGroup,
  GroupMember,
  GroupProposal,
  GroupFilterCriteria,
} from './types';

/**
 * Pure Functional Business Logic for Identity Tiers, Group Formation, and Governance
 */

const TIER_WEIGHT: Readonly<Record<VerificationTier, number>> = Object.freeze({
  basic_oauth: 1,
  credential_attested: 2,
  multi_party_vouched: 3,
});

export const getTierRank = (tier: VerificationTier): number => TIER_WEIGHT[tier];

export const formatTierLabel = (tier: VerificationTier): string => {
  switch (tier) {
    case 'basic_oauth':
      return 'Tier 1 · OAuth Verified';
    case 'credential_attested':
      return 'Tier 2 · Credential Attested';
    case 'multi_party_vouched':
      return 'Tier 3 · Multi-Party Vouched';
  }
};

export const computeVerificationTier = (params: Readonly<{
  readonly hasAttestedVault: boolean;
  readonly activeVouchCount: number;
}>): VerificationTier => {
  if (params.hasAttestedVault && params.activeVouchCount >= 2) {
    return 'multi_party_vouched';
  }
  if (params.hasAttestedVault || params.activeVouchCount >= 1) {
    return 'credential_attested';
  }
  return 'basic_oauth';
};

export const calculateTrustIndex = (profile: VerifiedProfile): number => {
  const baseScore = getTierRank(profile.verificationTier) * 30;
  const vouchBonus = Math.min(profile.vouchCount * 5, 10);
  return Math.min(baseScore + vouchBonus, 100);
};

export const evaluateGroupJoinEligibility = (
  profile: VerifiedProfile | null,
  group: VerifiedGroup,
  existingMembers: readonly GroupMember[]
): Result<{ readonly eligible: true }, string> => {
  if (!profile) {
    return err('Complete your verified identity profile before joining a group.');
  }
  if (group.status !== 'active') {
    return err(`Group is currently ${group.status} and closed to new members.`);
  }
  const alreadyMember = existingMembers.some(
    (m) => m.uid === profile.uid && m.membershipStatus === 'active'
  );
  if (alreadyMember) {
    return err('You are already an active verified member of this group.');
  }
  const userRank = getTierRank(profile.verificationTier);
  const requiredRank = getTierRank(group.requiredTier);
  if (userRank < requiredRank) {
    return err(
      `Requires ${formatTierLabel(group.requiredTier)} (your current tier is ${formatTierLabel(profile.verificationTier)}).`
    );
  }
  return ok({ eligible: true });
};

export const filterGroupsPure = (
  criteria: GroupFilterCriteria
) => (groups: readonly VerifiedGroup[]): readonly VerifiedGroup[] => {
  const normalizedQuery = criteria.searchQuery.trim().toLowerCase();

  return groups.filter((group) => {
    const matchesCategory =
      criteria.category === 'all' || group.category === criteria.category;

    const matchesRequiredTier =
      criteria.requiredTier === 'all' || group.requiredTier === criteria.requiredTier;

    const matchesEligibility =
      criteria.onlyEligibleForTier === null ||
      getTierRank(criteria.onlyEligibleForTier) >= getTierRank(group.requiredTier);

    const matchesSearch =
      normalizedQuery.length === 0 ||
      group.name.toLowerCase().includes(normalizedQuery) ||
      group.purpose.toLowerCase().includes(normalizedQuery) ||
      group.ownerName.toLowerCase().includes(normalizedQuery) ||
      group.tags.some((t) => t.toLowerCase().includes(normalizedQuery));

    return (
      matchesCategory &&
      matchesRequiredTier &&
      matchesEligibility &&
      matchesSearch
    );
  });
};

export const computeGroupGovernanceStats = (
  members: readonly GroupMember[],
  proposals: readonly GroupProposal[]
): Readonly<{
  readonly activeMembersCount: number;
  readonly multiPartyVouchedCount: number;
  readonly openProposalsCount: number;
  readonly ratifiedProposalsCount: number;
  readonly quorumThreshold: number;
}> => {
  const activeMembers = members.filter((m) => m.membershipStatus === 'active');
  const activeMembersCount = activeMembers.length;
  const multiPartyVouchedCount = activeMembers.filter(
    (m) => m.verificationTier === 'multi_party_vouched'
  ).length;
  const openProposalsCount = proposals.filter((p) => p.status === 'open').length;
  const ratifiedProposalsCount = proposals.filter((p) => p.status === 'ratified').length;
  const quorumThreshold = Math.max(1, Math.ceil(activeMembersCount * 0.5));

  return Object.freeze({
    activeMembersCount,
    multiPartyVouchedCount,
    openProposalsCount,
    ratifiedProposalsCount,
    quorumThreshold,
  });
};
