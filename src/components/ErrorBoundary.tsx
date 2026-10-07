import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../managers/stateManager';
import { ManagedErrorRecord } from '../managers/errorManager';

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly errorMessage: string;
}

export class GlobalErrorBoundary extends React.Component<
  { readonly children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { readonly children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected application error.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-3 flex-1 min-w-0">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Runtime Protection Gate Triggered
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed break-words font-mono">
                  {this.state.errorMessage}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    Restore Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ManagedErrorStack: React.FC = () => {
  const errors = useAppStore((s) => s.errors);
  const dismissError = useAppStore((s) => s.dismissError);
  const clearErrors = useAppStore((s) => s.clearErrors);

  if (errors.length === 0) return null;

  return (
    <section
      aria-label="System Notifications and Error Manager"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 space-y-2"
    >
      {errors.map((err: ManagedErrorRecord) => (
        <div
          key={err.id}
          role="alert"
          className="bg-white border border-red-200 rounded-xl p-4 flex items-start justify-between gap-4"
        >
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-red-700 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{err.title}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{err.category}</span>
              {err.path && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">path: {err.path}</span>
                </>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed break-words">
              {err.message}
            </p>
            {err.upgradeUrl && (
              <a
                href={err.upgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-semibold text-slate-900 underline hover:text-slate-700 pt-1"
              >
                Open Firebase Database Upgrade Console
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {errors.length > 1 && (
              <button
                type="button"
                onClick={clearErrors}
                className="min-h-[44px] px-3 text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissError(err.id)}
              aria-label="Dismiss error notice"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
};
