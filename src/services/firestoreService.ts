import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider } from '../lib/firebase';
import {
  OperationType,
  handleFirestoreError,
  createManagedErrorRecord,
  notifyManagedError,
} from '../managers/errorManager';
import {
  VerifiedProfile,
  PrivateIdentityVault,
  VerifiedGroup,
  GroupMember,
  GroupProposal,
  IdentityVouch,
  VerificationTier,
  ProposalStatus,
  GroupStatus,
} from '../domain/types';
import {
  ProfileInput,
  PrivateVaultInput,
  CreateGroupInput,
  CreateProposalInput,
  CreateVouchInput,
  validateProfileInput,
  validatePrivateVaultInput,
  validateCreateGroupInput,
  validateProposalInput,
  validateVouchInput,
} from '../domain/validators';
import {
  generateIdentityHash,
  generateAttestationSignature,
  generateCharterHash,
  generateVouchSignature,
} from '../domain/crypto';
import { computeVerificationTier } from '../domain/groupLogic';

const formatTimestamp = (value: unknown): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
};

const raiseValidationNotice = (message: string, path: string): never => {
  const record = createManagedErrorRecord({
    id: `val_${Date.now()}`,
    rawMessage: `Validation Error: ${message}`,
    operationType: OperationType.WRITE,
    path,
    timestamp: new Date().toISOString(),
  });
  notifyManagedError(record);
  throw new Error(message);
};

export async function signInWithGooglePopup(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const record = createManagedErrorRecord({
      id: `auth_${Date.now()}`,
      rawMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    notifyManagedError(record);
    throw error;
  }
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Upserts a user's Public Verified Identity Profile (/profiles/{userId})
 */
export async function saveVerifiedProfileFirestore(
  input: ProfileInput,
  existingProfile: VerifiedProfile | null
): Promise<void> {
  const validated = validateProfileInput(input);
  const path = `profiles/${input.uid}`;
  if (validated.tag === 'err') {
    return raiseValidationNotice(validated.error, path);
  }
  const clean = validated.value;

  const identityHash = generateIdentityHash({
    uid: clean.uid,
    handle: clean.handle,
    organization: clean.organization,
    tier: clean.verificationTier,
  });

  const profileRef = doc(db, 'profiles', clean.uid);

  try {
    if (!existingProfile) {
      await setDoc(profileRef, {
        uid: clean.uid,
        displayName: clean.displayName,
        handle: clean.handle,
        organization: clean.organization,
        roleTitle: clean.roleTitle,
        verificationTier: clean.verificationTier,
        identityHash,
        vouchCount: 0,
        bio: clean.bio,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(profileRef, {
        displayName: clean.displayName,
        handle: clean.handle,
        organization: clean.organization,
        roleTitle: clean.roleTitle,
        verificationTier: clean.verificationTier,
        identityHash,
        bio: clean.bio,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existingProfile ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

/**
 * Upserts the user's Isolated Private PII Credential Vault (/users_private/{userId})
 * and upgrades the user's public verificationTier accordingly.
 */
export async function savePrivateIdentityVaultFirestore(
  input: PrivateVaultInput,
  existingVault: PrivateIdentityVault | null,
  currentProfile: VerifiedProfile
): Promise<void> {
  const validated = validatePrivateVaultInput(input);
  const vaultPath = `users_private/${input.uid}`;
  if (validated.tag === 'err') {
    return raiseValidationNotice(validated.error, vaultPath);
  }
  const clean = validated.value;

  const attestationSignature = generateAttestationSignature({
    uid: clean.uid,
    jurisdiction: clean.jurisdiction,
    documentType: clean.documentType,
    documentLastFour: clean.documentLastFour,
  });

  const nextTier: VerificationTier = computeVerificationTier({
    hasAttestedVault: true,
    activeVouchCount: currentProfile.vouchCount,
  });

  const updatedIdentityHash = generateIdentityHash({
    uid: currentProfile.uid,
    handle: currentProfile.handle,
    organization: currentProfile.organization,
    tier: nextTier,
  });

  const vaultRef = doc(db, 'users_private', clean.uid);
  const profileRef = doc(db, 'profiles', clean.uid);

  try {
    const batch = writeBatch(db);
    if (!existingVault) {
      batch.set(vaultRef, {
        uid: clean.uid,
        email: clean.email,
        jurisdiction: clean.jurisdiction,
        documentType: clean.documentType,
        documentLastFour: clean.documentLastFour,
        attestationSignature,
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(vaultRef, {
        jurisdiction: clean.jurisdiction,
        documentType: clean.documentType,
        documentLastFour: clean.documentLastFour,
        attestationSignature,
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(profileRef, {
      verificationTier: nextTier,
      identityHash: updatedIdentityHash,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      existingVault ? OperationType.UPDATE : OperationType.CREATE,
      vaultPath
    );
  }
}

/**
 * Forms a new Verified Group (/groups/{groupId}) and atomically registers
 * the founding creator in /groups/{groupId}/members/{uid}
 */
export async function createVerifiedGroupFirestore(
  input: CreateGroupInput,
  founderProfile: VerifiedProfile
): Promise<string> {
  const validated = validateCreateGroupInput(input);
  if (validated.tag === 'err') {
    return raiseValidationNotice(validated.error, 'groups');
  }
  const clean = validated.value;

  const groupId = `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const groupPath = `groups/${groupId}`;

  const charterHash = generateCharterHash({
    name: clean.name,
    purpose: clean.purpose,
    category: clean.category,
    requiredTier: clean.requiredTier,
  });

  const groupRef = doc(db, 'groups', groupId);
  const founderMemberRef = doc(db, 'groups', groupId, 'members', founderProfile.uid);

  try {
    const batch = writeBatch(db);
    batch.set(groupRef, {
      id: groupId,
      name: clean.name,
      purpose: clean.purpose,
      category: clean.category,
      requiredTier: clean.requiredTier,
      visibility: clean.visibility,
      ownerId: founderProfile.uid,
      ownerName: founderProfile.displayName,
      memberCount: 1,
      status: 'active',
      tags: [...clean.tags],
      charterHash,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(founderMemberRef, {
      uid: founderProfile.uid,
      groupId,
      displayName: founderProfile.displayName,
      role: 'founder',
      verificationTier: founderProfile.verificationTier,
      identityHash: founderProfile.identityHash,
      membershipStatus: 'active',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return groupId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, groupPath);
  }
}

/**
 * Atomically joins an existing Verified Group (/groups/{groupId}/members/{uid})
 * and increments memberCount on /groups/{groupId}
 */
export async function joinVerifiedGroupFirestore(
  group: VerifiedGroup,
  memberProfile: VerifiedProfile
): Promise<void> {
  const memberPath = `groups/${group.id}/members/${memberProfile.uid}`;
  const groupRef = doc(db, 'groups', group.id);
  const memberRef = doc(db, 'groups', group.id, 'members', memberProfile.uid);

  try {
    const batch = writeBatch(db);
    batch.set(memberRef, {
      uid: memberProfile.uid,
      groupId: group.id,
      displayName: memberProfile.displayName,
      role: 'verified_member',
      verificationTier: memberProfile.verificationTier,
      identityHash: memberProfile.identityHash,
      membershipStatus: 'active',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(groupRef, {
      memberCount: group.memberCount + 1,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }
}

/**
 * Updates a group's lifecycle status (Owner action: active | locked | archived)
 */
export async function updateGroupStatusFirestore(
  groupId: string,
  nextStatus: GroupStatus
): Promise<void> {
  const path = `groups/${groupId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Submits a cryptographically attested Proposal inside a Verified Group
 */
export async function createGroupProposalFirestore(
  input: CreateProposalInput,
  authorProfile: VerifiedProfile
): Promise<string> {
  const validated = validateProposalInput(input);
  if (validated.tag === 'err') {
    return raiseValidationNotice(validated.error, `groups/${input.groupId}/proposals`);
  }
  const clean = validated.value;

  const proposalId = `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `groups/${clean.groupId}/proposals/${proposalId}`;

  try {
    await setDoc(doc(db, 'groups', clean.groupId, 'proposals', proposalId), {
      id: proposalId,
      groupId: clean.groupId,
      authorId: authorProfile.uid,
      authorName: authorProfile.displayName,
      authorIdentityHash: authorProfile.identityHash,
      title: clean.title,
      summary: clean.summary,
      status: 'open',
      approvalsCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return proposalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Co-signs / approves an open Group Proposal, optionally ratifying it if quorum reached
 */
export async function endorseGroupProposalFirestore(
  proposal: GroupProposal,
  quorumThreshold: number
): Promise<void> {
  const path = `groups/${proposal.groupId}/proposals/${proposal.id}`;
  const nextApprovals = proposal.approvalsCount + 1;
  const nextStatus: ProposalStatus =
    nextApprovals >= quorumThreshold ? 'ratified' : proposal.status;

  try {
    await updateDoc(doc(db, 'groups', proposal.groupId, 'proposals', proposal.id), {
      approvalsCount: nextApprovals,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Issues a Peer Cryptographic Identity Vouch (/vouches/{vouchId})
 * and atomically increments target user's vouchCount & verificationTier
 */
export async function issuePeerVouchFirestore(
  input: CreateVouchInput,
  voucherProfile: VerifiedProfile,
  targetProfile: VerifiedProfile
): Promise<void> {
  const validated = validateVouchInput(input);
  if (validated.tag === 'err') {
    return raiseValidationNotice(validated.error, 'vouches');
  }
  const clean = validated.value;

  const vouchId = `vch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const vouchPath = `vouches/${vouchId}`;

  const signatureHash = generateVouchSignature({
    voucherId: clean.voucherId,
    targetUserId: clean.targetUserId,
    context: clean.context,
  });

  const nextVouchCount = targetProfile.vouchCount + 1;
  const nextTier: VerificationTier =
    nextVouchCount >= 2 ? 'multi_party_vouched' : 'credential_attested';

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'vouches', vouchId), {
      id: vouchId,
      voucherId: voucherProfile.uid,
      voucherName: voucherProfile.displayName,
      targetUserId: targetProfile.uid,
      targetUserName: targetProfile.displayName,
      context: clean.context,
      signatureHash,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'profiles', targetProfile.uid), {
      vouchCount: nextVouchCount,
      verificationTier: nextTier,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, vouchPath);
  }
}

/**
 * Real-time Subscriptions synchronized with Secure List Query rules (Pillar 8)
 */
export function subscribeToVerifiedEcosystem(
  uid: string,
  callbacks: Readonly<{
    readonly onProfiles: (profiles: readonly VerifiedProfile[]) => void;
    readonly onPrivateVault: (vault: PrivateIdentityVault | null) => void;
    readonly onGroups: (groups: readonly VerifiedGroup[]) => void;
    readonly onVouches: (vouches: readonly IdentityVouch[]) => void;
  }>
): Unsubscribe {
  const unsubscribes: Unsubscribe[] = [];

  // 1. Public Verified Profiles (filtered by verificationTier to satisfy Pillar 8 allow list)
  const profilesQuery = query(
    collection(db, 'profiles'),
    where('verificationTier', 'in', [
      'basic_oauth',
      'credential_attested',
      'multi_party_vouched',
    ])
  );
  unsubscribes.push(
    onSnapshot(
      profilesQuery,
      (snap) => {
        const list: VerifiedProfile[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid ?? d.id),
            displayName: String(data.displayName ?? ''),
            handle: String(data.handle ?? ''),
            organization: String(data.organization ?? ''),
            roleTitle: String(data.roleTitle ?? ''),
            verificationTier: (data.verificationTier as VerificationTier) ?? 'basic_oauth',
            identityHash: String(data.identityHash ?? ''),
            vouchCount: Number(data.vouchCount ?? 0),
            bio: String(data.bio ?? ''),
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt),
          };
        });
        callbacks.onProfiles(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'profiles')
    )
  );

  // 2. Owner's Private PII Vault (single-document get/snapshot, never list!)
  const vaultDocRef = doc(db, 'users_private', uid);
  unsubscribes.push(
    onSnapshot(
      vaultDocRef,
      (snap) => {
        if (!snap.exists()) {
          callbacks.onPrivateVault(null);
          return;
        }
        const data = snap.data();
        callbacks.onPrivateVault({
          uid: String(data.uid ?? snap.id),
          email: String(data.email ?? ''),
          jurisdiction: String(data.jurisdiction ?? ''),
          documentType: data.documentType ?? 'passport',
          documentLastFour: String(data.documentLastFour ?? ''),
          attestationSignature: String(data.attestationSignature ?? ''),
          verifiedAt: formatTimestamp(data.verifiedAt),
          updatedAt: formatTimestamp(data.updatedAt),
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users_private/${uid}`)
    )
  );

  // 3. Verified Groups (query public_verified groups to satisfy Pillar 8 allow list)
  const publicGroupsQuery = query(
    collection(db, 'groups'),
    where('visibility', '==', 'public_verified')
  );
  unsubscribes.push(
    onSnapshot(
      publicGroupsQuery,
      (snap) => {
        const list: VerifiedGroup[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            name: String(data.name ?? ''),
            purpose: String(data.purpose ?? ''),
            category: data.category ?? 'governance',
            requiredTier: data.requiredTier ?? 'basic_oauth',
            visibility: data.visibility ?? 'public_verified',
            ownerId: String(data.ownerId ?? ''),
            ownerName: String(data.ownerName ?? ''),
            memberCount: Number(data.memberCount ?? 1),
            status: data.status ?? 'active',
            tags: Array.isArray(data.tags) ? data.tags.map(String) : ['governance'],
            charterHash: String(data.charterHash ?? ''),
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt),
          };
        });
        callbacks.onGroups(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'groups')
    )
  );

  // 4. Active Peer Vouches (filtered by status == 'active' to satisfy Pillar 8 allow list)
  const vouchesQuery = query(
    collection(db, 'vouches'),
    where('status', '==', 'active')
  );
  unsubscribes.push(
    onSnapshot(
      vouchesQuery,
      (snap) => {
        const list: IdentityVouch[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            voucherId: String(data.voucherId ?? ''),
            voucherName: String(data.voucherName ?? ''),
            targetUserId: String(data.targetUserId ?? ''),
            targetUserName: String(data.targetUserName ?? ''),
            context: String(data.context ?? ''),
            signatureHash: String(data.signatureHash ?? ''),
            status: data.status ?? 'active',
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt),
          };
        });
        callbacks.onVouches(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vouches')
    )
  );

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

/**
 * Subscribes to a specific Verified Group's active members and proposals
 */
export function subscribeToGroupAssemblyDetails(
  groupId: string,
  callbacks: Readonly<{
    readonly onMembers: (members: readonly GroupMember[]) => void;
    readonly onProposals: (proposals: readonly GroupProposal[]) => void;
  }>
): Unsubscribe {
  const membersPath = `groups/${groupId}/members`;
  const proposalsPath = `groups/${groupId}/proposals`;

  const membersQuery = query(
    collection(db, 'groups', groupId, 'members'),
    where('membershipStatus', '==', 'active')
  );

  const proposalsQuery = query(
    collection(db, 'groups', groupId, 'proposals'),
    where('status', 'in', ['open', 'ratified', 'rejected'])
  );

  const unsubMembers = onSnapshot(
    membersQuery,
    (snap) => {
      const members: GroupMember[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid ?? d.id),
          groupId: String(data.groupId ?? groupId),
          displayName: String(data.displayName ?? ''),
          role: data.role ?? 'verified_member',
          verificationTier: data.verificationTier ?? 'basic_oauth',
          identityHash: String(data.identityHash ?? ''),
          membershipStatus: data.membershipStatus ?? 'active',
          joinedAt: formatTimestamp(data.joinedAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      callbacks.onMembers(members);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, membersPath)
  );

  const unsubProposals = onSnapshot(
    proposalsQuery,
    (snap) => {
      const proposals: GroupProposal[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          groupId: String(data.groupId ?? groupId),
          authorId: String(data.authorId ?? ''),
          authorName: String(data.authorName ?? ''),
          authorIdentityHash: String(data.authorIdentityHash ?? ''),
          title: String(data.title ?? ''),
          summary: String(data.summary ?? ''),
          status: data.status ?? 'open',
          approvalsCount: Number(data.approvalsCount ?? 1),
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      callbacks.onProposals(proposals);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, proposalsPath)
  );

  return () => {
    unsubMembers();
    unsubProposals();
  };
}

/**
 * Checks if user has a profile document on initial sign-in, and if not,
 * provisions an initial Tier 1 (basic_oauth) verified profile so they can
 * immediately participate or upgrade to Tier 2/3.
 */
export async function ensureInitialVerifiedProfile(user: Readonly<{
  readonly uid: string;
  readonly displayName: string | null;
  readonly email: string | null;
}>): Promise<void> {
  const path = `profiles/${user.uid}`;
  const profileRef = doc(db, 'profiles', user.uid);
  try {
    const snap = await getDoc(profileRef);
    if (snap.exists()) return;

    const rawName = (user.displayName || user.email?.split('@')[0] || 'Verified Member').slice(0, 80);
    const displayName = rawName.length >= 2 ? rawName : 'Verified Member';
    const rawHandle = (user.email?.split('@')[0] || `member_${user.uid.slice(0, 6)}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 32);
    const handle = rawHandle.length >= 3 ? rawHandle : `id_${user.uid.slice(0, 8)}`;

    const identityHash = generateIdentityHash({
      uid: user.uid,
      handle,
      organization: 'Independent Identity Holder',
      tier: 'basic_oauth',
    });

    await setDoc(profileRef, {
      uid: user.uid,
      displayName,
      handle,
      organization: 'Independent Identity Holder',
      roleTitle: 'Verified Assembly Delegate',
      verificationTier: 'basic_oauth',
      identityHash,
      vouchCount: 0,
      bio: 'Authenticated identity holder verified via federated OAuth token.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
