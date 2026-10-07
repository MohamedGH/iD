import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  PlusCircle,
  Award,
  CheckSquare,
  LogOut,
  LogIn,
} from 'lucide-react';
import {
  getPrimaryNavRoutes,
  matchRouteFromPathname,
  resolveBreadcrumbs,
  RouteId,
} from '../managers/routeManager';
import { useAppStore } from '../managers/stateManager';
import {
  signInWithGooglePopup,
  signOutCurrentUser,
} from '../services/firestoreService';
import { formatTierLabel } from '../domain/groupLogic';
import { ManagedErrorStack } from './ErrorBoundary';

const ROUTE_ICON_MAP: Readonly<Record<RouteId, React.ComponentType<{ className?: string }>>> = {
  overview: Users,
  identity: ShieldCheck,
  'create-group': PlusCircle,
  'group-detail': Users,
  vouching: Award,
  diagnostics: CheckSquare,
};

export const AppShell: React.FC<{ readonly children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const myProfile = useAppStore((s) => s.myProfile);
  const groups = useAppStore((s) => s.groups);
  const activeBannerNotice = useAppStore((s) => s.activeBannerNotice);
  const setBannerNotice = useAppStore((s) => s.setBannerNotice);

  const navRoutes = getPrimaryNavRoutes();
  const matched = matchRouteFromPathname(location.pathname);

  const activeGroup =
    matched.route.id === 'group-detail'
      ? groups.find((g) => g.id === matched.params.groupId)
      : undefined;

  const breadcrumbs = resolveBreadcrumbs(location.pathname, activeGroup?.name);

  const handleSignIn = async () => {
    try {
      await signInWithGooglePopup();
    } catch {
      // Managed by errorManager
    }
  };

  const handleSignOut = async () => {
    await signOutCurrentUser();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] pb-20 md:pb-12">
      {/* Top Bar Contract: Strict 1-Row, 3-Zone Header on Desktop & Compact Sticky Header on Mobile */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
        {/* Zone 1: Single text element Brand Wordmark (No adjacent subtitles or pills) */}
        <Link
          to="/"
          className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          VeriCircle
        </Link>

        {/* Zone 2: 5 Clean Text Navigation Links with subtle hover underlines */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {navRoutes.map((route) => {
            const isActive = matched.route.id === route.id;
            return (
              <Link
                key={route.id}
                to={route.pathPattern}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors underline-offset-8 ${
                  isActive
                    ? 'text-slate-900 font-semibold underline decoration-2 decoration-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:underline'
                }`}
              >
                {route.shortLabel}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: 1–2 Primary Actions */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              <Link
                to="/identity"
                className="hidden sm:inline-block text-xs text-slate-600 hover:text-slate-900 truncate max-w-[200px] whitespace-nowrap"
              >
                {myProfile ? myProfile.displayName : currentUser.email}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Verify with Google</span>
            </button>
          )}
        </div>
      </header>

      {/* Contextual Breadcrumb Strip & Quiet Identity Status (Unboxed Metadata) */}
      <div className="border-b border-slate-200/80 bg-white px-4 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.path + idx}>
                {idx > 0 && <span aria-hidden="true">/</span>}
                {crumb.isCurrent ? (
                  <span className="font-medium text-slate-900 truncate max-w-[220px]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Unboxed Metadata Status with typographic separators */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {myProfile ? (
              <>
                <span className="text-emerald-700 font-medium">
                  {formatTierLabel(myProfile.verificationTier)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {myProfile.vouchCount} peer vouches
                </span>
              </>
            ) : currentUser ? (
              <span>Authenticated · Profile attestation ready</span>
            ) : (
              <span>Zero-trust identity verification protocol</span>
            )}
          </div>
        </div>
      </div>

      {/* Transient Action Notice Banner */}
      {activeBannerNotice && (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <span className="font-medium">{activeBannerNotice}</span>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="min-h-[36px] px-2.5 font-semibold underline hover:text-emerald-950 whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Centralized Error Manager Output */}
      <ManagedErrorStack />

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {children}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span>VeriCircle Protocol</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Cryptographically Attested Group Formation & PII-Isolated Identity Vault</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/identity" className="hover:text-slate-900 transition-colors">
              Identity Vault
            </Link>
            <Link to="/vouching" className="hover:text-slate-900 transition-colors">
              Peer Vouching
            </Link>
            <Link to="/diagnostics" className="hover:text-slate-900 transition-colors">
              Verification Suite
            </Link>
          </div>
        </div>
      </footer>

      {/* Mobile-First Fixed Bottom Thumb-Zone Navigation Bar (44x44px hitboxes, <15% viewport height) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center px-1"
      >
        {navRoutes.map((route) => {
          const IconComponent = ROUTE_ICON_MAP[route.id];
          const isActive = matched.route.id === route.id;
          return (
            <Link
              key={route.id}
              to={route.pathPattern}
              className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-[64px] whitespace-nowrap">
                {route.shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
