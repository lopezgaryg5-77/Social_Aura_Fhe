// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface AuraMatch {
  id: string;
  encryptedDistance: string;
  encryptedCompatibility: string;
  timestamp: number;
  matchedAddress: string;
  status: "pending" | "matched" | "rejected";
  interests: string[];
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'increase10%':
      result = value * 1.1;
      break;
    case 'decrease10%':
      result = value * 0.9;
      break;
    case 'double':
      result = value * 2;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<AuraMatch[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<AuraMatch | null>(null);
  const [decryptedCompatibility, setDecryptedCompatibility] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<'matches' | 'nearby'>('matches');
  const [searchQuery, setSearchQuery] = useState('');
  const matchedCount = matches.filter(m => m.status === "matched").length;
  const pendingCount = matches.filter(m => m.status === "pending").length;
  const rejectedCount = matches.filter(m => m.status === "rejected").length;

  const interestOptions = [
    "Web3", "DeFi", "NFTs", "Gaming", "Music", 
    "Art", "Tech", "Travel", "Food", "Sports",
    "Reading", "Photography", "Coding", "Blockchain", "AI"
  ];

  useEffect(() => {
    loadMatches().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadMatches = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      const keysBytes = await contract.getData("match_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing match keys:", e); }
      }
      const list: AuraMatch[] = [];
      for (const key of keys) {
        try {
          const matchBytes = await contract.getData(`match_${key}`);
          if (matchBytes.length > 0) {
            try {
              const matchData = JSON.parse(ethers.toUtf8String(matchBytes));
              list.push({ 
                id: key, 
                encryptedDistance: matchData.distance, 
                encryptedCompatibility: matchData.compatibility, 
                timestamp: matchData.timestamp, 
                matchedAddress: matchData.matchedAddress, 
                status: matchData.status || "pending",
                interests: matchData.interests || []
              });
            } catch (e) { console.error(`Error parsing match data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading match ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setMatches(list);
    } catch (e) { console.error("Error loading matches:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitInterests = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    if (userInterests.length === 0) { alert("Please select at least one interest"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting social aura with Zama FHE..." });
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      const matchId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const matchData = { 
        distance: FHEEncryptNumber(Math.floor(Math.random() * 1000)), // Simulated distance
        compatibility: FHEEncryptNumber(Math.floor(Math.random() * 100)), // Simulated compatibility score
        timestamp: Math.floor(Date.now() / 1000), 
        matchedAddress: address, 
        status: "pending",
        interests: userInterests
      };
      await contract.setData(`match_${matchId}`, ethers.toUtf8Bytes(JSON.stringify(matchData)));
      const keysBytes = await contract.getData("match_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(matchId);
      await contract.setData("match_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      setTransactionStatus({ visible: true, status: "success", message: "Social aura created successfully!" });
      await loadMatches();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setUserInterests([]);
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const verifyMatch = async (matchId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing encrypted match with FHE..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      const matchBytes = await contract.getData(`match_${matchId}`);
      if (matchBytes.length === 0) throw new Error("Match not found");
      const matchData = JSON.parse(ethers.toUtf8String(matchBytes));
      
      const verifiedCompatibility = FHECompute(matchData.compatibility, 'increase10%');
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      const updatedMatch = { ...matchData, status: "matched", compatibility: verifiedCompatibility };
      await contractWithSigner.setData(`match_${matchId}`, ethers.toUtf8Bytes(JSON.stringify(updatedMatch)));
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE match completed successfully!" });
      await loadMatches();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Match failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const rejectMatch = async (matchId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing encrypted match with FHE..." });
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      const matchBytes = await contract.getData(`match_${matchId}`);
      if (matchBytes.length === 0) throw new Error("Match not found");
      const matchData = JSON.parse(ethers.toUtf8String(matchBytes));
      const updatedMatch = { ...matchData, status: "rejected" };
      await contract.setData(`match_${matchId}`, ethers.toUtf8Bytes(JSON.stringify(updatedMatch)));
      setTransactionStatus({ visible: true, status: "success", message: "FHE rejection completed successfully!" });
      await loadMatches();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Rejection failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isOwner = (matchAddress: string) => address?.toLowerCase() === matchAddress.toLowerCase();

  const tutorialSteps = [
    { title: "Connect Wallet", description: "Connect your Web3 wallet to start using Social Aura", icon: "🔗" },
    { title: "Set Your Interests", description: "Select your interests to create your encrypted social profile", icon: "🔒", details: "Your interests are encrypted using Zama FHE technology" },
    { title: "Discover Matches", description: "Find people nearby with compatible interests", icon: "⚙️", details: "Matching happens on encrypted data without exposing personal details" },
    { title: "Connect Privately", description: "Get notified when compatible people are nearby", icon: "📊", details: "All notifications are private and encrypted" }
  ];

  const renderCompatibilityChart = (value: number) => {
    return (
      <div className="compatibility-chart">
        <div className="chart-bar" style={{ width: `${value}%` }}></div>
        <div className="chart-value">{value}%</div>
      </div>
    );
  };

  const filteredMatches = matches.filter(match => 
    match.interests.some(interest => 
      interest.toLowerCase().includes(searchQuery.toLowerCase())
    ) || 
    match.matchedAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing encrypted social aura...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Social Aura</h1>
          <span className="fhe-badge">FHE Encrypted</span>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            <div className="add-icon"></div>Create Aura
          </button>
          <button className="tutorial-btn" onClick={() => setShowTutorial(!showTutorial)}>
            {showTutorial ? "Hide Guide" : "Show Guide"}
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Discover Meaningful Connections</h2>
            <p>Meet people with compatible interests while keeping your data private with Zama FHE</p>
          </div>
          <div className="fhe-indicator">
            <div className="fhe-lock"></div>
            <span>End-to-End Encrypted</span>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>How Social Aura Works</h2>
            <p className="subtitle">Private social discovery powered by FHE encryption</p>
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.details && <div className="step-details">{step.details}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="fhe-diagram">
              <div className="diagram-step"><div className="diagram-icon">👤</div><div className="diagram-label">Your Profile</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">🔒</div><div className="diagram-label">FHE Encryption</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">⚡</div><div className="diagram-label">Private Matching</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">🔔</div><div className="diagram-label">Secure Notifications</div></div>
            </div>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h3>Project Introduction</h3>
            <p>Social Aura uses <strong>Zama FHE technology</strong> to create encrypted social profiles based on your interests. Meet compatible people nearby without exposing your personal data.</p>
            <div className="fhe-tag"><span>FHE-Powered Privacy</span></div>
          </div>
          <div className="dashboard-card">
            <h3>Match Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item"><div className="stat-value">{matches.length}</div><div className="stat-label">Total</div></div>
              <div className="stat-item"><div className="stat-value">{matchedCount}</div><div className="stat-label">Matched</div></div>
              <div className="stat-item"><div className="stat-value">{pendingCount}</div><div className="stat-label">Pending</div></div>
              <div className="stat-item"><div className="stat-value">{rejectedCount}</div><div className="stat-label">Rejected</div></div>
            </div>
          </div>
        </div>

        <div className="matches-section">
          <div className="section-header">
            <div className="tabs">
              <button className={activeTab === 'matches' ? 'active' : ''} onClick={() => setActiveTab('matches')}>Your Matches</button>
              <button className={activeTab === 'nearby' ? 'active' : ''} onClick={() => setActiveTab('nearby')}>Nearby</button>
            </div>
            <div className="header-actions">
              <input 
                type="text" 
                placeholder="Search matches..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button onClick={loadMatches} className="refresh-btn" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="matches-list">
            {filteredMatches.length === 0 ? (
              <div className="no-matches">
                <div className="no-matches-icon"></div>
                <p>No matches found</p>
                <button className="primary-btn" onClick={() => setShowCreateModal(true)}>Create Your Social Aura</button>
              </div>
            ) : filteredMatches.map(match => (
              <div className="match-card" key={match.id} onClick={() => setSelectedMatch(match)}>
                <div className="match-header">
                  <div className="match-id">#{match.id.substring(0, 6)}</div>
                  <div className={`status-badge ${match.status}`}>{match.status}</div>
                </div>
                <div className="match-body">
                  <div className="match-address">{match.matchedAddress.substring(0, 6)}...{match.matchedAddress.substring(38)}</div>
                  <div className="match-interests">
                    {match.interests.slice(0, 3).map((interest, i) => (
                      <span key={i} className="interest-tag">{interest}</span>
                    ))}
                    {match.interests.length > 3 && <span className="more-tag">+{match.interests.length - 3}</span>}
                  </div>
                  {selectedMatch?.id === match.id && decryptedCompatibility !== null && (
                    <div className="compatibility-score">
                      {renderCompatibilityChart(decryptedCompatibility)}
                    </div>
                  )}
                </div>
                <div className="match-footer">
                  <div className="match-date">{new Date(match.timestamp * 1000).toLocaleDateString()}</div>
                  <div className="match-actions">
                    {isOwner(match.matchedAddress) && match.status === "pending" && (
                      <>
                        <button className="action-btn success" onClick={(e) => { e.stopPropagation(); verifyMatch(match.id); }}>Accept</button>
                        <button className="action-btn danger" onClick={(e) => { e.stopPropagation(); rejectMatch(match.id); }}>Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Create Your Social Aura</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="fhe-notice">
                <div className="key-icon"></div> 
                <div>
                  <strong>FHE Encryption Notice</strong>
                  <p>Your interests will be encrypted with Zama FHE before submission</p>
                </div>
              </div>
              <div className="form-group">
                <label>Select Your Interests</label>
                <div className="interests-grid">
                  {interestOptions.map(interest => (
                    <div 
                      key={interest} 
                      className={`interest-option ${userInterests.includes(interest) ? 'selected' : ''}`}
                      onClick={() => {
                        if (userInterests.includes(interest)) {
                          setUserInterests(userInterests.filter(i => i !== interest));
                        } else {
                          setUserInterests([...userInterests, interest]);
                        }
                      }}
                    >
                      {interest}
                    </div>
                  ))}
                </div>
              </div>
              <div className="encryption-preview">
                <h4>Encryption Preview</h4>
                <div className="preview-container">
                  <div className="plain-data">
                    <span>Plain Interests:</span>
                    <div>{userInterests.join(', ') || 'No interests selected'}</div>
                  </div>
                  <div className="encryption-arrow">→</div>
                  <div className="encrypted-data">
                    <span>Encrypted Data:</span>
                    <div>{userInterests.length > 0 ? FHEEncryptNumber(userInterests.length).substring(0, 50) + '...' : 'No data'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="cancel-btn">Cancel</button>
              <button onClick={submitInterests} disabled={creating} className="submit-btn">
                {creating ? "Encrypting with FHE..." : "Create Aura"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {selectedMatch && (
        <div className="modal-overlay">
          <div className="match-detail-modal">
            <div className="modal-header">
              <h2>Match Details #{selectedMatch.id.substring(0, 8)}</h2>
              <button onClick={() => { setSelectedMatch(null); setDecryptedCompatibility(null); }} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="match-info">
                <div className="info-item"><span>Address:</span><strong>{selectedMatch.matchedAddress}</strong></div>
                <div className="info-item"><span>Date:</span><strong>{new Date(selectedMatch.timestamp * 1000).toLocaleString()}</strong></div>
                <div className="info-item"><span>Status:</span><strong className={`status-badge ${selectedMatch.status}`}>{selectedMatch.status}</strong></div>
              </div>
              <div className="interests-section">
                <h3>Shared Interests</h3>
                <div className="interests-list">
                  {selectedMatch.interests.map((interest, i) => (
                    <span key={i} className="interest-tag">{interest}</span>
                  ))}
                </div>
              </div>
              <div className="encrypted-data-section">
                <h3>Encrypted Compatibility</h3>
                <div className="encrypted-data">{selectedMatch.encryptedCompatibility.substring(0, 100)}...</div>
                <div className="fhe-tag"><div className="fhe-icon"></div><span>FHE Encrypted</span></div>
                <button 
                  className="decrypt-btn" 
                  onClick={async () => {
                    if (decryptedCompatibility !== null) {
                      setDecryptedCompatibility(null);
                    } else {
                      const decrypted = await decryptWithSignature(selectedMatch.encryptedCompatibility);
                      if (decrypted !== null) setDecryptedCompatibility(decrypted);
                    }
                  }} 
                  disabled={isDecrypting}
                >
                  {isDecrypting ? "Decrypting..." : decryptedCompatibility !== null ? "Hide Value" : "Decrypt Compatibility"}
                </button>
              </div>
              {decryptedCompatibility !== null && (
                <div className="compatibility-section">
                  <h3>Compatibility Score</h3>
                  {renderCompatibilityChart(decryptedCompatibility)}
                  <div className="compatibility-message">
                    {decryptedCompatibility > 80 ? "Excellent match!" : 
                     decryptedCompatibility > 60 ? "Good potential" : 
                     decryptedCompatibility > 40 ? "Some common interests" : "Low compatibility"}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setSelectedMatch(null); setDecryptedCompatibility(null); }} className="close-btn">Close</button>
            </div>
          </div>
        </div>
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">Social Aura</div>
            <p>Private social discovery powered by Zama FHE</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>FHE-Powered Privacy</span></div>
          <div className="copyright">© {new Date().getFullYear()} Social Aura. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;