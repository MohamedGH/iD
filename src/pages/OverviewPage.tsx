import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import {
  useAppStore,
  selectVisibleGroups,
} from '../managers/stateManager';
import {
  GroupCategory,
  VerificationTier,
} from '../domain/types';
import {
  formatTierLabel,
  evaluateGroupJoinEligibility,
  calculateTrustIndex,
} from '../domain/groupLogic';
import { formatShortHash } from '../domain/crypto';
import { buildGroupDetailPath } from '../managers/routeManager';
import {
  signInWithGooglePopup,
  createVerifiedGroupFirestore,
} from '../services/firestoreService';
import { ResilientImage, VISUAL_ASSETS } from '../components/ResilientImage';

const CATEGORY_OPTIONS: ReadonlyArray<{
  readonly value: GroupCategory | 'all';
  readonly label: string;
}> = [
  { value: 'all', label: 'All Assemblies' },
  { value: 'governance', label: 'Governance' },
  { value: 'security', label: 'Security' },
  { value: 'research', label: 'Research' },
  { value: 'finance', label: 'Finance' },
  { value: 'community', label: 'Community' },
];

const TIER_FILTER_OPTIONS: ReadonlyArray<{
  readonly value: VerificationTier | 'all';
  readonly label: string;
}> = [
  { value: 'all', label: 'Any Tier' },
  { value: 'basic_oauth', label: 'Tier 1 · OAuth' },
  { value: 'credential_attested', label: 'Tier 2 · Credential' },
  { value: 'multi_party_vouched', label: 'Tier 3 · Vouched' },
];

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const myProfile = useAppStore((s) => s.myProfile);
  const groups = useAppStore((s) => s.groups);
  const profilesDirectory = useAppStore((s) => s.profilesDirectory);
  const vouches = useAppStore((s) => s.vouches);
  const filterCriteria = useAppStore((s) => s.filterCriteria);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const resetFilter = useAppStore((s) => s.resetFilter);
  const setBannerNotice = useAppStore((s) => s.setBannerNotice);

  const [isSeeding, setIsSeeding] = useState(false);

  const visibleGroups = selectVisibleGroups(useAppStore.getState());

  const handleQuickSeedGroup = async () => {
    if (!myProfile || isSeeding) return;
    setIsSeeding(true);
    try {
      const groupId = await createVerifiedGroupFirestore(
        {
          name: 'European Sovereign Identity & Security Council',
          purpose:
            'High-trust working group of verified security architects and legal auditors coordinating cross-border cryptographic identity standards and zero-trust incident response.',
          category: 'security',
          requiredTier: 'basic_oauth',
          visibility: 'public_verified',
          tags: ['zero-trust', 'cryptography', 'governance'],
        },
        myProfile
      );
      setBannerNotice('Verified reference assembly formed and charter hash anchored.');
      navigate(buildGroupDetailPath(groupId));
    } catch {
      // Handled by errorManager
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Focal Anchor: Hero Section with Measured Contrast Scrim */}
      <section className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
        <div className="relative h-72 sm:h-80 md:h-96 w-full">
          <ResilientImage
            src={VISUAL_ASSETS.heroBanner}
            alt="Modern glass-walled boardroom table for verified identity assemblies"
            className="w-full h-full object-cover"
            fallbackLabel="VeriCircle Verified Assembly"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/20" />

          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-10">
            <div className="max-w-2xl space-y-3">
              <div className="text-xs font-medium text-slate-300 tracking-wide">
                <span>Zero-Trust Group Formation</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>PII-Isolated Attestation</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>Peer Vouching</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-white tracking-tight leading-tight">
                Form High-Trust Groups with Cryptographically Verified Identities
              </h1>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
                Establish assemblies where every participant holds a verified credential commitment and peer-attested trust tier—without exposing private personal documents to the public directory.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {currentUser ? (
                  <>
                    <Link
                      to="/groups/new"
                      className="min-h-[44px] px-5 py-2.5 text-xs font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Form Verified Group</span>
                    </Link>
                    <Link
                      to="/identity"
                      className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Manage Identity Vault</span>
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => signInWithGooglePopup()}
                    className="min-h-[44px] px-5 py-2.5 text-xs font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign In to Verify Identity & Join Groups</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quantitative Proof & Live Ecosystem Ledger Strip (Single-Elevation Surface) */}
      <section
        aria-label="Verified Ecosystem Metrics"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="pt-2 sm:pt-0 sm:px-4 first:pl-0">
            <div className="text-xs text-slate-500">Active Verified Assemblies</div>
            <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
              {groups.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Charter-anchored public circles
            </div>
          </div>
          <div className="pt-4 sm:pt-0 sm:px-4">
            <div className="text-xs text-slate-500">Attested Identity Profiles</div>
            <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
              {profilesDirectory.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              OAuth + credential commitments
            </div>
          </div>
          <div className="pt-4 lg:pt-0 sm:px-4">
            <div className="text-xs text-slate-500">Peer Cryptographic Vouches</div>
            <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
              {vouches.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Non-self-referential signatures
            </div>
          </div>
          <div className="pt-4 lg:pt-0 sm:px-4">
            <div className="text-xs text-slate-500">Your Identity Trust Index</div>
            <div className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-1">
              {myProfile ? `${calculateTrustIndex(myProfile)} / 100` : 'Unverified'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {myProfile
                ? formatTierLabel(myProfile.verificationTier)
                : 'Sign in with Google to initialize'}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Filter & Search Controls */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">
              01. Verified Assemblies Directory
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Inspect founding charters, required verification tiers, and cryptographic member rosters.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={filterCriteria.searchQuery}
              onChange={(e) => updateFilter({ searchQuery: e.target.value })}
              placeholder="Search charter, name, or tag..."
              aria-label="Search verified groups"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Interactive Segmented Filter Controls (Functional <button> elements) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter by domain category"
            className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto"
          >
            {CATEGORY_OPTIONS.map((opt) => {
              const active = filterCriteria.category === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateFilter({ category: opt.value })}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter by required verification tier"
              className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto"
            >
              {TIER_FILTER_OPTIONS.map((opt) => {
                const active = filterCriteria.requiredTier === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateFilter({ requiredTier: opt.value })}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {myProfile && (
              <button
                type="button"
                onClick={() =>
                  updateFilter({
                    onlyEligibleForTier: filterCriteria.onlyEligibleForTier
                      ? null
                      : myProfile.verificationTier,
                  })
                }
                className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  filterCriteria.onlyEligibleForTier
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Eligible for My Tier Only
              </button>
            )}
          </div>
        </div>

        {/* Directory List / Empty State */}
        { !currentUser ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full overflow-hidden mx-auto border border-slate-200">
              <ResilientImage
                src={VISUAL_ASSETS.badgeSeal}
                alt="Cryptographic verification seal"
              />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Authentication Required to Query Verified Assemblies
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Per Zero-Trust Firestore Security Policy (Pillar 8), directory queries require a verified authentication token before streaming group charters and identity hashes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => signInWithGooglePopup()}
              className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify with Google OAuth</span>
            </button>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                {groups.length === 0
                  ? 'No Verified Assemblies Formed Yet'
                  : 'No Assemblies Match Your Active Filters'}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {groups.length === 0
                  ? 'Form the first verified group with a cryptographic charter digest, or initialize a reference security assembly with one click.'
                  : 'Adjust your search query, category tab, or verification tier filter to view additional assemblies.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {groups.length === 0 ? (
                <>
                  <Link
                    to="/groups/new"
                    className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Form First Verified Group</span>
                  </Link>
                  {myProfile && (
                    <button
                      type="button"
                      disabled={isSeeding}
                      onClick={handleQuickSeedGroup}
                      className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                      <span>
                        {isSeeding
                          ? 'Anchoring Reference Assembly...'
                          : 'Initialize Reference Security Assembly'}
                      </span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={resetFilter}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleGroups.map((group) => {
              const eligibility = evaluateGroupJoinEligibility(myProfile, group, []);
              const isFounder = myProfile?.uid === group.ownerId;

              return (
                <article
                  key={group.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-3">
                    {/* Quiet 1-line unboxed metadata kicker (Zero-Pill Discipline) */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800 capitalize">
                        {group.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatTierLabel(group.requiredTier)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{group.status}</span>
                    </div>

                    <h3 className="font-display text-lg font-semibold text-slate-900 leading-snug">
                      <Link
                        to={buildGroupDetailPath(group.id)}
                        className="hover:underline underline-offset-4"
                      >
                        {group.name}
                      </Link>
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {group.purpose}
                    </p>
                  </div>

                  <div className="pt-5 mt-5 border-t border-slate-100 space-y-3">
                    {/* Unboxed Metadata: Founder, Tags, Charter Digest */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div>
                        <span>Founder: </span>
                        <span className="font-medium text-slate-700">{group.ownerName}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        charter: {formatShortHash(group.charterHash)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-slate-500 truncate">
                        {isFounder ? (
                          <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>You are the founding creator</span>
                          </span>
                        ) : eligibility.tag === 'ok' ? (
                          <span className="text-emerald-700 font-medium">
                            Eligible to join with your current tier
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            Requires {formatTierLabel(group.requiredTier)}
                          </span>
                        )}
                      </div>

                      <Link
                        to={buildGroupDetailPath(group.id)}
                        className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <span>Inspect Assembly</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Architectural Proof & Governance Protocol Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="max-w-2xl space-y-1">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            02. Three-Tier Identity Verification Architecture
          </h2>
          <p className="text-sm text-slate-600">
            How VeriCircle proves group membership eligibility while isolating sensitive personal credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-100">
          <div className="space-y-2">
            <div className="text-xs font-mono text-slate-500 tabular-nums">
              Tier 01 · Federated OAuth
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Verified Email & Cryptographic Handle
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every account must authenticate with a verified email token (`email_verified == true`) and register a deterministic SHA-256 identity commitment in `/profiles/&#123;uid&#125;`.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono text-slate-500 tabular-nums">
              Tier 02 · Credential Attested
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Split-Collection PII Vault Isolation
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Passport, National ID, or Hardware Key serial commitments are stored in `/users_private/&#123;uid&#125;` with `allow list: if false`—isolated strictly to the owner while publishing only the cryptographic attestation hash.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono text-slate-500 tabular-nums">
              Tier 03 · Multi-Party Vouched
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Peer Web-of-Trust Signatures
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Once two or more independent verified peers issue signed vouches in `/vouches/&#123;vouchId&#125;`, the member unlocks Tier 3 governance assemblies.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
