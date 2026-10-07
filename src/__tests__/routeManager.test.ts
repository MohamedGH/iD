import { describe, it, expect } from 'vitest';
import {
  ROUTES,
  getPrimaryNavRoutes,
  buildGroupDetailPath,
  matchRouteFromPathname,
  resolveBreadcrumbs,
  evaluateRouteAccess,
} from '../managers/routeManager';

describe('Route Manager Functional Suite', () => {
  it('returns primary navigation routes in deterministic order', () => {
    const primary = getPrimaryNavRoutes();
    expect(primary.length).toBe(5);
    expect(primary.map((r) => r.id)).toEqual([
      'overview',
      'identity',
      'create-group',
      'vouching',
      'diagnostics',
    ]);
  });

  it('matches static and parameterized routes accurately', () => {
    expect(matchRouteFromPathname('/').route.id).toBe('overview');
    expect(matchRouteFromPathname('/identity').route.id).toBe('identity');
    expect(matchRouteFromPathname('/groups/new').route.id).toBe('create-group');

    const groupMatch = matchRouteFromPathname('/groups/grp_sovereign_01');
    expect(groupMatch.route.id).toBe('group-detail');
    expect(groupMatch.params.groupId).toBe('grp_sovereign_01');

    expect(matchRouteFromPathname('/vouching').route.id).toBe('vouching');
    expect(matchRouteFromPathname('/diagnostics').route.id).toBe('diagnostics');
  });

  it('builds URL-encoded group detail paths and resolves breadcrumbs', () => {
    const path = buildGroupDetailPath('grp_123');
    expect(path).toBe('/groups/grp_123');

    const crumbs = resolveBreadcrumbs(path, 'Nordic Trust Circle');
    expect(crumbs.length).toBe(3);
    expect(crumbs[2].label).toBe('Nordic Trust Circle');
    expect(crumbs[2].isCurrent).toBe(true);
  });

  it('enforces route access guards for unauthenticated or unverified users', () => {
    const deniedAuth = evaluateRouteAccess({
      route: ROUTES['create-group'],
      isAuthenticated: false,
      hasVerifiedProfile: false,
    });
    expect(deniedAuth.allowed).toBe(false);
    expect(deniedAuth.redirectPath).toBe('/identity');

    const allowed = evaluateRouteAccess({
      route: ROUTES['create-group'],
      isAuthenticated: true,
      hasVerifiedProfile: true,
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.redirectPath).toBeNull();
  });
});
