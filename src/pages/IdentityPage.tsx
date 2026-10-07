import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Fingerprint, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../managers/stateManager';
import {
  DocumentCredentialType,
  VerificationTier,
} from '../domain/types';
import {
  formatTierLabel,
  calculateTrustIndex,
  computeVerificationTier,
} from '../domain/groupLogic';
import {
  saveVerifiedProfileFirestore,
  savePrivateIdentityVaultFirestore,
  signInWithGooglePopup,
} from '../services/firestoreService';
import { ResilientImage, VISUAL_ASSETS } from '../components/ResilientImage';

const DOCUMENT_TYPES: ReadonlyArray<{
  readonly value: DocumentCredentialType;
  readonly label: string;
}> = [
  { value: 'passport', label: 'Biometric Passport' },
  { value: 'national_id', label: 'National Identity Card' },
  { value: 'professional_license', label: 'State / Bar / Engineering License' },
  { value: 'hardware_key', label: 'FIDO2 / YubiKey Hardware Token' },
];

export const IdentityPage: React.FC = () => {
  const currentUser = useAppStore((s) => s.currentUser);
  const myProfile = useAppStore((s) => s.myProfile);
  const myPrivateVault = useAppStore((s) => s.myPrivateVault);
  const setBannerNotice = useAppStore((s) => s.setBannerNotice);

  // Public Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [organization, setOrganization] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [bio, setBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Private PII Vault Form State
  const [jurisdiction, setJurisdiction] = useState('European Union · DE');
  const [documentType, setDocumentType] = useState<DocumentCredentialType>('passport');
  const [documentLastFour, setDocumentLastFour] = useState('94A2');
  const [isSavingVault, setIsSavingVault] = useState(false);

  useEffect(() => {
    if (myProfile) {
      setDisplayName(myProfile.displayName);
      setHandle(myProfile.handle);
      setOrganization(myProfile.organization);
      setRoleTitle(myProfile.roleTitle);
      setBio(myProfile.bio);
    } else if (currentUser) {
      setDisplayName(currentUser.displayName || 'Verified Member');
      setHandle(
        (currentUser.email?.split('@')[0] || `id_${currentUser.uid.slice(0, 6)}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 30)
      );
      setOrganization('Civic Trust Consortium');
      setRoleTitle('Principal Systems Architect');
      setBio('Verified participant in high-trust governance and security assemblies.');
    }
  }, [myProfile, currentUser]);

  useEffect(() => {
    if (myPrivateVault) {
      setJurisdiction(myPrivateVault.jurisdiction);
      setDocumentType(myPrivateVault.documentType);
      setDocumentLastFour(myPrivateVault.documentLastFour);
    }
  }, [myPrivateVault]);

  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full overflow-hidden mx-auto border border-slate-200">
          <ResilientImage
            src={VISUAL_ASSETS.badgeSeal}
            alt="Identity Attestation Seal"
          />
        </div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          Identity Attestation & Isolated PII Vault
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Authenticate with your verified Google account to initialize your public cryptographic identity profile and owner-isolated credential vault.
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

  const handleSavePublicProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const nextTier: VerificationTier = computeVerificationTier({
        hasAttestedVault: Boolean(myPrivateVault),
        activeVouchCount: myProfile?.vouchCount ?? 0,
      });

      await saveVerifiedProfileFirestore(
        {
          uid: currentUser.uid,
          displayName,
          handle,
          organization,
          roleTitle,
          verificationTier: nextTier,
          bio,
        },
        myProfile
      );
      setBannerNotice('Public verified identity profile anchored in /profiles.');
    } catch {
      // Handled by errorManager
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePrivateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;
    setIsSavingVault(true);
    try {
      await savePrivateIdentityVaultFirestore(
        {
          uid: currentUser.uid,
          email: currentUser.email || 'verified@user.org',
          jurisdiction,
          documentType,
          documentLastFour,
        },
        myPrivateVault,
        myProfile
      );
      setBannerNotice(
        'Credential commitment sealed in isolated /users_private vault and verification tier upgraded.'
      );
    } catch {
      // Handled by errorManager
    } finally {
      setIsSavingVault(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Summary Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 shrink-0">
              <ResilientImage
                src={VISUAL_ASSETS.avatarOne}
                alt={myProfile?.displayName || 'Verified Member Avatar'}
              />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-emerald-700">
                  {myProfile
                    ? formatTierLabel(myProfile.verificationTier)
                    : 'Tier 1 · Pending Initial Anchor'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {myProfile?.vouchCount ?? 0} peer vouches
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Trust Index: {myProfile ? calculateTrustIndex(myProfile) : 30}/100
                </span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-slate-900">
                {myProfile?.displayName || currentUser.displayName || 'Identity Holder'}
              </h1>
              <div className="font-mono text-xs text-slate-500 break-all">
                identityHash: {myProfile?.identityHash || 'Awaiting initial profile save'}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1 md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div className="font-medium text-slate-800">PII Split-Collection Status</div>
            <div>
              Public directory: <span className="font-mono">/profiles/{currentUser.uid.slice(0, 8)}…</span>
            </div>
            <div>
              Isolated PII vault:{' '}
              <span className="font-mono text-emerald-700">
                {myPrivateVault ? 'Attested & Owner-Locked' : 'Not yet attested'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Split-Collection Forms: Public Profile vs Isolated Private Vault */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Public Verified Identity Profile (/profiles/{userId}) */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="space-y-1 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Fingerprint className="w-4 h-4 text-slate-700" />
              <span>Public Directory Collection · /profiles/&#123;userId&#125;</span>
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              01. Public Verified Directory Profile
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Visible to other verified participants so they can verify your affiliation, cryptographic identity hash, and vouch count before admitting you to groups. Contains zero sensitive PII.
            </p>
          </div>

          <form onSubmit={handleSavePublicProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Verified Display Name (2–80 chars)
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-handle"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Identity Handle (3–40 alphanumeric)
                </label>
                <input
                  id="profile-handle"
                  type="text"
                  required
                  minLength={3}
                  maxLength={40}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-org"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Verified Organization (2–100 chars)
                </label>
                <input
                  id="profile-org"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-role"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Role Title (2–80 chars)
                </label>
                <input
                  id="profile-role"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-bio"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Verification Scope & Expertise Statement (max 300 chars)
              </label>
              <textarea
                id="profile-bio"
                rows={3}
                maxLength={300}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {isSavingProfile
                  ? 'Anchoring Identity Profile...'
                  : 'Save & Anchor Public Identity Profile'}
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Isolated Private PII Credential Vault (/users_private/{userId}) */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="space-y-1 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
              <Lock className="w-4 h-4" />
              <span>PII-Isolated Vault · /users_private/&#123;userId&#125; (Owner-Only Read)</span>
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              02. Private Credential Attestation Vault (Upgrades to Tier 2+)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Protected by Pillar 6 PII Isolation rules (`allow get: if isOwner(userId)` and `allow list: if false`). Attesting a credential here upgrades your public profile to <strong className="font-semibold text-slate-900">Tier 2 · Credential Attested</strong> (or <strong className="font-semibold text-slate-900">Tier 3</strong> with 2+ peer vouches) without exposing your document details to other users.
            </p>
          </div>

          <form onSubmit={handleSavePrivateVault} className="space-y-4">
            <div>
              <label
                htmlFor="vault-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Verified OAuth Email (Isolated PII)
              </label>
              <input
                id="vault-email"
                type="email"
                disabled
                value={currentUser.email || ''}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="vault-jurisdiction"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Issuing Jurisdiction (2–80 chars)
                </label>
                <input
                  id="vault-jurisdiction"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="vault-doctype"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Credential Type
                </label>
                <select
                  id="vault-doctype"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DocumentCredentialType)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="vault-last-four"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Credential Serial Last 4 Characters (4 uppercase alphanumeric `0-9A-Z`)
              </label>
              <input
                id="vault-last-four"
                type="text"
                required
                minLength={4}
                maxLength={4}
                pattern="^[0-9A-Za-z]{4}$"
                value={documentLastFour}
                onChange={(e) => setDocumentLastFour(e.target.value.toUpperCase())}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            {myPrivateVault && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Active Zero-Knowledge Commitment Signature</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  {myPrivateVault.attestationSignature}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingVault || !myProfile}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {isSavingVault
                  ? 'Sealing Credential Commitment...'
                  : myPrivateVault
                  ? 'Update Private Credential Attestation'
                  : 'Attest Credential & Upgrade to Tier 2'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
