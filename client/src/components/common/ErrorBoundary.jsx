import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '32px 24px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
              border: '1px solid #FEE2E2',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#FEF2F2',
                color: '#EF4444',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '20px', lineHeight: 1.5 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred while loading this page.'}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                background: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw size={16} /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
