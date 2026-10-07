/**
 * Domain Types synchronized with firebase-blueprint.json & firestore.rules
 */

export type VerificationTier =
  | 'basic_oauth'
  | 'credential_attested'
  | 'multi_party_vouched';

export type DocumentCredentialType =
  | 'passport'
  | 'national_id'
  | 'professional_license'
  | 'hardware_key';

export type GroupCategory =
  | 'governance'
  | 'security'
  | 'research'
  | 'finance'
  | 'community';

export type GroupVisibility = 'public_verified' | 'invite_only';

export type GroupStatus = 'active' | 'locked' | 'archived';

export type MemberRole = 'founder' | 'moderator' | 'verified_member';

export type MembershipStatus = 'active' | 'revoked';

export type ProposalStatus = 'open' | 'ratified' | 'rejected';

export type VouchStatus = 'active' | 'revoked';

export interface VerifiedProfile {
  readonly uid: string;
  readonly displayName: string;
  readonly handle: string;
  readonly organization: string;
  readonly roleTitle: string;
  readonly verificationTier: VerificationTier;
  readonly identityHash: string;
  readonly vouchCount: number;
  readonly bio: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PrivateIdentityVault {
  readonly uid: string;
  readonly email: string;
  readonly jurisdiction: string;
  readonly documentType: DocumentCredentialType;
  readonly documentLastFour: string;
  readonly attestationSignature: string;
  readonly verifiedAt: string;
  readonly updatedAt: string;
}

export interface VerifiedGroup {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly category: GroupCategory;
  readonly requiredTier: VerificationTier;
  readonly visibility: GroupVisibility;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly memberCount: number;
  readonly status: GroupStatus;
  readonly tags: readonly string[];
  readonly charterHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GroupMember {
  readonly uid: string;
  readonly groupId: string;
  readonly displayName: string;
  readonly role: MemberRole;
  readonly verificationTier: VerificationTier;
  readonly identityHash: string;
  readonly membershipStatus: MembershipStatus;
  readonly joinedAt: string;
  readonly updatedAt: string;
}

export interface GroupProposal {
  readonly id: string;
  readonly groupId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly authorIdentityHash: string;
  readonly title: string;
  readonly summary: string;
  readonly status: ProposalStatus;
  readonly approvalsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IdentityVouch {
  readonly id: string;
  readonly voucherId: string;
  readonly voucherName: string;
  readonly targetUserId: string;
  readonly targetUserName: string;
  readonly context: string;
  readonly signatureHash: string;
  readonly status: VouchStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GroupFilterCriteria {
  readonly searchQuery: string;
  readonly category: GroupCategory | 'all';
  readonly requiredTier: VerificationTier | 'all';
  readonly onlyEligibleForTier: VerificationTier | null;
}
