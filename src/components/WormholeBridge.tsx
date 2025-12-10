import React, { useState } from 'react';
import EmbeddedWormholeBridge from './EmbeddedWormholeBridge';

interface WormholeBridgeProps {
  onClose?: () => void;
  userId?: string;
}

const WormholeBridge: React.FC<WormholeBridgeProps> = ({ onClose, userId }) => {
  const [isEmbedded, setIsEmbedded] = useState(false);

  const handleEmbeddedBridge = () => {
    setIsEmbedded(true);
  };

  const handleExternalBridge = () => {
    // Fallback to external bridge
    window.open('https://portalbridge.com/', '_blank');
  };

  // If embedded mode is selected, show the embedded component
  if (isEmbedded) {
    return <EmbeddedWormholeBridge onClose={onClose} userId={userId} />;
  }

  return (
    <div className="wormhole-bridge-container">
      <div className="bridge-header">
        <h2>🌉 Cross-Chain Bridge</h2>
        <p>Transfer USDC between blockchains seamlessly</p>
        {onClose && (
          <button onClick={onClose} className="close-button">×</button>
        )}
      </div>
      
      <div className="bridge-content" style={{ padding: '2rem', textAlign: 'center' }}>
        {!isEmbedded ? (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h3>🌉 Cross-Chain USDC Transfer</h3>
              <p>Transfer USDC between different blockchains using Wormhole</p>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <button 
                onClick={handleEmbeddedBridge}
                style={{
                  backgroundColor: '#00d4aa',
                  color: 'white',
                  padding: '1rem 2rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  marginBottom: '1rem',
                  marginRight: '0.5rem'
                }}
              >
                🚀 Start Bridge (In-App)
              </button>
              
              <button 
                onClick={handleExternalBridge}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '1rem 2rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
              >
                🌐 Open External Bridge
              </button>
              
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                Choose in-app bridge or external bridge
              </p>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              backgroundColor: '#e3f2fd', 
              padding: '1.5rem', 
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <h3 style={{ color: '#1976d2', margin: '0 0 1rem 0' }}>
                🌉 Wormhole Bridge
              </h3>
              <p style={{ color: '#666', margin: '0 0 1rem 0' }}>
                Complete your cross-chain transfer below. No need to leave this page!
              </p>
              
              <button 
                onClick={() => setIsEmbedded(false)}
                style={{
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                ← Back to Options
              </button>
            </div>
            
            {/* Embedded Wormhole Connect Widget */}
            <div style={{ 
              minHeight: '600px',
              width: '100%',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: '#f8f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <h4 style={{ color: '#666', marginBottom: '1rem' }}>🌉 Wormhole Connect Widget</h4>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  The embedded bridge widget will appear here once the SDK is properly installed.
                </p>
                <div style={{ 
                  backgroundColor: '#fff3cd', 
                  border: '1px solid #ffeaa7',
                  padding: '1rem', 
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  <p style={{ fontSize: '0.9rem', color: '#856404', margin: '0' }}>
                    <strong>Note:</strong> To enable the embedded widget, run: <code>npm install @wormhole-foundation/wormhole-connect</code>
                  </p>
                </div>
                <button 
                  onClick={handleExternalBridge}
                  style={{
                    backgroundColor: '#00d4aa',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Use External Bridge Instead
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '1rem', 
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <h4>How it works:</h4>
          <ol style={{ paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li>Click "Start Bridge (In-App)" for embedded experience</li>
            <li>Connect your wallet directly in the widget</li>
            <li>Select source and destination chains</li>
            <li>Complete transfer without leaving this page</li>
            <li>USDC automatically appears in your Circle wallet</li>
          </ol>
        </div>

        <div style={{ 
          backgroundColor: '#d1ecf1', 
          border: '1px solid #bee5eb',
          padding: '1rem', 
          borderRadius: '8px',
          marginTop: '1rem',
          textAlign: 'left'
        }}>
          <h4 style={{ color: '#0c5460', margin: '0 0 0.5rem 0' }}>💡 Benefits of In-App Bridge:</h4>
          <ul style={{ paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#0c5460', margin: '0' }}>
            <li><strong>No redirects</strong> - Users stay on your platform</li>
            <li><strong>Seamless experience</strong> - Like Paystack/Flutterwave checkout</li>
            <li><strong>Automatic detection</strong> - We monitor for completed transfers</li>
            <li><strong>Dashboard updates</strong> - USDC appears immediately</li>
            <li><strong>Professional UX</strong> - Enterprise-grade experience</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WormholeBridge;