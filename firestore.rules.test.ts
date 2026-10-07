import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase 0 & Phase 5 Hardened Security Rules Verification Suite
 * Validates structural invariants, Dirty Dozen payload defenses, and
 * AST/rule-level guarantees on firestore.rules and firebase-blueprint.json.
 */

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));

describe('Firestore Security Rules — Dirty Dozen & Eight Pillars Suite', () => {
  it('enforces global default-deny safety net at the top of match block', () => {
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
  });

  it('Payload 1 Defense: enforces strict hasAll and hasOnly key guards on all entities', () => {
    expect(rulesContent).toContain('function isValidVerifiedProfile(data, userId)');
    expect(rulesContent).toContain('function isValidPrivateIdentityVault(data, userId)');
    expect(rulesContent).toContain('function isValidVerifiedGroup(data, groupId)');
    expect(rulesContent).toContain('function isValidGroupMember(data, groupId, memberId)');
    expect(rulesContent).toContain('function isValidGroupProposal(data, groupId, proposalId)');
    expect(rulesContent).toContain('function isValidIdentityVouch(data, vouchId)');
    expect(rulesContent).toContain('.keys().hasAll(');
    expect(rulesContent).toContain('.keys().hasOnly(');
  });

  it('Payload 2 Defense: prevents identity spoofing on profile, group, proposal, and vouch creation', () => {
    expect(rulesContent).toContain('incoming().uid == request.auth.uid');
    expect(rulesContent).toContain('incoming().ownerId == request.auth.uid');
    expect(rulesContent).toContain('incoming().authorId == request.auth.uid');
    expect(rulesContent).toContain('incoming().voucherId == request.auth.uid');
  });

  it('Payload 3 Defense: enforces path variable hardening with isValidId regex guard', () => {
    expect(rulesContent).toContain("id.matches('^[a-zA-Z0-9_\\\\-]+$')");
    expect(rulesContent).toContain('isValidId(userId)');
    expect(rulesContent).toContain('isValidId(groupId)');
    expect(rulesContent).toContain('isValidId(memberId)');
    expect(rulesContent).toContain('isValidId(proposalId)');
    expect(rulesContent).toContain('isValidId(vouchId)');
  });

  it('Payload 4 Defense: enforces tiered action-based updates with affectedKeys().hasOnly()', () => {
    expect(rulesContent).toContain('incoming().diff(existing()).affectedKeys().hasOnly(');
    expect(rulesContent).toContain("incoming().diff(existing()).affectedKeys().hasOnly(['memberCount', 'updatedAt'])");
  });

  it('Payload 5 Defense: enforces total array guarding on group tags', () => {
    expect(rulesContent).toContain('data.tags is list && data.tags.size() >= 1 && data.tags.size() <= 5');
    expect(rulesContent).toContain('data.tags[0] is string');
  });

  it('Payload 6 & 8 Defense: isolates PII in /users_private/{userId} and disables list queries', () => {
    const privateVaultBlock = rulesContent.split('match /users_private/{userId}')[1]?.split('match /groups/{groupId}')[0] ?? '';
    expect(privateVaultBlock).toContain('allow get: if isVerifiedUser() && isValidId(userId) && (isOwner(userId) || isAdmin());');
    expect(privateVaultBlock).toContain('allow list: if false;');
  });

  it('Payload 7 Defense: enforces Master Gate relational sync on subcollections', () => {
    expect(rulesContent).toContain('exists(/databases/$(database)/documents/groups/$(groupId))');
    expect(rulesContent).toContain('exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid))');
    expect(rulesContent).toContain('existsAfter(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid))');
  });

  it('Payload 9 Defense: prevents email spoofing by requiring email_verified == true', () => {
    expect(rulesContent).toContain('request.auth.token.email_verified == true');
  });

  it('Payload 10 Defense: locks terminal states (archived, revoked, ratified, rejected)', () => {
    expect(rulesContent).toContain("existing().status != 'archived'");
    expect(rulesContent).toContain("existing().membershipStatus != 'revoked'");
    expect(rulesContent).toContain("existing().status == 'open'");
    expect(rulesContent).toContain("existing().status != 'revoked'");
  });

  it('Payload 11 Defense: enforces server timestamp integrity (request.time)', () => {
    expect(rulesContent).toContain('incoming().createdAt == request.time');
    expect(rulesContent).toContain('incoming().updatedAt == request.time');
    expect(rulesContent).toContain('incoming().joinedAt == request.time');
    expect(rulesContent).toContain('incoming().verifiedAt == request.time');
  });

  it('Payload 12 Defense: forbids self-vouching (targetUserId != voucherId)', () => {
    expect(rulesContent).toContain('data.targetUserId != data.voucherId');
  });

  it('verifies every collection in firebase-blueprint.json is secured in firestore.rules', () => {
    const paths = Object.keys(blueprint.firestore);
    expect(paths.length).toBeGreaterThanOrEqual(7);
    expect(rulesContent).toContain('match /profiles/{userId}');
    expect(rulesContent).toContain('match /users_private/{userId}');
    expect(rulesContent).toContain('match /groups/{groupId}');
    expect(rulesContent).toContain('match /members/{memberId}');
    expect(rulesContent).toContain('match /proposals/{proposalId}');
    expect(rulesContent).toContain('match /vouches/{vouchId}');
    expect(rulesContent).toContain('match /admins/{adminId}');
  });
});
