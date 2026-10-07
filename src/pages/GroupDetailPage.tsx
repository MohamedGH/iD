import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  UserPlus,
  FileText,
  CheckCircle2,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { useAppStore } from '../managers/stateManager';
import {
  subscribeToGroupAssemblyDetails,
  joinVerifiedGroupFirestore,
  createGroupProposalFirestore,
  endorseGroupProposalFirestore,
  updateGroupStatusFirestore,
} from '../services/firestoreService';
import {
  formatTierLabel,
  evaluateGroupJoinEligibility,
  computeGroupGovernanceStats,
} from '../domain/groupLogic';
import { formatShortHash } from '../domain/crypto';
import { GroupProposal, GroupStatus } from '../domain/types';

export const GroupDetailPage: React.FC = () => {
  const { groupId = '' } = useParams<{ groupId: string }>();
  const currentUser = useAppStore((s) => s.currentUser);
  const myProfile = useAppStore((s) => s.myProfile);
  const groups = useAppStore((s) => s.groups);
  const membersByGroup = useAppStore((s) => s.membersByGroup);
  const proposalsByGroup = useAppStore((s) => s.proposalsByGroup);
  const setGroupMembers = useAppStore((s) => s.setGroupMembers);
  const setGroupProposals = useAppStore((s) => s.setGroupProposals);
  const setBannerNotice = useAppStore((s) => s.setBannerNotice);

  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalSummary, setProposalSummary] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);

  const group = groups.find((g) => g.id === groupId);
  const members = membersByGroup[groupId] ?? [];
  const proposals = proposalsByGroup[groupId] ?? [];

  useEffect(() => {
    if (!currentUser || !groupId) return;
    const unsub = subscribeToGroupAssemblyDetails(groupId, {
      onMembers: (list) => setGroupMembers(groupId, list),
      onProposals: (list) => setGroupProposals(groupId, list),
    });
    return () => unsub();
  }, [currentUser, groupId, setGroupMembers, setGroupProposals]);

  if (!group) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <h1 className="font-display text-xl font-semibold text-slate-900">
          Assembly Not Found or Requires Authentication
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Verify your identity and return to the Assemblies Directory to inspect active verified groups.
        </p>
        <Link
          to="/"
          className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Directory</span>
        </Link>
      </div>
    );
  }

  const isMember = Boolean(
    myProfile &&
      members.some(
        (m) => m.uid === myProfile.uid && m.membershipStatus === 'active'
      )
  );
  const isFounder = myProfile?.uid === group.ownerId;
  const eligibility = evaluateGroupJoinEligibility(myProfile, group, members);
  const govStats = computeGroupGovernanceStats(members, proposals);

  const handleJoinGroup = async () => {
    if (!myProfile || eligibility.tag === 'err' || isJoining) return;
    setIsJoining(true);
    try {
      await joinVerifiedGroupFirestore(group, myProfile);
      setBannerNotice(`Joined "${group.name}" with verified identity commitment.`);
    } catch {
      // Handled by errorManager
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile || !isMember || isCreatingProposal) return;
    setIsCreatingProposal(true);
    try {
      await createGroupProposalFirestore(
        {
          groupId: group.id,
          title: proposalTitle,
          summary: proposalSummary,
        },
        myProfile
      );
      setProposalTitle('');
      setProposalSummary('');
      setBannerNotice('Signed proposal anchored in group assembly ledger.');
    } catch {
      // Handled by errorManager
    } finally {
      setIsCreatingProposal(false);
    }
  };

  const handleEndorseProposal = async (proposal: GroupProposal) => {
    if (!isMember || proposal.status !== 'open') return;
    try {
      await endorseGroupProposalFirestore(proposal, govStats.quorumThreshold);
      setBannerNotice(`Co-signed resolution "${proposal.title}".`);
    } catch {
      // Handled by errorManager
    }
  };

  const handleStatusChange = async (nextStatus: GroupStatus) => {
    if (!isFounder || group.status === 'archived') return;
    try {
      await updateGroupStatusFirestore(group.id, nextStatus);
      setBannerNotice(`Assembly status updated to ${nextStatus}.`);
    } catch {
      // Handled by errorManager
    }
  };

  return (
    <div className="space-y-8">
      {/* Assembly Charter Header Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800 capitalize">
                {group.category}
              </span>
              <span aria-hidden="true">·</span>
              <span>Required: {formatTierLabel(group.requiredTier)}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">Status: {group.status}</span>
              <span aria-hidden="true">·</span>
              <span> tags: {group.tags.join(', ')}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">
              {group.name}
            </h1>

            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              {group.purpose}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono tabular-nums">
              <span>Founder: {group.ownerName}</span>
              <span aria-hidden="true">·</span>
              <span>Charter Digest: {group.charterHash}</span>
            </div>
          </div>

          {/* Action / Membership Status Zone */}
          <div className="flex flex-col items-stretch sm:items-end gap-3 shrink-0">
            {isMember ? (
              <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isFounder
                    ? 'Active Founding Creator'
                    : 'Active Verified Assembly Member'}
                </span>
              </div>
            ) : eligibility.tag === 'ok' ? (
              <button
                type="button"
                disabled={isJoining}
                onClick={handleJoinGroup}
                className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {isJoining
                    ? 'Attesting Membership...'
                    : 'Join Assembly with Verified Identity'}
                </span>
              </button>
            ) : (
              <div className="space-y-2 sm:text-right max-w-xs">
                <div className="text-xs font-medium text-amber-800">
                  {eligibility.error}
                </div>
                <Link
                  to="/identity"
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Upgrade Identity Tier</span>
                </Link>
              </div>
            )}

            {/* Founder Lifecycle State Controls (Demonstrates Terminal State Locking) */}
            {isFounder && group.status !== 'archived' && (
              <div className="flex items-center gap-2 pt-2">
                {group.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('locked')}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    Lock Admissions
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('active')}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 whitespace-nowrap"
                  >
                    Reopen Admissions
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleStatusChange('archived')}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 whitespace-nowrap"
                >
                  Archive Charter (Terminal)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Governance Metric Bar */}
        <div className="pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Verified Roster</span>
            <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
              {govStats.activeMembersCount}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Tier 3 Vouched Delegates</span>
            <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
              {govStats.multiPartyVouchedCount}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Ratification Quorum (50%)</span>
            <div className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
              {govStats.quorumThreshold} signatures
            </div>
          </div>
          <div>
            <span className="text-slate-500">Ratified Resolutions</span>
            <div className="font-mono text-lg font-semibold text-emerald-700 tabular-nums mt-0.5">
              {govStats.ratifiedProposalsCount} / {proposals.length}
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Assembly Workspace: Verified Roster & Signed Proposals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Verified Member Roster Subcollection (/groups/{groupId}/members) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              01. Verified Member Roster ({members.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Subcollection `/groups/{group.id.slice(0, 8)}…/members` with cryptographic identity commitments.
            </p>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              No active members found in subcollection.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((member) => (
                <div
                  key={member.uid}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {member.displayName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="capitalize font-medium text-slate-700">
                        {member.role.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatTierLabel(member.verificationTier)}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 tabular-nums truncate">
                      {formatShortHash(member.identityHash)}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-700 shrink-0">
                    {member.membershipStatus}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right 7 Cols: Signed Assembly Proposals (/groups/{groupId}/proposals) */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              02. Signed Assembly Proposals & Attestations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Protected by Pillar 1 Master Gate: Only active verified members of this group can submit or co-sign proposals.
            </p>
          </div>

          {isMember && group.status === 'active' ? (
            <form
              onSubmit={handleCreateProposal}
              className="space-y-3 pb-6 border-b border-slate-100"
            >
              <div>
                <label
                  htmlFor="prop-title"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Resolution / Attestation Title (4–120 chars)
                </label>
                <input
                  id="prop-title"
                  type="text"
                  required
                  minLength={4}
                  maxLength={120}
                  placeholder="e.g., Ratify Zero-Knowledge Credential Verification Standard v1"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="prop-summary"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Resolution Text & Cryptographic Scope (10–600 chars)
                </label>
                <textarea
                  id="prop-summary"
                  required
                  minLength={10}
                  maxLength={600}
                  rows={2}
                  placeholder="Specify the action or policy to be attested by verified members..."
                  value={proposalSummary}
                  onChange={(e) => setProposalSummary(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={isCreatingProposal}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {isCreatingProposal
                    ? 'Signing Resolution...'
                    : 'Submit Signed Resolution'}
                </span>
              </button>
            </form>
          ) : (
            <div className="pb-4 border-b border-slate-100 text-xs text-slate-500 flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Join this verified assembly as an active member to author or co-sign resolutions.
              </span>
            </div>
          )}

          {proposals.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No proposals have been submitted to this assembly yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {proposals.map((prop) => (
                <article key={prop.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-800">
                        {prop.authorName}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatShortHash(prop.authorIdentityHash)}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums">
                      <span
                        className={
                          prop.status === 'ratified'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-700'
                        }
                      >
                        status: {prop.status}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>
                        {prop.approvalsCount} / {govStats.quorumThreshold} signatures
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900">
                    {prop.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {prop.summary}
                  </p>

                  {isMember && prop.status === 'open' && group.status === 'active' && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleEndorseProposal(prop)}
                        className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Co-Sign & Endorse Resolution (+1 Signature)
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
