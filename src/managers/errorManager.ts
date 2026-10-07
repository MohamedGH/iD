import { auth, FIREBASE_PROJECT_INFO } from '../lib/firebase';

/**
 * Mandatory OperationType enum per firebase-integration-rpc skill
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Mandatory FirestoreErrorInfo interface per firebase-integration-rpc skill
 */
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type ErrorCategory =
  | 'permission'
  | 'quota'
  | 'validation'
  | 'network'
  | 'auth'
  | 'unknown';

export interface ManagedErrorRecord {
  readonly id: string;
  readonly category: ErrorCategory;
  readonly title: string;
  readonly message: string;
  readonly rawError: string;
  readonly operationType?: OperationType;
  readonly path?: string | null;
  readonly upgradeUrl?: string | null;
  readonly timestamp: string;
}

/**
 * Pure helper to classify raw error messages into actionable categories
 */
export const classifyErrorMessage = (rawMessage: string): ErrorCategory => {
  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('quota exceeded') ||
    lower.includes('free daily read units per project')
  ) {
    return 'quota';
  }
  if (
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission_denied') ||
    lower.includes('permission-denied')
  ) {
    return 'permission';
  }
  if (
    lower.includes('offline') ||
    lower.includes('network') ||
    lower.includes('unavailable')
  ) {
    return 'network';
  }
  if (
    lower.includes('auth/') ||
    lower.includes('popup-closed-by-user') ||
    lower.includes('unauthenticated')
  ) {
    return 'auth';
  }
  if (lower.includes('validation') || lower.includes('invalid')) {
    return 'validation';
  }
  return 'unknown';
};

export const buildQuotaUpgradeUrl = (
  projectId: string = FIREBASE_PROJECT_INFO.projectId,
  databaseId: string = FIREBASE_PROJECT_INFO.firestoreDatabaseId
): string =>
  `https://console.firebase.google.com/project/${projectId}/firestore/databases/${databaseId}/data?openUpgradeDialog=true`;

/**
 * Pure function to construct a ManagedErrorRecord from an error
 */
export const createManagedErrorRecord = (params: Readonly<{
  readonly id: string;
  readonly rawMessage: string;
  readonly operationType?: OperationType;
  readonly path?: string | null;
  readonly timestamp: string;
}>): ManagedErrorRecord => {
  const category = classifyErrorMessage(params.rawMessage);

  const isSpecificReadQuota = params.rawMessage.includes(
    "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
  );

  const titleMap: Readonly<Record<ErrorCategory, string>> = {
    permission: 'Security Rule Policy Rejection',
    quota: 'Firestore Usage Quota Exceeded',
    validation: 'Schema Validation Constraint',
    network: 'Network Connectivity Issue',
    auth: 'Authentication Session Notice',
    unknown: 'Application Operation Error',
  };

  const friendlyMessage =
    category === 'quota'
      ? 'Firestore free-tier usage quota has been reached. Quota resets the next day (see Spark plan limits under Enterprise edition at firebase.google.com/pricing#cloud-firestore).'
      : params.rawMessage;

  return Object.freeze({
    id: params.id,
    category,
    title: titleMap[category],
    message: friendlyMessage,
    rawError: params.rawMessage,
    operationType: params.operationType,
    path: params.path,
    upgradeUrl: isSpecificReadQuota ? buildQuotaUpgradeUrl() : null,
    timestamp: params.timestamp,
  });
};

/**
 * Pure state transition functions for the Error Manager
 */
export const appendErrorPure = (
  record: ManagedErrorRecord,
  maxItems: number = 10
) => (currentErrors: readonly ManagedErrorRecord[]): readonly ManagedErrorRecord[] =>
  Object.freeze([record, ...currentErrors.filter((e) => e.id !== record.id)].slice(0, maxItems));

export const dismissErrorPure = (id: string) => (
  currentErrors: readonly ManagedErrorRecord[]
): readonly ManagedErrorRecord[] =>
  Object.freeze(currentErrors.filter((e) => e.id !== id));

export const clearAllErrorsPure = (): readonly ManagedErrorRecord[] =>
  Object.freeze([]);

/**
 * Mandatory Firestore Error Handler per firebase-integration-rpc skill.
 * Formats the error into FirestoreErrorInfo JSON, notifies listeners, and throws.
 */
type ErrorSubscriber = (record: ManagedErrorRecord) => void;
let errorSubscribers: readonly ErrorSubscriber[] = [];

export const subscribeToManagedErrors = (listener: ErrorSubscriber): (() => void) => {
  errorSubscribers = Object.freeze([...errorSubscribers, listener]);
  return () => {
    errorSubscribers = Object.freeze(errorSubscribers.filter((l) => l !== listener));
  };
};

export const notifyManagedError = (record: ManagedErrorRecord): void => {
  errorSubscribers.forEach((listener) => listener(record));
};

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const currentUser = auth?.currentUser;
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);

  const record = createManagedErrorRecord({
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    rawMessage: errInfo.error,
    operationType,
    path,
    timestamp: new Date().toISOString(),
  });
  notifyManagedError(record);

  throw new Error(serialized);
}
