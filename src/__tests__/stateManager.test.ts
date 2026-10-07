import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_APP_STATE,
  transitionAuthSession,
  transitionProfilesDirectory,
  transitionGroupsList,
  transitionGroupMembers,
  transitionGroupProposals,
  transitionVouchesList,
  transitionFilterCriteria,
  selectVisibleGroups,
  useAppStore,
} from '../managers/stateManager';

describe('State Manager Pure Transitions & Zustand Store Suite', () => {
  beforeEach(() => {
    useAppStore.setState(INITIAL_APP_STATE);
  });

  it('transitions auth session immutably', () => {
    const s1 = transitionAuthSession(INITIAL_APP_STATE, {
      uid: 'u_99',
      email: 'alice@verified.org',
      displayName: 'Alice',
      photoURL: null,
      emailVerified: true,
    });
    expect(s1.isAuthReady).toBe(true);
    expect(s1.currentUser?.uid).toBe('u_99');

    const s2 = transitionAuthSession(s1, null);
    expect(s2.currentUser).toBeNull();
    expect(s2.myProfile).toBeNull();
  });

  it('sorts profiles directory by vouchCount and syncs myProfile for current user', () => {
    const authed = transitionAuthSession(INITIAL_APP_STATE, {
      uid: 'u_2',
      email: 'bob@verified.org',
      displayName: 'Bob',
      photoURL: null,
      emailVerified: true,
    });

    const next = transitionProfilesDirectory(authed, [
      {
        uid: 'u_1',
        displayName: 'Alice',
        handle: 'alice',
        organization: 'Org',
        roleTitle: 'Lead',
        verificationTier: 'basic_oauth',
        identityHash: 'id_sha256_1111111111111111',
        vouchCount: 1,
        bio: '',
        createdAt: '2026-10-07T00:00:00Z',
        updatedAt: '2026-10-07T00:00:00Z',
      },
      {
        uid: 'u_2',
        displayName: 'Bob',
        handle: 'bob',
        organization: 'Org',
        roleTitle: 'Director',
        verificationTier: 'multi_party_vouched',
        identityHash: 'id_sha256_2222222222222222',
        vouchCount: 4,
        bio: '',
        createdAt: '2026-10-07T00:00:00Z',
        updatedAt: '2026-10-07T00:00:00Z',
      },
    ]);

    expect(next.profilesDirectory[0].uid).toBe('u_2');
    expect(next.myProfile?.uid).toBe('u_2');
  });

  it('manages groups, members, proposals, vouches, and filters via Zustand store actions', () => {
    const store = useAppStore.getState();

    store.setGroups([
      {
        id: 'grp_1',
        name: 'Cyber Defense Circle',
        purpose: 'Zero-trust incident response group.',
        category: 'security',
        requiredTier: 'credential_attested',
        visibility: 'public_verified',
        ownerId: 'u_1',
        ownerName: 'Alice',
        memberCount: 3,
        status: 'active',
        tags: ['security'],
        charterHash: 'chr_sha256_1234567890abcdef',
        createdAt: '2026-10-07T01:00:00Z',
        updatedAt: '2026-10-07T01:00:00Z',
      },
      {
        id: 'grp_2',
        name: 'Civic Budget Council',
        purpose: 'Municipal transparency assembly.',
        category: 'governance',
        requiredTier: 'basic_oauth',
        visibility: 'public_verified',
        ownerId: 'u_2',
        ownerName: 'Bob',
        memberCount: 5,
        status: 'active',
        tags: ['civic'],
        charterHash: 'chr_sha256_abcdef1234567890',
        createdAt: '2026-10-07T02:00:00Z',
        updatedAt: '2026-10-07T02:00:00Z',
      },
    ]);

    expect(useAppStore.getState().groups.length).toBe(2);

    store.updateFilter({ category: 'security' });
    const visible = selectVisibleGroups(useAppStore.getState());
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe('grp_1');

    store.resetFilter();
    expect(selectVisibleGroups(useAppStore.getState()).length).toBe(2);

    const withMembers = transitionGroupMembers(useAppStore.getState(), 'grp_1', [
      {
        uid: 'u_1',
        groupId: 'grp_1',
        displayName: 'Alice',
        role: 'founder',
        verificationTier: 'credential_attested',
        identityHash: 'id_sha256_1111111111111111',
        membershipStatus: 'active',
        joinedAt: '2026-10-07T01:00:00Z',
        updatedAt: '2026-10-07T01:00:00Z',
      },
    ]);
    expect(withMembers.membersByGroup['grp_1'].length).toBe(1);

    const withProposals = transitionGroupProposals(withMembers, 'grp_1', []);
    expect(withProposals.proposalsByGroup['grp_1'].length).toBe(0);

    const withVouches = transitionVouchesList(withProposals, []);
    expect(withVouches.vouches.length).toBe(0);

    const withFilter = transitionFilterCriteria(withVouches, { searchQuery: 'Civic' });
    expect(withFilter.filterCriteria.searchQuery).toBe('Civic');
  });
});
