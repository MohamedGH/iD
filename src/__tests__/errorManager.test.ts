import { describe, it, expect } from 'vitest';
import {
  OperationType,
  classifyErrorMessage,
  createManagedErrorRecord,
  appendErrorPure,
  dismissErrorPure,
  clearAllErrorsPure,
  buildFirestoreErrorInfo,
  handleFirestoreError,
  subscribeToManagedErrors,
} from '../managers/errorManager';

describe('Error Manager Functional Suite', () => {
  it('classifies permission, quota, network, auth, and validation errors purely', () => {
    expect(classifyErrorMessage('Missing or insufficient permissions.')).toBe('permission');
    expect(classifyErrorMessage('Quota exceeded.')).toBe('quota');
    expect(
      classifyErrorMessage(
        "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
      )
    ).toBe('quota');
    expect(classifyErrorMessage('The client is offline')).toBe('network');
    expect(classifyErrorMessage('auth/popup-closed-by-user')).toBe('auth');
    expect(classifyErrorMessage('Validation Error: invalid field')).toBe('validation');
  });

  it('generates Firebase Console upgrade URL on specific daily read quota error', () => {
    const record = createManagedErrorRecord({
      id: 'e1',
      rawMessage:
        "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'",
      operationType: OperationType.LIST,
      path: 'groups',
      timestamp: '2026-10-07T00:00:00Z',
    });
    expect(record.category).toBe('quota');
    expect(record.upgradeUrl).toContain('openUpgradeDialog=true');
  });

  it('manages error records immutably with appendErrorPure, dismissErrorPure, and clearAllErrorsPure', () => {
    const r1 = createManagedErrorRecord({
      id: 'e1',
      rawMessage: 'Permission_denied',
      timestamp: '2026-10-07T00:00:00Z',
    });
    const r2 = createManagedErrorRecord({
      id: 'e2',
      rawMessage: 'Network offline',
      timestamp: '2026-10-07T00:00:01Z',
    });

    const list1 = appendErrorPure(r1)([]);
    const list2 = appendErrorPure(r2)(list1);
    expect(list2.length).toBe(2);
    expect(list2[0].id).toBe('e2');

    const afterDismiss = dismissErrorPure('e2')(list2);
    expect(afterDismiss.length).toBe(1);
    expect(afterDismiss[0].id).toBe('e1');

    expect(clearAllErrorsPure().length).toBe(0);
  });

  it('formats FirestoreErrorInfo JSON and throws via handleFirestoreError while notifying subscribers', () => {
    const info = buildFirestoreErrorInfo(
      new Error('Missing or insufficient permissions.'),
      OperationType.GET,
      'users_private/u123'
    );
    expect(info.operationType).toBe(OperationType.GET);
    expect(info.path).toBe('users_private/u123');
    expect(info.error).toBe('Missing or insufficient permissions.');

    let capturedTitle = '';
    const unsub = subscribeToManagedErrors((rec) => {
      capturedTitle = rec.title;
    });

    expect(() =>
      handleFirestoreError(
        new Error('Missing or insufficient permissions.'),
        OperationType.CREATE,
        'groups/g1'
      )
    ).toThrowError(/Missing or insufficient permissions/);

    expect(capturedTitle).toBe('Security Rule Policy Rejection');
    unsub();
  });
});
