/**
 * Functional Route Manager
 * Provides declarative route definitions, pure path builders,
 * route matching, breadcrumb resolution, and access guard evaluation.
 */

export type RouteId =
  | 'overview'
  | 'identity'
  | 'create-group'
  | 'group-detail'
  | 'vouching'
  | 'diagnostics';

export interface RouteDescriptor {
  readonly id: RouteId;
  readonly pathPattern: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly requiresAuth: boolean;
  readonly requiresVerifiedProfile: boolean;
  readonly showInPrimaryNav: boolean;
}

export const ROUTES: Readonly<Record<RouteId, RouteDescriptor>> = Object.freeze({
  overview: {
    id: 'overview',
    pathPattern: '/',
    label: 'Assemblies Directory',
    shortLabel: 'Assemblies',
    requiresAuth: false,
    requiresVerifiedProfile: false,
    showInPrimaryNav: true,
  },
  identity: {
    id: 'identity',
    pathPattern: '/identity',
    label: 'Identity Attestation',
    shortLabel: 'Identity',
    requiresAuth: false,
    requiresVerifiedProfile: false,
    showInPrimaryNav: true,
  },
  'create-group': {
    id: 'create-group',
    pathPattern: '/groups/new',
    label: 'Form Verified Group',
    shortLabel: 'Form Group',
    requiresAuth: true,
    requiresVerifiedProfile: true,
    showInPrimaryNav: true,
  },
  'group-detail': {
    id: 'group-detail',
    pathPattern: '/groups/:groupId',
    label: 'Assembly Charter & Roster',
    shortLabel: 'Assembly',
    requiresAuth: false,
    requiresVerifiedProfile: false,
    showInPrimaryNav: false,
  },
  vouching: {
    id: 'vouching',
    pathPattern: '/vouching',
    label: 'Peer Vouching Ledger',
    shortLabel: 'Vouching',
    requiresAuth: false,
    requiresVerifiedProfile: false,
    showInPrimaryNav: true,
  },
  diagnostics: {
    id: 'diagnostics',
    pathPattern: '/diagnostics',
    label: 'Protocol Verification Suite',
    shortLabel: 'Verification',
    requiresAuth: false,
    requiresVerifiedProfile: false,
    showInPrimaryNav: true,
  },
});

export const getPrimaryNavRoutes = (): readonly RouteDescriptor[] =>
  Object.values(ROUTES).filter((route) => route.showInPrimaryNav);

export const buildGroupDetailPath = (groupId: string): string =>
  `/groups/${encodeURIComponent(groupId.trim())}`;

export const matchRouteFromPathname = (
  pathname: string
): Readonly<{
  readonly route: RouteDescriptor;
  readonly params: Readonly<Record<string, string>>;
}> => {
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';

  if (cleanPath === '/') {
    return Object.freeze({ route: ROUTES.overview, params: Object.freeze({}) });
  }
  if (cleanPath === '/identity') {
    return Object.freeze({ route: ROUTES.identity, params: Object.freeze({}) });
  }
  if (cleanPath === '/groups/new') {
    return Object.freeze({ route: ROUTES['create-group'], params: Object.freeze({}) });
  }
  if (cleanPath.startsWith('/groups/')) {
    const groupId = decodeURIComponent(cleanPath.slice('/groups/'.length));
    return Object.freeze({
      route: ROUTES['group-detail'],
      params: Object.freeze({ groupId }),
    });
  }
  if (cleanPath === '/vouching') {
    return Object.freeze({ route: ROUTES.vouching, params: Object.freeze({}) });
  }
  if (cleanPath === '/diagnostics') {
    return Object.freeze({ route: ROUTES.diagnostics, params: Object.freeze({}) });
  }

  return Object.freeze({ route: ROUTES.overview, params: Object.freeze({}) });
};

export interface BreadcrumbItem {
  readonly label: string;
  readonly path: string;
  readonly isCurrent: boolean;
}

export const resolveBreadcrumbs = (
  pathname: string,
  groupName?: string
): readonly BreadcrumbItem[] => {
  const matched = matchRouteFromPathname(pathname);
  const rootCrumb: BreadcrumbItem = {
    label: 'VeriCircle',
    path: '/',
    isCurrent: matched.route.id === 'overview',
  };

  if (matched.route.id === 'overview') {
    return Object.freeze([
      rootCrumb,
      { label: 'Assemblies Directory', path: '/', isCurrent: true },
    ]);
  }

  if (matched.route.id === 'group-detail') {
    const groupId = matched.params.groupId ?? 'group';
    return Object.freeze([
      { ...rootCrumb, isCurrent: false },
      { label: 'Assemblies', path: '/', isCurrent: false },
      {
        label: groupName || `Assembly ${groupId.slice(0, 8)}`,
        path: buildGroupDetailPath(groupId),
        isCurrent: true,
      },
    ]);
  }

  return Object.freeze([
    { ...rootCrumb, isCurrent: false },
    {
      label: matched.route.label,
      path: matched.route.pathPattern,
      isCurrent: true,
    },
  ]);
};

export const evaluateRouteAccess = (params: Readonly<{
  readonly route: RouteDescriptor;
  readonly isAuthenticated: boolean;
  readonly hasVerifiedProfile: boolean;
}>): Readonly<{
  readonly allowed: boolean;
  readonly redirectPath: string | null;
  readonly reason: string | null;
}> => {
  if (params.route.requiresAuth && !params.isAuthenticated) {
    return Object.freeze({
      allowed: false,
      redirectPath: '/identity',
      reason: 'Sign in with a verified account to access this route.',
    });
  }
  if (params.route.requiresVerifiedProfile && !params.hasVerifiedProfile) {
    return Object.freeze({
      allowed: false,
      redirectPath: '/identity',
      reason: 'Complete your verified identity attestation before forming a group.',
    });
  }
  return Object.freeze({
    allowed: true,
    redirectPath: null,
    reason: null,
  });
};
