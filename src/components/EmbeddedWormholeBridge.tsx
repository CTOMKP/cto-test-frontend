import React, { useState, useEffect } from 'react';

interface EmbeddedWormholeBridgeProps {
  onClose?: () => void;
  userId?: string;
}

const EmbeddedWormholeBridge: React.FC<EmbeddedWormholeBridgeProps> = ({ onClose, userId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [WormholeConnect, setWormholeConnect] = useState<any>(null);

  useEffect(() => {
    // Try to load Wormhole Connect SDK
    const loadWormholeConnect = async () => {
      try {
        // Check if the package is installed
        const { default: WormholeConnectComponent } = await import('@wormhole-foundation/wormhole-connect');
        setWormholeConnect(() => WormholeConnectComponent);
        setIsLoading(false);
      } catch (err) {
        console.log('Wormhole Connect SDK not installed, using fallback');
        setError('Wormhole Connect SDK not installed. Please run: npm install @wormhole-foundation/wormhole-connect');
        setIsLoading(false);
      }
    };

    loadWormholeConnect();
  }, []);

  const handleExternalBridge = () => {
    window.open('https://portalbridge.com/', '_blank');
  };

  if (isLoading) {
    return (
      <div className="wormhole-bridge-container">
        <div className="bridge-header">
          <h2>🌉 Cross-Chain Bridge</h2>
          <p>Loading embedded bridge...</p>
          {onClose && (
            <button onClick={onClose} className="close-button">×</button>
          )}
        </div>
        <div className="bridge-content" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner">⏳ Loading bridge interface...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wormhole-bridge-container">
        <div className="bridge-header">
          <h2>🌉 Cross-Chain Bridge</h2>
          <p>Embedded bridge unavailable</p>
          {onClose && (
            <button onClick={onClose} className="close-button">×</button>
          )}
        </div>
        <div className="bridge-content" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ 
            backgroundColor: '#f8d7da', 
            border: '1px solid #f5c6cb',
            padding: '1.5rem', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h3 style={{ color: '#721c24', margin: '0 0 1rem 0' }}>
              ❌ SDK Not Installed
            </h3>
            <p style={{ color: '#721c24', margin: '0 0 1rem 0' }}>
              {error}
            </p>
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
              🌐 Use External Bridge
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Configuration for Wormhole Connect with Ankr API
  const config = {
    network: 'Mainnet',
    chains: ['Ethereum', 'Polygon', 'Avalanche', 'Base', 'Arbitrum', 'Optimism'],
    rpcs: {
      Ethereum: process.env.REACT_APP_ANKR_ETHEREUM_RPC || 'https://rpc.ankr.com/eth',
      Polygon: process.env.REACT_APP_ANKR_POLYGON_RPC || 'https://rpc.ankr.com/polygon',
      Avalanche: process.env.REACT_APP_ANKR_AVALANCHE_RPC || 'https://rpc.ankr.com/avalanche',
      Base: process.env.REACT_APP_ANKR_BASE_RPC || 'https://rpc.ankr.com/base',
      Arbitrum: process.env.REACT_APP_ANKR_ARBITRUM_RPC || 'https://rpc.ankr.com/arbitrum',
      Optimism: process.env.REACT_APP_ANKR_OPTIMISM_RPC || 'https://rpc.ankr.com/optimism'
    }
  };

  const theme = {
    mode: 'light',
    primary: '#00d4aa',
    secondary: '#f8f9fa'
  };

  return (
    <div className="wormhole-bridge-container">
      <div className="bridge-header">
        <h2>🌉 Cross-Chain Bridge</h2>
        <p>Transfer USDC between blockchains seamlessly</p>
        {onClose && (
          <button onClick={onClose} className="close-button">×</button>
        )}
      </div>
      
      <div className="bridge-content">
        <div style={{ 
          backgroundColor: '#e3f2fd', 
          padding: '1rem', 
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#1976d2', margin: '0 0 0.5rem 0' }}>
            🌉 Embedded Wormhole Bridge
          </h3>
          <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
            Complete your transfer below without leaving this page
          </p>
        </div>
        
        {/* Embedded Wormhole Connect Widget */}
        <div style={{ 
          minHeight: '600px',
          width: '100%',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: '#fff'
        }}>
          {WormholeConnect && (
            <WormholeConnect 
              config={config} 
              theme={theme}
            />
          )}
        </div>
        
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '1rem', 
          borderRadius: '8px',
          marginTop: '1rem',
          textAlign: 'left'
        }}>
          <h4>💡 How to use:</h4>
          <ol style={{ paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
            <li>Connect your wallet using the interface above</li>
            <li>Select source chain (where your USDC is)</li>
            <li>Select destination chain (where you want USDC)</li>
            <li>Enter amount and confirm transfer</li>
            <li>USDC will appear in your Circle wallet automatically</li>
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
          <h4 style={{ color: '#0c5460', margin: '0 0 0.5rem 0' }}>🚀 Ankr API Enabled:</h4>
          <ul style={{ paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#0c5460', margin: '0' }}>
            <li><strong>Premium RPCs:</strong> Using Ankr public endpoints (no API key needed!)</li>
            <li><strong>Rate Limits:</strong> 200M API Credits per month via IP tracking</li>
            <li><strong>Performance:</strong> Faster token loading and discovery</li>
            <li><strong>Fallback:</strong> External bridge still available if needed</li>
          </ul>
        </div>

        <div style={{ 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7',
          padding: '1rem', 
          borderRadius: '8px',
          marginTop: '1rem',
          textAlign: 'left'
        }}>
          <h4 style={{ color: '#856404', margin: '0 0 0.5rem 0' }}>⚠️ Balance Validation:</h4>
          <ul style={{ paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#856404', margin: '0' }}>
            <li><strong>Automatic Check:</strong> Widget validates you have sufficient balance</li>
            <li><strong>Button State:</strong> Transfer button should be disabled if balance is too low</li>
            <li><strong>Error Message:</strong> "Insufficient balance" should appear if amount exceeds balance</li>
            <li><strong>Balance Display:</strong> Shows your current USDC balance on source chain</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EmbeddedWormholeBridge;

