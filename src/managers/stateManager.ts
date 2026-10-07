import { create } from 'zustand';
import {
  VerifiedProfile,
  PrivateIdentityVault,
  VerifiedGroup,
  GroupMember,
  GroupProposal,
  IdentityVouch,
  GroupFilterCriteria,
  GroupCategory,
  VerificationTier,
} from '../domain/types';
import {
  ManagedErrorRecord,
  appendErrorPure,
  dismissErrorPure,
  clearAllErrorsPure,
} from './errorManager';
import { filterGroupsPure } from '../domain/groupLogic';

/**
 * Pure Functional State Transitions + Zustand State Manager
 */

export interface AuthSessionUser {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly photoURL: string | null;
  readonly emailVerified: boolean;
}

export interface AppStateSnapshot {
  readonly isAuthReady: boolean;
  readonly isLoadingData: boolean;
  readonly currentUser: AuthSessionUser | null;
  readonly myProfile: VerifiedProfile | null;
  readonly myPrivateVault: PrivateIdentityVault | null;
  readonly profilesDirectory: readonly VerifiedProfile[];
  readonly groups: readonly VerifiedGroup[];
  readonly membersByGroup: Readonly<Record<string, readonly GroupMember[]>>;
  readonly proposalsByGroup: Readonly<Record<string, readonly GroupProposal[]>>;
  readonly vouches: readonly IdentityVouch[];
  readonly filterCriteria: GroupFilterCriteria;
  readonly errors: readonly ManagedErrorRecord[];
  readonly activeBannerNotice: string | null;
}

export const INITIAL_FILTER_CRITERIA: GroupFilterCriteria = Object.freeze({
  searchQuery: '',
  category: 'all',
  requiredTier: 'all',
  onlyEligibleForTier: null,
});

export const INITIAL_APP_STATE: AppStateSnapshot = Object.freeze({
  isAuthReady: false,
  isLoadingData: false,
  currentUser: null,
  myProfile: null,
  myPrivateVault: null,
  profilesDirectory: Object.freeze([]),
  groups: Object.freeze([]),
  membersByGroup: Object.freeze({}),
  proposalsByGroup: Object.freeze({}),
  vouches: Object.freeze([]),
  filterCriteria: INITIAL_FILTER_CRITERIA,
  errors: Object.freeze([]),
  activeBannerNotice: null,
});

/**
 * Pure State Reducers / Transition Functions (100% deterministic & testable)
 */
export const transitionAuthSession = (
  state: AppStateSnapshot,
  user: AuthSessionUser | null
): AppStateSnapshot =>
  Object.freeze({
    ...state,
    isAuthReady: true,
    currentUser: user,
    myProfile: user ? state.myProfile : null,
    myPrivateVault: user ? state.myPrivateVault : null,
  });

export const transitionMyProfile = (
  state: AppStateSnapshot,
  profile: VerifiedProfile | null
): AppStateSnapshot =>
  Object.freeze({
    ...state,
    myProfile: profile,
  });

export const transitionMyPrivateVault = (
  state: AppStateSnapshot,
  vault: PrivateIdentityVault | null
): AppStateSnapshot =>
  Object.freeze({
    ...state,
    myPrivateVault: vault,
  });

export const transitionProfilesDirectory = (
  state: AppStateSnapshot,
  profiles: readonly VerifiedProfile[]
): AppStateSnapshot => {
  const sorted = [...profiles].sort((a, b) => b.vouchCount - a.vouchCount);
  const myUpdatedProfile = state.currentUser
    ? sorted.find((p) => p.uid === state.currentUser?.uid) ?? state.myProfile
    : state.myProfile;

  return Object.freeze({
    ...state,
    profilesDirectory: Object.freeze(sorted),
    myProfile: myUpdatedProfile,
  });
};

export const transitionGroupsList = (
  state: AppStateSnapshot,
  groups: readonly VerifiedGroup[]
): AppStateSnapshot => {
  const deduplicatedMap = new Map<string, VerifiedGroup>();
  groups.forEach((g) => deduplicatedMap.set(g.id, g));
  const sorted = Array.from(deduplicatedMap.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  return Object.freeze({
    ...state,
    groups: Object.freeze(sorted),
  });
};

export const transitionGroupMembers = (
  state: AppStateSnapshot,
  groupId: string,
  members: readonly GroupMember[]
): AppStateSnapshot =>
  Object.freeze({
    ...state,
    membersByGroup: Object.freeze({
      ...state.membersByGroup,
      [groupId]: Object.freeze([...members]),
    }),
  });

export const transitionGroupProposals = (
  state: AppStateSnapshot,
  groupId: string,
  proposals: readonly GroupProposal[]
): AppStateSnapshot => {
  const sorted = [...proposals].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  return Object.freeze({
    ...state,
    proposalsByGroup: Object.freeze({
      ...state.proposalsByGroup,
      [groupId]: Object.freeze(sorted),
    }),
  });
};

export const transitionVouchesList = (
  state: AppStateSnapshot,
  vouches: readonly IdentityVouch[]
): AppStateSnapshot => {
  const sorted = [...vouches].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  return Object.freeze({
    ...state,
    vouches: Object.freeze(sorted),
  });
};

export const transitionFilterCriteria = (
  state: AppStateSnapshot,
  patch: Partial<GroupFilterCriteria>
): AppStateSnapshot =>
  Object.freeze({
    ...state,
    filterCriteria: Object.freeze({
      ...state.filterCriteria,
      ...patch,
    }),
  });

export const selectVisibleGroups = (
  state: AppStateSnapshot
): readonly VerifiedGroup[] => filterGroupsPure(state.filterCriteria)(state.groups);

/**
 * Zustand Store Interface binding Pure Reducers
 */
export interface AppStore extends AppStateSnapshot {
  setAuthSession: (user: AuthSessionUser | null) => void;
  setLoadingData: (loading: boolean) => void;
  setMyProfile: (profile: VerifiedProfile | null) => void;
  setMyPrivateVault: (vault: PrivateIdentityVault | null) => void;
  setProfilesDirectory: (profiles: readonly VerifiedProfile[]) => void;
  setGroups: (groups: readonly VerifiedGroup[]) => void;
  setGroupMembers: (groupId: string, members: readonly GroupMember[]) => void;
  setGroupProposals: (groupId: string, proposals: readonly GroupProposal[]) => void;
  setVouches: (vouches: readonly IdentityVouch[]) => void;
  updateFilter: (patch: Partial<GroupFilterCriteria>) => void;
  resetFilter: () => void;
  pushError: (record: ManagedErrorRecord) => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
  setBannerNotice: (notice: string | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  ...INITIAL_APP_STATE,

  setAuthSession: (user) => set((state) => transitionAuthSession(state, user)),
  setLoadingData: (isLoadingData) => set((state) => ({ ...state, isLoadingData })),
  setMyProfile: (profile) => set((state) => transitionMyProfile(state, profile)),
  setMyPrivateVault: (vault) => set((state) => transitionMyPrivateVault(state, vault)),
  setProfilesDirectory: (profiles) =>
    set((state) => transitionProfilesDirectory(state, profiles)),
  setGroups: (groups) => set((state) => transitionGroupsList(state, groups)),
  setGroupMembers: (groupId, members) =>
    set((state) => transitionGroupMembers(state, groupId, members)),
  setGroupProposals: (groupId, proposals) =>
    set((state) => transitionGroupProposals(state, groupId, proposals)),
  setVouches: (vouches) => set((state) => transitionVouchesList(state, vouches)),
  updateFilter: (patch) => set((state) => transitionFilterCriteria(state, patch)),
  resetFilter: () =>
    set((state) => ({ ...state, filterCriteria: INITIAL_FILTER_CRITERIA })),
  pushError: (record) =>
    set((state) => ({ ...state, errors: appendErrorPure(record)(state.errors) })),
  dismissError: (id) =>
    set((state) => ({ ...state, errors: dismissErrorPure(id)(state.errors) })),
  clearErrors: () =>
    set((state) => ({ ...state, errors: clearAllErrorsPure() })),
  setBannerNotice: (activeBannerNotice) =>
    set((state) => ({ ...state, activeBannerNotice })),
}));

export const setCategoryFilterHelper = (category: GroupCategory | 'all') =>
  useAppStore.getState().updateFilter({ category });

export const setTierFilterHelper = (requiredTier: VerificationTier | 'all') =>
  useAppStore.getState().updateFilter({ requiredTier });
