/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, testFirestoreConnection } from './lib/firebase';
import { useAppStore } from './managers/stateManager';
import { subscribeToManagedErrors } from './managers/errorManager';
import {
  ensureInitialVerifiedProfile,
  subscribeToVerifiedEcosystem,
} from './services/firestoreService';
import { GlobalErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { IdentityPage } from './pages/IdentityPage';
import { CreateGroupPage } from './pages/CreateGroupPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { VouchingPage } from './pages/VouchingPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

const EcosystemSynchronizer: React.FC<{ readonly children: React.ReactNode }> = ({
  children,
}) => {
  const setAuthSession = useAppStore((s) => s.setAuthSession);
  const setProfilesDirectory = useAppStore((s) => s.setProfilesDirectory);
  const setMyPrivateVault = useAppStore((s) => s.setMyPrivateVault);
  const setGroups = useAppStore((s) => s.setGroups);
  const setVouches = useAppStore((s) => s.setVouches);
  const pushError = useAppStore((s) => s.pushError);

  useEffect(() => {
    void testFirestoreConnection();

    const unsubErrorManager = subscribeToManagedErrors((record) => {
      pushError(record);
    });

    return () => {
      unsubErrorManager();
    };
  }, [pushError]);

  useEffect(() => {
    let unsubEcosystem: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubEcosystem) {
        unsubEcosystem();
        unsubEcosystem = null;
      }

      if (!firebaseUser) {
        setAuthSession(null);
        setProfilesDirectory([]);
        setMyPrivateVault(null);
        setGroups([]);
        setVouches([]);
        return;
      }

      setAuthSession({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
      });

      if (firebaseUser.emailVerified) {
        try {
          await ensureInitialVerifiedProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
          });
        } catch {
          // Handled by errorManager
        }

        unsubEcosystem = subscribeToVerifiedEcosystem(firebaseUser.uid, {
          onProfiles: (profiles) => setProfilesDirectory(profiles),
          onPrivateVault: (vault) => setMyPrivateVault(vault),
          onGroups: (groups) => setGroups(groups),
          onVouches: (vouches) => setVouches(vouches),
        });
      }
    });

    return () => {
      unsubAuth();
      if (unsubEcosystem) {
        unsubEcosystem();
      }
    };
  }, [
    setAuthSession,
    setProfilesDirectory,
    setMyPrivateVault,
    setGroups,
    setVouches,
  ]);

  return <>{children}</>;
};

export default function App() {
  return (
    <GlobalErrorBoundary>
      <BrowserRouter>
        <EcosystemSynchronizer>
          <AppShell>
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/identity" element={<IdentityPage />} />
              <Route path="/groups/new" element={<CreateGroupPage />} />
              <Route path="/groups/:groupId" element={<GroupDetailPage />} />
              <Route path="/vouching" element={<VouchingPage />} />
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </EcosystemSynchronizer>
      </BrowserRouter>
    </GlobalErrorBoundary>
  );
}
