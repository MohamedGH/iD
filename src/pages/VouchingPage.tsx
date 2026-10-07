import React, { useState } from 'react';
import { Award, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../managers/stateManager';
import { VerifiedProfile } from '../domain/types';
import { formatTierLabel, calculateTrustIndex } from '../domain/groupLogic';
import { formatShortHash } from '../domain/crypto';
import {
  issuePeerVouchFirestore,
  signInWithGooglePopup,
} from '../services/firestoreService';
import { ResilientImage, VISUAL_ASSETS } from '../components/ResilientImage';

export const VouchingPage: React.FC = () => {
  const currentUser = useAppStore((s) => s.currentUser);
  const myProfile = useAppStore((s) => s.myProfile);
  const profilesDirectory = useAppStore((s) => s.profilesDirectory);
  const vouches = useAppStore((s) => s.vouches);
  const setBannerNotice = useAppStore((s) => s.setBannerNotice);

  const [selectedTargetUid, setSelectedTargetUid] = useState<string>('');
  const [vouchContext, setVouchContext] = useState(
    'Verified institutional affiliation and cryptographic public key fingerprint during peer review.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const peerProfiles = profilesDirectory.filter(
    (p) => p.uid !== currentUser?.uid
  );

  const selectedTarget: VerifiedProfile | undefined =
    peerProfiles.find((p) => p.uid === selectedTargetUid) ?? peerProfiles[0];

  const handleIssueVouch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile || !selectedTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await issuePeerVouchFirestore(
        {
          voucherId: myProfile.uid,
          targetUserId: selectedTarget.uid,
          context: vouchContext,
        },
        myProfile,
        selectedTarget
      );
      setBannerNotice(
        `Cryptographic vouch issued for ${selectedTarget.displayName}.`
      );
    } catch {
      // Handled by errorManager
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <Award className="w-8 h-8 text-slate-700 mx-auto" />
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          Peer Cryptographic Vouching Ledger
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Sign in with your verified account to inspect the web-of-trust directory and issue peer attestations.
        </p>
        <button
          type="button"
          onClick={() => signInWithGooglePopup()}
          className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Sign In with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Explanation */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-slate-500">
            <span>Web-of-Trust Protocol</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Self-Vouching Strictly Forbidden (`targetUserId != voucherId`)</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Peer Cryptographic Vouching Network
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Issue signed identity attestations for verified peers you have independently authenticated. Receiving two or more peer vouches promotes a member to <strong className="font-semibold text-slate-900">Tier 3 · Multi-Party Vouched</strong>.
          </p>
        </div>

        <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 shrink-0 hidden sm:block">
          <ResilientImage
            src={VISUAL_ASSETS.avatarTwo}
            alt="Verified Peer Delegate"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Verified Profiles Directory & Vouch Issuance */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              01. Issue a Signed Peer Vouch
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a verified participant from `/profiles` to co-sign their identity commitment.
            </p>
          </div>

          {peerProfiles.length === 0 ? (
            <div className="py-4 space-y-2 text-sm text-slate-600">
              <p>
                You are currently the only registered identity holder in `/profiles`.
              </p>
              <p className="text-xs text-slate-500">
                Note: Security Rule Invariant #12 (`data.targetUserId != data.voucherId`) strictly forbids self-vouching. When a second verified user signs in, their profile will appear here for peer vouching.
              </p>
            </div>
          ) : (
            <form onSubmit={handleIssueVouch} className="space-y-4">
              <div>
                <label
                  htmlFor="vouch-target"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Select Verified Peer Recipient
                </label>
                <select
                  id="vouch-target"
                  value={selectedTarget?.uid ?? ''}
                  onChange={(e) => setSelectedTargetUid(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {peerProfiles.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.displayName} (@{p.handle}) — {formatTierLabel(p.verificationTier)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="vouch-context"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Verification Context & Attestation Evidence (5–240 chars)
                </label>
                <textarea
                  id="vouch-context"
                  required
                  minLength={5}
                  maxLength={240}
                  rows={3}
                  value={vouchContext}
                  onChange={(e) => setVouchContext(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !myProfile}
                className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Anchoring Peer Signature...'
                    : 'Sign & Anchor Peer Vouch'}
                </span>
              </button>
            </form>
          )}

          {/* Directory Table of All Verified Profiles */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700">
              Registered Identity Holders ({profilesDirectory.length})
            </h3>
            <div className="divide-y divide-slate-100">
              {profilesDirectory.map((prof) => (
                <div
                  key={prof.uid}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-slate-900 truncate">
                      {prof.displayName}{' '}
                      <span className="font-mono font-normal text-slate-500">
                        @{prof.handle}
                      </span>
                    </div>
                    <div className="text-slate-500 truncate">
                      {prof.organization} · {prof.roleTitle}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-emerald-700 font-medium">
                      {prof.vouchCount} vouches
                    </div>
                    <div className="text-slate-400">
                      Trust {calculateTrustIndex(prof)}/100
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right 6 Cols: Live Cryptographic Vouch Ledger (/vouches) */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              02. Active Cryptographic Vouch Ledger ({vouches.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable peer-to-peer attestations recorded in `/vouches/&#123;vouchId&#125;`.
            </p>
          </div>

          {vouches.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No peer vouches recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {vouches.map((v) => (
                <div key={v.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-semibold text-slate-900">
                      <span>{v.voucherName}</span>
                      <span className="mx-2 text-slate-400" aria-hidden="true">
                        →
                      </span>
                      <span>{v.targetUserName}</span>
                    </div>
                    <span className="font-mono text-emerald-700 tabular-nums">
                      {v.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {v.context}
                  </p>
                  <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                    sig: {formatShortHash(v.signatureHash)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
