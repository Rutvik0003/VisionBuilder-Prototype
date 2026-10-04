import { Component, type ReactNode } from 'react';
import { useStore } from '../store';

/** Keeps a demo alive: shows the error with Reload / Reset buttons instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <div className="text-lg font-semibold">Something went wrong</div>
        <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-3 text-left text-xs text-danger">{this.state.error.message}</pre>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-outline" onClick={() => location.reload()}>Reload</button>
          <button className="btn-primary" onClick={() => { useStore.getState().resetDemo(); location.href = '/'; }}>Reset demo</button>
        </div>
      </div>
    );
  }
}
