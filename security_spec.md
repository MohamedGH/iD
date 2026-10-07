# VeriCircle Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Verified Authentication Gate**: Every read or write operation requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **PII Split-Collection Isolation**: Sensitive PII (`email`, `jurisdiction`, `documentType`, `documentLastFour`) is stored exclusively in `/users_private/{userId}` and is strictly readable and writable only by `request.auth.uid == userId` (or `isAdmin()`), with `list` permanently disabled.
3. **Master Gate Relational Sync**:
   - A `GroupMember` (`/groups/{groupId}/members/{memberId}`) cannot be created or updated unless the parent `/groups/{groupId}` document exists and is not `archived`, and the user has a `/profiles/{request.auth.uid}` document.
   - A `GroupProposal` (`/groups/{groupId}/proposals/{proposalId}`) cannot be read (single-doc), created, or updated unless the parent `/groups/{groupId}` exists and the user has an active membership record at `/groups/{groupId}/members/$(request.auth.uid)` with `membershipStatus == 'active'`.
4. **Anti-Update-Gap & Strict Schema Blueprints**: Every `create` and `update` invokes `isValid[Entity](incoming())` checking exact key sets (`hasAll` and `hasOnly`), string length bounds, regex ID patterns (`^[a-zA-Z0-9_\-]+$`), and immutable identity/temporal fields (`uid`, `ownerId`, `authorId`, `voucherId`, `createdAt`, `joinedAt`, `verifiedAt`).
5. **Terminal State Locking**:
   - `/groups/{groupId}` with `status == 'archived'` cannot be updated by non-admins.
   - `/groups/{groupId}/members/{memberId}` with `membershipStatus == 'revoked'` cannot be updated by non-admins.
   - `/groups/{groupId}/proposals/{proposalId}` with `status in ['ratified', 'rejected']` cannot be updated by non-admins.
   - `/vouches/{vouchId}` with `status == 'revoked'` cannot be updated by non-admins.
6. **Total Array Guarding**: `groups.tags` is strictly bounded (`tags is list && tags.size() >= 1 && tags.size() <= 5 && tags[0] is string && tags[0].size() <= 30`).
7. **Temporal Integrity**: All `createdAt`, `joinedAt`, `verifiedAt`, and `updatedAt` timestamps must equal `request.time`.
8. **Secure List Queries (Query Enforcer)**: Every `allow list` rule enforces row-level filtering on `resource.data` (`existing()`) without performing `get()` or `exists()` lookups.

---

## 2. The "Dirty Dozen" Adversarial Payloads

### Payload 1: Shadow Field Injection (Pillar 2 - Anti-Update-Gap)
```json
{
  "collection": "/profiles/user_1",
  "operation": "create",
  "auth": { "uid": "user_1", "email_verified": true },
  "payload": {
    "uid": "user_1",
    "displayName": "Alice Vance",
    "handle": "alice_v",
    "organization": "Civic Trust Lab",
    "roleTitle": "Lead Auditor",
    "verificationTier": "basic_oauth",
    "identityHash": "sha256_abcdef1234567890",
    "vouchCount": 0,
    "bio": "Security architect.",
    "createdAt": "SERVER_TIMESTAMP",
    "updatedAt": "SERVER_TIMESTAMP",
    "isAdmin": true
  },
  "expected": "PERMISSION_DENIED (rejected by hasOnly key guard)"
}
```

### Payload 2: Identity Spoofing on Group Creation (Pillar 2 - Identity Integrity)
```json
{
  "collection": "/groups/grp_1",
  "operation": "create",
  "auth": { "uid": "attacker_uid", "email_verified": true },
  "payload": {
    "id": "grp_1",
    "name": "overeign Security Council",
    "purpose": "Coordinating verified incident response across regional nodes.",
    "category": "security",
    "requiredTier": "credential_attested",
    "visibility": "public_verified",
    "ownerId": "victim_uid",
    "ownerName": "Victim Name",
    "memberCount": 1,
    "status": "active",
    "tags": ["security"],
    "charterHash": "charter_hash_123456",
    "createdAt": "SERVER_TIMESTAMP",
    "updatedAt": "SERVER_TIMESTAMP"
  },
  "expected": "PERMISSION_DENIED (incoming().ownerId != request.auth.uid)"
}
```

### Payload 3: Path ID Poisoning (Pillar 3 - Path Variable Hardening)
```json
{
  "collection": "/groups/invalid$id!with@spaces",
  "operation": "create",
  "auth": { "uid": "user_1", "email_verified": true },
  "payload": { "id": "invalid$id!with@spaces" },
  "expected": "PERMISSION_DENIED (rejected by isValidId regex guard)"
}
```

### Payload 4: Unauthorized Tier Escalation on Group Update (Pillar 4 - Tiered Identity Logic)
```json
{
  "collection": "/groups/grp_1",
  "operation": "update",
  "auth": { "uid": "regular_member", "email_verified": true },
  "payload": {
    "requiredTier": "basic_oauth",
    "visibility": "public_verified",
    "updatedAt": "SERVER_TIMESTAMP"
  },
  "expected": "PERMISSION_DENIED (regular member can only update memberCount + updatedAt when joining)"
}
```

### Payload 5: Unbounded Array Exhaustion (Pillar 5 - Total Array Guarding)
```json
{
  "collection": "/groups/grp_1",
  "operation": "create",
  "auth": { "uid": "user_1", "email_verified": true },
  "payload": {
    "tags": ["t1", "t2", "t3", "t4", "t5", "t6_overflow"]
  },
  "expected": "PERMISSION_DENIED (tags.size() > 5 rejected)"
}
```

### Payload 6: Non-Owner PII Vault Read (Pillar 6 - PII Isolation)
```json
{
  "collection": "/users_private/victim_uid",
  "operation": "get",
  "auth": { "uid": "attacker_uid", "email_verified": true },
  "expected": "PERMISSION_DENIED (strictly isolated to ownerId == request.auth.uid)"
}
```

### Payload 7: Orphaned Proposal Without Active Membership (Pillar 1 - Master Gate)
```json
{
  "collection": "/groups/grp_1/proposals/prop_1",
  "operation": "create",
  "auth": { "uid": "non_member_uid", "email_verified": true },
  "payload": {
    "id": "prop_1",
    "groupId": "grp_1",
    "authorId": "non_member_uid"
  },
  "expected": "PERMISSION_DENIED (requires active member doc in /groups/grp_1/members/non_member_uid)"
}
```

### Payload 8: Unconstrained List Query Scraping on Private Vault (Pillar 8 - Query Enforcer)
```json
{
  "collection": "/users_private",
  "operation": "list",
  "auth": { "uid": "user_1", "email_verified": true },
  "expected": "PERMISSION_DENIED (list is completely disabled on /users_private)"
}
```

### Payload 9: Unverified Email Spoof Attack (Phase 5 - Email Spoofing Test)
```json
{
  "collection": "/groups/grp_1",
  "operation": "create",
  "auth": {
    "uid": "spoof_admin",
    "email": "Ghalleb.Mohamed2@gmail.com",
    "email_verified": false
  },
  "expected": "PERMISSION_DENIED (email_verified == true is strictly mandated)"
}
```

### Payload 10: Terminal State Bypass on Archived Group (Phase 4.6 - Terminal State Locking)
```json
{
  "collection": "/groups/archived_grp",
  "operation": "update",
  "auth": { "uid": "owner_uid", "email_verified": true },
  "existingStatus": "archived",
  "payload": {
    "status": "active",
    "updatedAt": "SERVER_TIMESTAMP"
  },
  "expected": "PERMISSION_DENIED (existing().status != 'archived' gate blocks mutation)"
}
```

### Payload 11: Backdated Client Timestamp Injection (Phase 4.13 - Temporal Integrity)
```json
{
  "collection": "/vouches/vouch_1",
  "operation": "create",
  "auth": { "uid": "user_1", "email_verified": true },
  "payload": {
    "createdAt": "2020-01-01T00:00:00Z",
    "updatedAt": "2020-01-01T00:00:00Z"
  },
  "expected": "PERMISSION_DENIED (incoming().createdAt == request.time enforced)"
}
```

### Payload 12: Self-Vouching Integrity Violation (Domain Invariant)
```json
{
  "collection": "/vouches/vouch_self",
  "operation": "create",
  "auth": { "uid": "user_1", "email_verified": true },
  "payload": {
    "id": "vouch_self",
    "voucherId": "user_1",
    "targetUserId": "user_1"
  },
  "expected": "PERMISSION_DENIED (incoming().voucherId != incoming().targetUserId enforced)"
}
```
