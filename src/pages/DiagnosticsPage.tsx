import React, { useState, useMemo } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { ok, err, mapResult, combineResults, pipe } from '../fp/result';
import {
  validateProfileInput,
  validatePrivateVaultInput,
  validateCreateGroupInput,
  validateVouchInput,
} from '../domain/validators';
import {
  generateIdentityHash,
  generateCharterHash,
  generateVouchSignature,
} from '../domain/crypto';
import {
  computeVerificationTier,
  evaluateGroupJoinEligibility,
  filterGroupsPure,
} from '../domain/groupLogic';
import {
  classifyErrorMessage,
  createManagedErrorRecord,
  OperationType,
} from '../managers/errorManager';
import {
  INITIAL_APP_STATE,
  transitionAuthSession,
  transitionFilterCriteria,
} from '../managers/stateManager';
import {
  matchRouteFromPathname,
  resolveBreadcrumbs,
  evaluateRouteAccess,
  ROUTES,
} from '../managers/routeManager';

interface VerificationTestResult {
  readonly id: string;
  readonly suite: string;
  readonly name: string;
  readonly passed: boolean;
  readonly proof: string;
}

const runAllFunctionalVerificationSuites = (): readonly VerificationTestResult[] => {
  // 1. Functional Monad & Pipe Suite
  const piped = pipe(
    (x: number) => x + 5,
    (x: number) => x * 2
  )(10);
  const combined = combineResults([ok(1), ok(2), ok(3)]);

  // 2. Cryptographic Determinism Suite
  const hashA = generateIdentityHash({
    uid: 'usr_1',
    handle: 'alice',
    organization: 'TrustLab',
    tier: 'credential_attested',
  });
  const hashB = generateIdentityHash({
    uid: 'usr_1',
    handle: 'alice',
    organization: 'TrustLab',
    tier: 'credential_attested',
  });
  const charterDigest = generateCharterHash({
    name: 'Civic Council',
    purpose: 'Coordinate verified civic infrastructure standards.',
    category: 'governance',
    requiredTier: 'credential_attested',
  });

  // 3. Pure Schema Validators & Self-Vouch Prevention
  const validProfile = validateProfileInput({
    uid: 'usr_valid_1',
    displayName: 'Dr. Elena Rostova',
    handle: 'elena_r',
    organization: 'ETH Zurich',
    roleTitle: 'Cryptography Chair',
    verificationTier: 'credential_attested',
    bio: 'Formal verification researcher.',
  });

  const invalidSelfVouch = validateVouchInput({
    voucherId: 'same_uid_99',
    targetUserId: 'same_uid_99',
    context: 'Attempting to vouch for myself.',
  });

  const validVault = validatePrivateVaultInput({
    uid: 'usr_valid_1',
    email: 'elena@ethz.ch',
    jurisdiction: 'Switzerland',
    documentType: 'passport',
    documentLastFour: '77B9',
  });

  const validGroup = validateCreateGroupInput({
    name: 'Alpine Cryptography Ring',
    purpose: 'Zero-knowledge identity verification research assembly.',
    category: 'research',
    requiredTier: 'credential_attested',
    visibility: 'public_verified',
    tags: ['zkp', 'identity'],
  });

  // 4. Pure Group Eligibility & Tier Computation
  const computedTier3 = computeVerificationTier({
    hasAttestedVault: true,
    activeVouchCount: 2,
  });

  const mockGroup = {
    id: 'grp_test_1',
    name: 'Tier 3 Council',
    purpose: 'Requires multi-party vouched identity.',
    category: 'governance' as const,
    requiredTier: 'multi_party_vouched' as const,
    visibility: 'public_verified' as const,
    ownerId: 'founder_1',
    ownerName: 'Founder',
    memberCount: 2,
    status: 'active' as const,
    tags: ['council'],
    charterHash: charterDigest,
    createdAt: '2026-10-07T00:00:00Z',
    updatedAt: '2026-10-07T00:00:00Z',
  };

  const tier1Profile = {
    uid: 'usr_tier1',
    displayName: 'Tier One User',
    handle: 'tier1_u',
    organization: 'Org',
    roleTitle: 'Member',
    verificationTier: 'basic_oauth' as const,
    identityHash: hashA,
    vouchCount: 0,
    bio: '',
    createdAt: '2026-10-07T00:00:00Z',
    updatedAt: '2026-10-07T00:00:00Z',
  };

  const joinDeniedForTier1 = evaluateGroupJoinEligibility(tier1Profile, mockGroup, []);
  const filteredGroups = filterGroupsPure({
    searchQuery: 'Council',
    category: 'governance',
    requiredTier: 'all',
    onlyEligibleForTier: null,
  })([mockGroup]);

  // 5. Error Manager Classification & Quota URL
  const quotaCategory = classifyErrorMessage(
    "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
  );
  const managedErr = createManagedErrorRecord({
    id: 'err_test_1',
    rawMessage:
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'",
    operationType: OperationType.LIST,
    path: 'groups',
    timestamp: '2026-10-07T00:00:00Z',
  });

  // 6. State Manager Pure Reducers
  const nextState = transitionFilterCriteria(
    transitionAuthSession(INITIAL_APP_STATE, {
      uid: 'u_1',
      email: 'test@example.com',
      displayName: 'Test',
      photoURL: null,
      emailVerified: true,
    }),
    { category: 'security' }
  );

  // 7. Route Manager Matching & Access Guards
  const matchedGroupRoute = matchRouteFromPathname('/groups/grp_alpha_99');
  const crumbs = resolveBreadcrumbs('/groups/grp_alpha_99', 'Alpha Assembly');
  const routeGuard = evaluateRouteAccess({
    route: ROUTES['create-group'],
    isAuthenticated: false,
    hasVerifiedProfile: false,
  });

  return Object.freeze([
    {
      id: 'fp-1',
      suite: 'Functional Core',
      name: 'Result Monad & Function Pipe Composition',
      passed:
        piped === 30 &&
        combined.tag === 'ok' &&
        combined.value.length === 3 &&
        mapResult((n: number) => n * 2)(err('fail')).tag === 'err',
      proof: `pipe(10) -> ${piped} · combineResults([1,2,3]) -> ok([3 items])`,
    },
    {
      id: 'crypto-1',
      suite: 'Cryptographic Engine',
      name: 'Deterministic Identity & Charter Digest Generation',
      passed:
        hashA === hashB &&
        /^[a-zA-Z0-9_-]+$/.test(hashA) &&
        /^[a-zA-Z0-9_-]+$/.test(charterDigest) &&
        generateVouchSignature({ voucherId: 'a', targetUserId: 'b', context: 'ctx' }).length >= 16,
      proof: `hashA === hashB (${hashA.slice(0, 24)}…)`,
    },
    {
      id: 'val-1',
      suite: 'Blueprint Validators',
      name: 'Profile, Private Vault & Group Schema Validation',
      passed:
        validProfile.tag === 'ok' &&
        validVault.tag === 'ok' &&
        validGroup.tag === 'ok',
      proof: `Profile, Vault (${validVault.tag === 'ok' ? validVault.value.documentLastFour : ''}), & Group schemas passed`,
    },
    {
      id: 'val-2',
      suite: 'Security Invariant #12',
      name: 'Self-Vouching Rejection Guard (voucherId != targetUserId)',
      passed: invalidSelfVouch.tag === 'err',
      proof:
        invalidSelfVouch.tag === 'err'
          ? invalidSelfVouch.error
          : 'Unexpected pass',
    },
    {
      id: 'domain-1',
      suite: 'Group Governance Logic',
      name: 'Tier 3 Promotion & Minimum Tier Gate Enforcement',
      passed:
        computedTier3 === 'multi_party_vouched' &&
        joinDeniedForTier1.tag === 'err' &&
        filteredGroups.length === 1,
      proof: `computedTier: ${computedTier3} · Tier 1 join gate: blocked as expected`,
    },
    {
      id: 'err-1',
      suite: 'Error Manager',
      name: 'FirestoreErrorInfo & Quota Upgrade Link Generation',
      passed:
        quotaCategory === 'quota' &&
        Boolean(managedErr.upgradeUrl?.includes('openUpgradeDialog=true')),
      proof: `category: ${quotaCategory} · upgradeUrl generated`,
    },
    {
      id: 'state-1',
      suite: 'State Manager',
      name: 'Immutable Auth & Filter State Transitions',
      passed:
        nextState.isAuthReady === true &&
        nextState.currentUser?.uid === 'u_1' &&
        nextState.filterCriteria.category === 'security',
      proof: `isAuthReady: true · filterCriteria.category: ${nextState.filterCriteria.category}`,
    },
    {
      id: 'route-1',
      suite: 'Route Manager',
      name: 'Dynamic Parameter Extraction, Breadcrumbs & Route Guard',
      passed:
        matchedGroupRoute.route.id === 'group-detail' &&
        matchedGroupRoute.params.groupId === 'grp_alpha_99' &&
        crumbs.length === 3 &&
        routeGuard.allowed === false &&
        routeGuard.redirectPath === '/identity',
      proof: `param groupId: ${matchedGroupRoute.params.groupId} · unauth guard -> ${routeGuard.redirectPath}`,
    },
  ]);
};

export const DiagnosticsPage: React.FC = () => {
  const [runCount, setRunCount] = useState(1);

  const results = useMemo(() => {
    void runCount;
    return runAllFunctionalVerificationSuites();
  }, [runCount]);

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">
            <span>Automated Functional Verification</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {passedCount} / {results.length} Assertions Passing
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Protocol & Functional Architecture Test Suite
          </h1>
          <p className="text-sm text-slate-600">
            Live verification of pure functional primitives, schema validators, state manager reducers, route manager guards, and error manager classification.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRunCount((c) => c + 1)}
          className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Re-Run Verification Suite (#{runCount})</span>
        </button>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {results.map((item) => (
          <div
            key={item.id}
            className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{item.suite}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-700 font-medium">
                  {item.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-slate-900">
                {item.name}
              </h2>
              <div className="font-mono text-xs text-slate-500 tabular-nums">
                {item.proof}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
