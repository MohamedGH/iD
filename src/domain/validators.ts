import { Result, ok, err, clampString, sanitizeIdentifier } from '../fp/result';
import {
  VerificationTier,
  DocumentCredentialType,
  GroupCategory,
  GroupVisibility,
} from './types';

/**
 * Verbatim Schema Constants from firebase-blueprint.json & firestore.rules
 */
export const SCHEMA_CONSTRAINTS = Object.freeze({
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DOC_LAST_FOUR_PATTERN: /^[0-9A-Z]{4}$/,
  ID_MAX_LEN: 128,
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 80,
  HANDLE_MIN: 3,
  HANDLE_MAX: 40,
  ORG_MIN: 2,
  ORG_MAX: 100,
  ROLE_TITLE_MIN: 2,
  ROLE_TITLE_MAX: 80,
  BIO_MAX: 300,
  EMAIL_MIN: 3,
  EMAIL_MAX: 150,
  JURISDICTION_MIN: 2,
  JURISDICTION_MAX: 80,
  GROUP_NAME_MIN: 3,
  GROUP_NAME_MAX: 100,
  GROUP_PURPOSE_MIN: 10,
  GROUP_PURPOSE_MAX: 500,
  GROUP_TAGS_MIN: 1,
  GROUP_TAGS_MAX: 5,
  GROUP_TAG_ITEM_MAX: 30,
  PROPOSAL_TITLE_MIN: 4,
  PROPOSAL_TITLE_MAX: 120,
  PROPOSAL_SUMMARY_MIN: 10,
  PROPOSAL_SUMMARY_MAX: 600,
  VOUCH_CONTEXT_MIN: 5,
  VOUCH_CONTEXT_MAX: 240,
  HASH_MIN: 16,
  HASH_MAX: 128,
});

const VALID_TIERS: readonly VerificationTier[] = [
  'basic_oauth',
  'credential_attested',
  'multi_party_vouched',
];

const VALID_DOC_TYPES: readonly DocumentCredentialType[] = [
  'passport',
  'national_id',
  'professional_license',
  'hardware_key',
];

const VALID_CATEGORIES: readonly GroupCategory[] = [
  'governance',
  'security',
  'research',
  'finance',
  'community',
];

const VALID_VISIBILITIES: readonly GroupVisibility[] = [
  'public_verified',
  'invite_only',
];

export const validateId = (fieldName: string) => (id: string): Result<string, string> => {
  const trimmed = id.trim();
  if (trimmed.length < 1 || trimmed.length > SCHEMA_CONSTRAINTS.ID_MAX_LEN) {
    return err(`${fieldName} must be between 1 and ${SCHEMA_CONSTRAINTS.ID_MAX_LEN} characters.`);
  }
  if (!SCHEMA_CONSTRAINTS.ID_PATTERN.test(trimmed)) {
    return err(`${fieldName} must contain only alphanumeric characters, underscores, or hyphens.`);
  }
  return ok(trimmed);
};

export const validateStringBounds = (
  fieldName: string,
  min: number,
  max: number
) => (value: string): Result<string, string> => {
  const sanitized = clampString(max)(value);
  if (sanitized.length < min) {
    return err(`${fieldName} must be at least ${min} characters.`);
  }
  return ok(sanitized);
};

export interface ProfileInput {
  readonly uid: string;
  readonly displayName: string;
  readonly handle: string;
  readonly organization: string;
  readonly roleTitle: string;
  readonly verificationTier: VerificationTier;
  readonly bio: string;
}

export const validateProfileInput = (input: ProfileInput): Result<ProfileInput, string> => {
  const uidRes = validateId('User ID')(input.uid);
  if (uidRes.tag === 'err') return uidRes;

  const nameRes = validateStringBounds(
    'Display name',
    SCHEMA_CONSTRAINTS.DISPLAY_NAME_MIN,
    SCHEMA_CONSTRAINTS.DISPLAY_NAME_MAX
  )(input.displayName);
  if (nameRes.tag === 'err') return nameRes;

  const cleanHandle = sanitizeIdentifier(input.handle).slice(0, SCHEMA_CONSTRAINTS.HANDLE_MAX);
  if (cleanHandle.length < SCHEMA_CONSTRAINTS.HANDLE_MIN || !SCHEMA_CONSTRAINTS.ID_PATTERN.test(cleanHandle)) {
    return err(`Handle must be ${SCHEMA_CONSTRAINTS.HANDLE_MIN}–${SCHEMA_CONSTRAINTS.HANDLE_MAX} alphanumeric characters.`);
  }

  const orgRes = validateStringBounds(
    'Organization',
    SCHEMA_CONSTRAINTS.ORG_MIN,
    SCHEMA_CONSTRAINTS.ORG_MAX
  )(input.organization);
  if (orgRes.tag === 'err') return orgRes;

  const roleRes = validateStringBounds(
    'Role title',
    SCHEMA_CONSTRAINTS.ROLE_TITLE_MIN,
    SCHEMA_CONSTRAINTS.ROLE_TITLE_MAX
  )(input.roleTitle);
  if (roleRes.tag === 'err') return roleRes;

  if (!VALID_TIERS.includes(input.verificationTier)) {
    return err('Invalid verification tier.');
  }

  const cleanBio = clampString(SCHEMA_CONSTRAINTS.BIO_MAX)(input.bio);

  return ok(
    Object.freeze({
      uid: uidRes.value,
      displayName: nameRes.value,
      handle: cleanHandle,
      organization: orgRes.value,
      roleTitle: roleRes.value,
      verificationTier: input.verificationTier,
      bio: cleanBio,
    })
  );
};

export interface PrivateVaultInput {
  readonly uid: string;
  readonly email: string;
  readonly jurisdiction: string;
  readonly documentType: DocumentCredentialType;
  readonly documentLastFour: string;
}

export const validatePrivateVaultInput = (
  input: PrivateVaultInput
): Result<PrivateVaultInput, string> => {
  const uidRes = validateId('User ID')(input.uid);
  if (uidRes.tag === 'err') return uidRes;

  const emailRes = validateStringBounds(
    'Email',
    SCHEMA_CONSTRAINTS.EMAIL_MIN,
    SCHEMA_CONSTRAINTS.EMAIL_MAX
  )(input.email);
  if (emailRes.tag === 'err') return emailRes;

  const jurRes = validateStringBounds(
    'Jurisdiction',
    SCHEMA_CONSTRAINTS.JURISDICTION_MIN,
    SCHEMA_CONSTRAINTS.JURISDICTION_MAX
  )(input.jurisdiction);
  if (jurRes.tag === 'err') return jurRes;

  if (!VALID_DOC_TYPES.includes(input.documentType)) {
    return err('Invalid document credential type.');
  }

  const cleanSerial = input.documentLastFour.trim().toUpperCase();
  if (!SCHEMA_CONSTRAINTS.DOC_LAST_FOUR_PATTERN.test(cleanSerial)) {
    return err('Document last four must be exactly 4 uppercase alphanumeric characters (0-9, A-Z).');
  }

  return ok(
    Object.freeze({
      uid: uidRes.value,
      email: emailRes.value,
      jurisdiction: jurRes.value,
      documentType: input.documentType,
      documentLastFour: cleanSerial,
    })
  );
};

export interface CreateGroupInput {
  readonly name: string;
  readonly purpose: string;
  readonly category: GroupCategory;
  readonly requiredTier: VerificationTier;
  readonly visibility: GroupVisibility;
  readonly tags: readonly string[];
}

export const validateCreateGroupInput = (
  input: CreateGroupInput
): Result<CreateGroupInput, string> => {
  const nameRes = validateStringBounds(
    'Group name',
    SCHEMA_CONSTRAINTS.GROUP_NAME_MIN,
    SCHEMA_CONSTRAINTS.GROUP_NAME_MAX
  )(input.name);
  if (nameRes.tag === 'err') return nameRes;

  const purposeRes = validateStringBounds(
    'Group purpose & charter',
    SCHEMA_CONSTRAINTS.GROUP_PURPOSE_MIN,
    SCHEMA_CONSTRAINTS.GROUP_PURPOSE_MAX
  )(input.purpose);
  if (purposeRes.tag === 'err') return purposeRes;

  if (!VALID_CATEGORIES.includes(input.category)) {
    return err('Invalid group category.');
  }
  if (!VALID_TIERS.includes(input.requiredTier)) {
    return err('Invalid required verification tier.');
  }
  if (!VALID_VISIBILITIES.includes(input.visibility)) {
    return err('Invalid group visibility.');
  }

  const sanitizedTags = input.tags
    .map((t) => clampString(SCHEMA_CONSTRAINTS.GROUP_TAG_ITEM_MAX)(t))
    .filter((t) => t.length >= 1)
    .slice(0, SCHEMA_CONSTRAINTS.GROUP_TAGS_MAX);

  const finalTags = sanitizedTags.length > 0 ? sanitizedTags : [input.category];

  return ok(
    Object.freeze({
      name: nameRes.value,
      purpose: purposeRes.value,
      category: input.category,
      requiredTier: input.requiredTier,
      visibility: input.visibility,
      tags: Object.freeze(finalTags),
    })
  );
};

export interface CreateProposalInput {
  readonly groupId: string;
  readonly title: string;
  readonly summary: string;
}

export const validateProposalInput = (
  input: CreateProposalInput
): Result<CreateProposalInput, string> => {
  const grpRes = validateId('Group ID')(input.groupId);
  if (grpRes.tag === 'err') return grpRes;

  const titleRes = validateStringBounds(
    'Proposal title',
    SCHEMA_CONSTRAINTS.PROPOSAL_TITLE_MIN,
    SCHEMA_CONSTRAINTS.PROPOSAL_TITLE_MAX
  )(input.title);
  if (titleRes.tag === 'err') return titleRes;

  const sumRes = validateStringBounds(
    'Proposal summary',
    SCHEMA_CONSTRAINTS.PROPOSAL_SUMMARY_MIN,
    SCHEMA_CONSTRAINTS.PROPOSAL_SUMMARY_MAX
  )(input.summary);
  if (sumRes.tag === 'err') return sumRes;

  return ok(
    Object.freeze({
      groupId: grpRes.value,
      title: titleRes.value,
      summary: sumRes.value,
    })
  );
};

export interface CreateVouchInput {
  readonly voucherId: string;
  readonly targetUserId: string;
  readonly context: string;
}

export const validateVouchInput = (
  input: CreateVouchInput
): Result<CreateVouchInput, string> => {
  const vRes = validateId('Voucher ID')(input.voucherId);
  if (vRes.tag === 'err') return vRes;

  const tRes = validateId('Target User ID')(input.targetUserId);
  if (tRes.tag === 'err') return tRes;

  if (vRes.value === tRes.value) {
    return err('Identity integrity rule violation: You cannot vouch for your own identity.');
  }

  const ctxRes = validateStringBounds(
    'Verification context',
    SCHEMA_CONSTRAINTS.VOUCH_CONTEXT_MIN,
    SCHEMA_CONSTRAINTS.VOUCH_CONTEXT_MAX
  )(input.context);
  if (ctxRes.tag === 'err') return ctxRes;

  return ok(
    Object.freeze({
      voucherId: vRes.value,
      targetUserId: tRes.value,
      context: ctxRes.value,
    })
  );
};
