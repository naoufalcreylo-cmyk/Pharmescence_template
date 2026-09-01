import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user knows which view failed. */
  section?: string;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Section-level error boundary (§Technical Requirements — error handling).
 *
 * Scoped per page rather than wrapped once around the app: a single failing
 * breakdown must not blank the whole dashboard while a media buyer is mid-review.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Real deployments forward this to Sentry/Datadog; the console keeps the
    // component stack available during development.
    console.error(`[${this.props.section ?? 'dashboard'}] render failed`, error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="card p-8 flex flex-col items-center text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <AlertOctagon size={24} className="text-rose-400" />
        </div>
        <p className="text-base font-semibold text-white">
          {this.props.section ? `${this.props.section} could not be displayed` : 'Something went wrong'}
        </p>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">
          The rest of the dashboard is still available. Retry this section, or switch views and come back.
        </p>
        <p className="mt-3 font-mono text-xs text-rose-400/80 bg-rose-500/5 border border-rose-500/15 rounded-lg px-3 py-2 max-w-lg truncate">
          {error.message}
        </p>
        <button
          onClick={this.reset}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-500 transition-colors"
        >
          <RotateCcw size={14} />
          Retry section
        </button>
      </div>
    );
  }
}
