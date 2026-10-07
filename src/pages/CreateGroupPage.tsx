import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Plus, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../managers/stateManager';
import {
  GroupCategory,
  VerificationTier,
  GroupVisibility,
} from '../domain/types';
import { generateCharterHash } from '../domain/crypto';
import { createVerifiedGroupFirestore } from '../services/firestoreService';
import { buildGroupDetailPath } from '../managers/routeManager';
import { formatTierLabel } from '../domain/groupLogic';

export const CreateGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const myProfile = useAppStore((s) => s.myProfile);
  const setBannerNotice = useAppStore((s) => s.setBannerNotice);

  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [category, setCategory] = useState<GroupCategory>('governance');
  const [requiredTier, setRequiredTier] = useState<VerificationTier>('basic_oauth');
  const [visibility, setVisibility] = useState<GroupVisibility>('public_verified');
  const [tagsInput, setTagsInput] = useState('verified-identity, charter, consensus');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser || !myProfile) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto" />
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          Verified Identity Required to Form a Group
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Every group on VeriCircle must be anchored by a verified founder profile in `/profiles/&#123;uid&#125;`.
        </p>
        <Link
          to="/identity"
          className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
        >
          <span>Go to Identity Attestation</span>
        </Link>
      </div>
    );
  }

  const parsedTags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 5);

  const liveCharterHash = generateCharterHash({
    name: name || 'untitled',
    purpose: purpose || 'charter',
    category,
    requiredTier,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const groupId = await createVerifiedGroupFirestore(
        {
          name,
          purpose,
          category,
          requiredTier,
          visibility,
          tags: parsedTags.length > 0 ? parsedTags : [category],
        },
        myProfile
      );
      setBannerNotice(`Verified group "${name}" formed and founder membership anchored.`);
      navigate(buildGroupDetailPath(groupId));
    } catch {
      // Handled by errorManager
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs font-medium text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Assemblies Directory</span>
          </Link>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Form a New Verified Identity Group
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Define the founding charter and minimum cryptographic identity tier required for members to join.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        {/* Founding Identity Summary */}
        <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            <span>Founding Creator: </span>
            <span className="font-semibold text-slate-900">{myProfile.displayName}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{formatTierLabel(myProfile.verificationTier)}</span>
          </div>
          <div className="font-mono tabular-nums">
            uid: {myProfile.uid.slice(0, 10)}…
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="group-name"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Official Assembly / Group Name (3–100 chars)
            </label>
            <input
              id="group-name"
              type="text"
              required
              minLength={3}
              maxLength={100}
              placeholder="e.g., Global Clinical AI Ethics & Safety Board"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="group-purpose"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Founding Charter & Verification Mandate (10–500 chars)
            </label>
            <textarea
              id="group-purpose"
              required
              minLength={10}
              maxLength={500}
              rows={4}
              placeholder="Describe the group's mission, why verified identities are required, and how proposals are ratified..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="group-category"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Domain Category
              </label>
              <select
                id="group-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as GroupCategory)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              >
                <option value="governance">Governance</option>
                <option value="security">Security</option>
                <option value="research">Research</option>
                <option value="finance">Finance</option>
                <option value="community">Community</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="group-tier"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Minimum Identity Tier
              </label>
              <select
                id="group-tier"
                value={requiredTier}
                onChange={(e) => setRequiredTier(e.target.value as VerificationTier)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              >
                <option value="basic_oauth">Tier 1 · OAuth Verified</option>
                <option value="credential_attested">Tier 2 · Credential Attested</option>
                <option value="multi_party_vouched">Tier 3 · Multi-Party Vouched</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="group-visibility"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Discovery Policy
              </label>
              <select
                id="group-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as GroupVisibility)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              >
                <option value="public_verified">Public to Verified Users</option>
                <option value="invite_only">Private · Founder Direct</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="group-tags"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Bounded Domain Tags (comma-separated, max 5 tags enforced by Pillar 5)
            </label>
            <input
              id="group-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
            />
            <div className="text-xs text-slate-500 mt-1.5">
              Active tags ({parsedTags.length}/5):{' '}
              <span className="font-mono">{parsedTags.join(' · ') || category}</span>
            </div>
          </div>
        </div>

        {/* Live Cryptographic Charter Digest Preview */}
        <div className="pt-4 border-t border-slate-100 space-y-1">
          <div className="text-xs font-medium text-slate-700">
            Deterministic Charter Digest (anchored on creation)
          </div>
          <div className="font-mono text-xs text-slate-600 break-all tabular-nums">
            {liveCharterHash}
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
          <Link
            to="/"
            className="min-h-[44px] px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors inline-flex items-center whitespace-nowrap"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Anchoring Group & Founder Record...'
                : 'Form Verified Group'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
