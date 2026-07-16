import React, { useState, useEffect, useRef } from 'react';
import { useApp, API_BASE_URL } from './context/AppContext';

import { 
  ShieldAlert, 
  Users, 
  MessageSquare, 
  Clock, 
  Settings, 
  LogOut, 
  Search, 
  Trash2, 
  Plus, 
  Send, 
  Sparkles, 
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  Eye,
  Info,
  DollarSign,
  TrendingUp,
  Globe,
  Sliders,
  Award,
  Sun,
  Moon
} from 'lucide-react';

function App() {
  const { creator, error, login, loginWithFacebookCode, logout, metaConfig, loading: appLoading } = useApp();
  const [usernameInput, setUsernameInput] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [authLoading, setAuthLoading] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);

  const codeProcessed = useRef(false);

  useEffect(() => {
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !codeProcessed.current) {
      codeProcessed.current = true;
      setAuthLoading(true);
      loginWithFacebookCode(code).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthLoading(false);
      });
    }
  }, [loginWithFacebookCode]);

  const handleFacebookLogin = () => {
    if (!metaConfig || !metaConfig.app_id) return;
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    const authUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${metaConfig.app_id}&redirect_uri=${redirectUri}&scope=instagram_manage_comments,pages_show_list,instagram_basic,instagram_manage_messages,pages_read_engagement,business_management`;
    window.location.href = authUrl;
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Checkout redirects removed for free version

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  if (error && !creator) {
    return (
      <div className="login-container">
        <button 
          className="theme-toggle-btn" 
          style={{ position: 'absolute', top: 20, right: 20 }}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="glass-card login-card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              width: 64, height: 64, borderRadius: '50%', 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto' 
            }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
          </div>
          <h2 style={{ marginBottom: 10 }}>Connection Error</h2>
          <p style={{ color: '#9ca3af', marginBottom: 10 }}>{error}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: 20, wordBreak: 'break-all' }}>
            Debug URL: {API_BASE_URL}/auth/facebook-callback
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            <RotateCcw size={16} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (authLoading || appLoading) {
    return (
      <div className="login-container">
        <div className="glass-card login-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 20px', width: 40, height: 40 }}></div>
          <h2>Connecting...</h2>
          <p style={{ color: '#9ca3af' }}>Please wait while we authenticate your account.</p>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="login-container">
        <button 
          className="theme-toggle-btn" 
          style={{ position: 'absolute', top: 20, right: 20 }}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="glass-card login-card">
          <div className="login-header">
            <div className="logo-icon">
              <ShieldAlert size={28} color="#6366f1" />
            </div>
            <h1>InstaModerator</h1>
            <p>Intelligence & Spam Protection Platform</p>
          </div>
          
          <button 
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', marginBottom: 15, background: '#1877F2', border: 'none', padding: '12px 20px' }}
            onClick={handleFacebookLogin}
            disabled={!metaConfig}
          >
            <Globe size={18} style={{ marginRight: 8 }} /> Continue with Facebook
          </button>
          
          <div style={{ textAlign: 'center', margin: '15px 0' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>OR</span>
          </div>

          {!sandboxMode ? (
            <button 
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setSandboxMode(true)}
            >
              Enter Sandbox Testing Mode
            </button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); login(usernameInput); }}>
              <div className="form-group">
                <label>Sandbox Instagram Username</label>
                <div className="input-with-icon">
                  <span className="input-prefix">@</span>
                  <input 
                    type="text" 
                    placeholder="yourname" 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <button type="submit" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
                Connect Sandbox <Sparkles size={16} />
              </button>
            </form>
          )}

          <div className="login-footer">
            <Info size={14} style={{ marginRight: 6 }} />
            <span>Connects to Meta API or Sandbox for safety.</span>
          </div>
        </div>
      </div>
    );
  }

  return <DashboardLayout theme={theme} toggleTheme={toggleTheme} />;
}

// --- MAIN DASHBOARD LAYOUT ---
function DashboardLayout({ theme, toggleTheme }) {
  const { creator, activeTab, setActiveTab, logout, seedMockData } = useApp();
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  return (
    <div className="dashboard-wrapper">
      <aside className="sidebar">
        <div className="sidebar-brand flex-between" style={{ width: '100%' }}>
          <div className="flex-row">
            <ShieldAlert size={24} color="#6366f1" style={{ marginRight: 10 }} />
            <span>InstaMod</span>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="creator-profile-badge">
          <div className="avatar">
            {creator.instagram_username[0].toUpperCase()}
          </div>
          <div className="creator-details">
            <span className="creator-name">@{creator.instagram_username}</span>
            <span className="creator-status">{creator.is_mock ? 'Simulation Active' : 'Live Connected'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <ShieldAlert size={18} /> Overview
          </button>
          <button 
            className={`nav-item ${activeTab === 'commenters' ? 'active' : ''}`}
            onClick={() => setActiveTab('commenters')}
          >
            <Users size={18} /> User Intelligence
          </button>
          <button 
            className={`nav-item ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <Clock size={18} /> Auto-DM Queue
          </button>
          <button 
            className={`nav-item ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <Settings size={18} /> Control Center
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={logout}>
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header">
          <div>
            <h1>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'commenters' && 'Commenter Intelligence'}
              {activeTab === 'queue' && 'Automated DM Queue'}
              {activeTab === 'templates' && 'Control Center & Settings'}
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Monitoring comments for @{creator.instagram_username}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={seedMockData}>
              <RotateCcw size={16} /> Seed Demo Data
            </button>
            <button className="btn-primary" onClick={() => setSimulatorOpen(true)}>
              <Play size={16} /> Open Comment Simulator
            </button>
          </div>
        </header>

        <div className="tab-container">
          {activeTab === 'dashboard' && <OverviewTab />}
          {activeTab === 'commenters' && <CommentersTab />}
          {activeTab === 'queue' && <QueueTab />}
          {activeTab === 'templates' && <TemplatesTab />}
        </div>
      </main>

      {simulatorOpen && <SimulatorPanel onClose={() => setSimulatorOpen(false)} />}
    </div>
  );
}

// --- OVERVIEW DASHBOARD TAB ---
function OverviewTab() {
  const { stats, posts, fetchPostComments } = useApp();
  const [selectedPostId, setSelectedPostId] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    if (posts.length > 0) {
      setSelectedPostId(posts[0].id);
    }
  }, [posts]);

  useEffect(() => {
    if (selectedPostId) {
      loadComments(selectedPostId);
    }
  }, [selectedPostId, stats]);

  const loadComments = async (postId) => {
    setCommentsLoading(true);
    const data = await fetchPostComments(postId);
    setComments(data);
    setCommentsLoading(false);
  };

  const normalCount = stats.total_comments - stats.spam_comments - stats.hate_comments - stats.leads_detected;
  const safeEngagement = Math.max(0, normalCount);

  const total = stats.total_comments || 1;
  const pctNormal = Math.round((safeEngagement / total) * 100);
  const pctLeads = Math.round((stats.leads_detected / total) * 100);
  const pctSpam = Math.round((stats.spam_comments / total) * 100);
  const pctHate = Math.round((stats.hate_comments / total) * 100);

  const postCommentsCount = comments.length;
  const postHateCount = comments.filter(c => c.category === 'Hate Comment').length;
  const postSpamCount = comments.filter(c => ['Flood Spam', 'Duplicate Spam', 'Emoji Spam'].includes(c.category)).length;
  const postLeadCount = comments.filter(c => c.category === 'Lead').length;
  const postNormalCount = comments.filter(c => c.category === 'Normal').length;

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="glass-card stat-card">
          <div className="stat-header">
            <span>Total Comments</span>
            <MessageSquare size={20} color="#6366f1" />
          </div>
          <div className="stat-value">{stats.total_comments}</div>
          <div className="stat-desc">Across reels/posts</div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-header">
            <span>Unique Users</span>
            <Users size={20} color="#a855f7" />
          </div>
          <div className="stat-value">{stats.total_users}</div>
          <div className="stat-desc">Commenters database</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--color-lead)' }}>
          <div className="stat-header">
            <span>Leads Caught</span>
            <DollarSign size={20} color="var(--color-lead)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-lead)' }}>{stats.leads_detected}</div>
          <div className="stat-desc">Potential customers</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--color-spam)' }}>
          <div className="stat-header">
            <span>Spam Blocked</span>
            <AlertTriangle size={20} color="var(--color-spam)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-spam)' }}>{stats.spam_comments}</div>
          <div className="stat-desc">Duplicates & Floods</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--color-hate)' }}>
          <div className="stat-header">
            <span>Hate Moderated</span>
            <ShieldAlert size={20} color="var(--color-hate)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--color-hate)' }}>{stats.hate_comments}</div>
          <div className="stat-desc">Abusive terms filtered</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 25, marginBottom: 25 }}>
        <div className="flex-between" style={{ marginBottom: 15 }}>
          <h2>Audience Engagement & Content Health</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} className="flex-row">
            <TrendingUp size={14} style={{ marginRight: 5 }} color="var(--color-normal)" /> 
            Live distribution analysis
          </span>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', height: 32, borderRadius: 16, overflow: 'hidden', display: 'flex', marginBottom: 20 }}>
          {safeEngagement > 0 && <div style={{ width: `${pctNormal}%`, background: 'var(--color-normal)' }} title="Normal"></div>}
          {stats.leads_detected > 0 && <div style={{ width: `${pctLeads}%`, background: 'var(--color-lead)' }} title="Leads"></div>}
          {stats.spam_comments > 0 && <div style={{ width: `${pctSpam}%`, background: 'var(--color-spam)' }} title="Spam"></div>}
          {stats.hate_comments > 0 && <div style={{ width: `${pctHate}%`, background: 'var(--color-hate)' }} title="Hate"></div>}
          {stats.total_comments === 0 && <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)' }}></div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15 }}>
          <div className="flex-row" style={{ gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-normal)' }}></span>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Normal / Fan ({pctNormal || 0}%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{safeEngagement} comments</div>
            </div>
          </div>
          <div className="flex-row" style={{ gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-lead)' }}></span>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Leads Detected ({pctLeads || 0}%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{stats.leads_detected} queries</div>
            </div>
          </div>
          <div className="flex-row" style={{ gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-spam)' }}></span>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Spam Comments ({pctSpam || 0}%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{stats.spam_comments} flags</div>
            </div>
          </div>
          <div className="flex-row" style={{ gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-hate)' }}></span>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Hate Comments ({pctHate || 0}%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{stats.hate_comments} toxic</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card table-card" style={{ marginBottom: 25 }}>
        <div className="card-header flex-between" style={{ paddingBottom: 15 }}>
          <div className="flex-row" style={{ gap: 10 }}>
            <Sliders size={18} color="var(--color-primary)" />
            <h2>Reel/Post Comment Inspector</h2>
          </div>
          
          <div className="flex-row" style={{ gap: 10 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Reel:</span>
            <select 
              value={selectedPostId} 
              onChange={(e) => setSelectedPostId(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid var(--border-glass)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                outline: 'none',
                minWidth: '240px',
                cursor: 'pointer'
              }}
            >
              {posts.map(p => (
                <option key={p.id} value={p.id}>{p.caption || p.id}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
          padding: '15px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border-glass)',
          borderTop: '1px solid var(--border-glass)',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reel Comments</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>{postCommentsCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Normal / Fan</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-normal)' }}>{postNormalCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Leads</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-lead)' }}>{postLeadCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spam Blocked</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-spam)' }}>{postSpamCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Hate Moderated</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-hate)' }}>{postHateCount}</span>
          </div>
        </div>

        <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Comment Message</th>
                <th>Category</th>
                <th>Posted At</th>
              </tr>
            </thead>
            <tbody>
              {commentsLoading ? (
                <tr>
                  <td colSpan="4" className="empty-row">
                    <div style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner"></div></div>
                  </td>
                </tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-row">No comments posted on this reel yet. Use simulator presets to add some!</td>
                </tr>
              ) : (
                comments.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>@{item.username}</td>
                    <td>"{item.text}"</td>
                    <td>
                      <span className={`badge ${
                        item.category === 'Normal' ? 'badge-normal' : 
                        item.category === 'Lead' ? 'badge-pending' :
                        item.category === 'Hate Comment' ? 'badge-hate' : 
                        'badge-spam'
                      }`} style={item.category === 'Lead' ? { background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-lead)', borderColor: 'rgba(59, 130, 246, 0.3)' } : {}}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-cols-2">
        <div className="glass-card table-card">
          <div className="card-header">
            <h2>Top Flood Spammers</h2>
            <span className="badge badge-spam">Spam Behavior</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Spam Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_flood_spammers.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="empty-row">No spam detected yet.</td>
                  </tr>
                ) : (
                  stats.top_flood_spammers.map((spammer, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>@{spammer.username}</td>
                      <td>
                        <span style={{ color: 'var(--color-spam)', fontWeight: 600 }}>
                          {spammer.spam_count} comments
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card table-card">
          <div className="card-header">
            <h2>Top Hate Commenters</h2>
            <span className="badge badge-hate">Toxic Behavior</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Hate Comments</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_hate_commenters.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="empty-row">No toxic comments detected yet.</td>
                  </tr>
                ) : (
                  stats.top_hate_commenters.map((hater, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>@{hater.username}</td>
                      <td>
                        <span style={{ color: 'var(--color-hate)', fontWeight: 600 }}>
                          {hater.hate_count} flagged
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentersTab() {
  const { commenters, loyalFans } = useApp();
  const [subTab, setSubTab] = useState('all'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const filteredCommenters = commenters.filter(c => 
    c.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLoyalFans = loyalFans.filter(f =>
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const viewUserHistory = async (username) => {
    setSelectedUser(username);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/commenter/${username}/history`);

      const data = await res.json();
      setUserHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score < 30) return 'var(--color-normal)';
    if (score < 65) return 'var(--color-spam)';
    return 'var(--color-hate)';
  };

  return (
    <div style={{ display: 'flex', gap: 20, position: 'relative' }}>
      <div className="glass-card table-card" style={{ flex: 1 }}>
        <div className="card-header flex-between" style={{ padding: 15, borderBottom: 'none' }}>
          <div className="flex-row" style={{ gap: 10 }}>
            <button 
              className={`btn-secondary ${subTab === 'all' ? 'active-sub-tab' : ''}`}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              onClick={() => { setSubTab('all'); setSearchTerm(''); }}
            >
              <Users size={14} style={{ marginRight: 4 }} /> All Commenters
            </button>
            <button 
              className={`btn-secondary ${subTab === 'loyal' ? 'active-sub-tab' : ''}`}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              onClick={() => { setSubTab('loyal'); setSearchTerm(''); }}
            >
              <Award size={14} style={{ marginRight: 4 }} color="#d4af37" /> Loyal Fans (Weekly/Monthly)
            </button>
          </div>
          
          <div className="search-box">
            <Search size={16} color="#6b7280" />
            <input 
              type="text" 
              placeholder="Search commenter..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {subTab === 'all' ? (
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Total Comments</th>
                  <th>Spam Flags</th>
                  <th>Hate Flags</th>
                  <th>Risk Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommenters.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-row">No commenters found.</td>
                  </tr>
                ) : (
                  filteredCommenters.map((c) => (
                    <tr key={c.username}>
                      <td style={{ fontWeight: 600 }}>@{c.username}</td>
                      <td>{c.total_comments}</td>
                      <td>
                        <span style={{ color: c.flood_spam_count + c.duplicate_spam_count > 0 ? 'var(--color-spam)' : '#9ca3af' }}>
                          {c.flood_spam_count + c.duplicate_spam_count + c.emoji_spam_count}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: c.hate_comment_count > 0 ? 'var(--color-hate)' : '#9ca3af', fontWeight: c.hate_comment_count > 0 ? '600' : 'normal' }}>
                          {c.hate_comment_count}
                        </span>
                      </td>
                      <td>
                        <div className="flex-row">
                          <span 
                            className="risk-dot" 
                            style={{ backgroundColor: getRiskColor(c.risk_score) }}
                          ></span>
                          <span style={{ fontWeight: 600, color: getRiskColor(c.risk_score) }}>
                            {c.risk_score}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => viewUserHistory(c.username)}>
                          <Eye size={12} style={{ marginRight: 4 }} /> View History
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Total Comments</th>
                  <th>Active Weeks</th>
                  <th>Active Months</th>
                  <th>Loyalty Tier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoyalFans.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-row">No loyal fans found. Simulate comments over time or seed data!</td>
                  </tr>
                ) : (
                  filteredLoyalFans.map((fan) => (
                    <tr key={fan.username}>
                      <td style={{ fontWeight: 600 }}>@{fan.username}</td>
                      <td>{fan.total_comments}</td>
                      <td>{fan.active_weeks} weeks active</td>
                      <td>{fan.active_months} months active</td>
                      <td>
                        <span className="badge" style={
                          fan.loyalty_tier.includes("Gold") ? { background: 'rgba(218, 165, 32, 0.15)', color: '#d4af37', border: '1px solid rgba(218, 165, 32, 0.3)' } :
                          fan.loyalty_tier.includes("Silver") ? { background: 'rgba(192, 192, 192, 0.15)', color: '#c0c0c0', border: '1px solid rgba(192, 192, 192, 0.3)' } :
                          { background: 'rgba(205, 127, 50, 0.15)', color: '#cd7f32', border: '1px solid rgba(205, 127, 50, 0.3)' }
                        }>
                          {fan.loyalty_tier.split(" (")[0]}
                        </span>
                      </td>
                      <td>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => viewUserHistory(fan.username)}>
                          <Eye size={12} style={{ marginRight: 4 }} /> View History
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="glass-card history-drawer" style={{ width: '450px' }}>
          <div className="card-header flex-between" style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem' }}>@{selectedUser} History</h2>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Behavior Timeline</p>
            </div>
            <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setSelectedUser(null)}>Close</button>
          </div>

          <div className="history-content" style={{ padding: 15, maxHeight: '530px', overflowY: 'auto' }}>
            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
                <div className="spinner"></div>
              </div>
            ) : userHistory.length === 0 ? (
              <p className="empty-row">No comments recorded.</p>
            ) : (
              <div className="history-timeline">
                {userHistory.map((item, idx) => (
                  <div className="timeline-item" key={idx}>
                    <div className="timeline-meta flex-between">
                      <span className="timeline-post">Post: {item.media_id}</span>
                      <span className={`badge ${
                        item.category === 'Normal' ? 'badge-normal' : 
                        item.category === 'Lead' ? 'badge-pending' :
                        item.category === 'Hate Comment' ? 'badge-hate' : 
                        'badge-spam'
                      }`} style={item.category === 'Lead' ? { background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-lead)', borderColor: 'rgba(59, 130, 246, 0.3)' } : {}}>
                        {item.category}
                      </span>
                    </div>
                    <div className="timeline-bubble">
                      <p className="timeline-text">"{item.text}"</p>
                      <span className="timeline-time">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QueueTab() {
  const { queue } = useApp();

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="badge badge-pending">PENDING</span>;
      case 'SENT': return <span className="badge badge-normal">SENT</span>;
      default: return <span className="badge badge-hate">FAILED</span>;
    }
  };

  return (
    <div className="glass-card table-card">
      <div className="card-header">
        <h2>DM Response Queue</h2>
        <span className="badge badge-pending">Worker Active</span>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Message Text</th>
              <th>Status</th>
              <th>Scheduled For</th>
              <th>Processed At</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-row">Queue is empty. Simulate comments to trigger messages!</td>
              </tr>
            ) : (
              queue.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>@{item.recipient_username}</td>
                  <td style={{ fontSize: '0.875rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.message_text}
                  </td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    {new Date(item.scheduled_for).toLocaleTimeString()}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    {item.sent_at ? new Date(item.sent_at).toLocaleTimeString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const { creator, updateTemplates, updateLeadTemplates, updateLeadKeywords, toggleCreatorMode } = useApp();
  const [normalTemplates, setNormalTemplates] = useState([]);
  const [leadTemplates, setLeadTemplates] = useState([]);
  const [newNormal, setNewNormal] = useState('');
  const [newLead, setNewLead] = useState('');
  const [keywords, setKeywords] = useState('');

  const [appId, setAppId] = useState('');
  const [pageToken, setPageToken] = useState('');
  const [pageId, setPageId] = useState('');

  useEffect(() => {
    if (creator) {
      setKeywords(creator.lead_keywords || '');
      try {
        setNormalTemplates(JSON.parse(creator.dm_templates) || []);
      } catch (e) { setNormalTemplates([]); }
      try {
        setLeadTemplates(JSON.parse(creator.lead_dm_templates) || []);
      } catch (e) { setLeadTemplates([]); }
    }
  }, [creator]);

  const addNormal = () => {
    if (!newNormal.trim()) return;
    const updated = [...normalTemplates, newNormal.trim()];
    setNormalTemplates(updated);
    updateTemplates(updated);
    setNewNormal('');
  };

  const removeNormal = (idx) => {
    const updated = normalTemplates.filter((_, i) => i !== idx);
    setNormalTemplates(updated);
    updateTemplates(updated);
  };

  const addLead = () => {
    if (!newLead.trim()) return;
    const updated = [...leadTemplates, newLead.trim()];
    setLeadTemplates(updated);
    updateLeadTemplates(updated);
    setNewLead('');
  };

  const removeLead = (idx) => {
    const updated = leadTemplates.filter((_, i) => i !== idx);
    setLeadTemplates(updated);
    updateLeadTemplates(updated);
  };

  const saveKeywords = () => {
    updateLeadKeywords(keywords);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '850px', margin: '0 auto' }}>
      
      <div className="glass-card" style={{ padding: 25 }}>
        <div className="flex-between" style={{ marginBottom: 15 }}>
          <div>
            <h2>Platform Connection Mode</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Switch between simulator sandboxing and live Instagram integration.</p>
          </div>
          <div className="flex-row" style={{ gap: 10 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: creator.is_mock ? 'var(--color-spam)' : 'var(--color-normal)' }}>
              {creator.is_mock ? 'Simulator Active' : 'Live Connected'}
            </span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={!creator.is_mock} 
                onChange={(e) => toggleCreatorMode(!e.target.checked)} 
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {!creator.is_mock ? (
          <div className="live-credentials-form" style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-glass)', paddingTop: 15 }}>
            {creator.fb_page_id || creator.ig_user_id ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-sm)', padding: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-normal)', fontWeight: 600 }}>
                  <CheckCircle size={18} />
                  Successfully Connected to Meta
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: '0.85rem', color: '#d1d5db' }}>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Facebook Page ID</span>
                    {creator.fb_page_id || 'Not Set'}
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Instagram Account ID</span>
                    {creator.ig_user_id || 'Not Set'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 15 }}>
                <p style={{ color: '#d1d5db', fontSize: '0.9rem', textAlign: 'center' }}>
                  To enable live Instagram integration, you must connect your Meta account.
                </p>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleFacebookLogin}
                  style={{ background: '#1877F2', borderColor: '#1877F2', fontSize: '0.95rem', padding: '10px 20px' }}
                >
                  <Globe size={18} /> Connect with Facebook
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-sm)', padding: 12, display: 'flex', gap: 10, fontSize: '0.82rem', color: 'var(--color-spam)' }}>
            <Info size={18} style={{ flexShrink: 0 }} />
            <span>Currently running in **Simulator Mode**. The system simulates Instagram Comments webhook notifications. Toggle to Live Mode to configure real Meta tokens.</span>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: 25 }}>
        <h2>Lead Keyword Settings</h2>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 15 }}>
          Specify keywords that indicate a buying intent. If a comment contains any of these words (e.g. price, cost, link), the system classifies it as a **"Lead"** and triggers lead-specific auto-replies.
        </p>
        <div className="flex-row" style={{ gap: 15 }}>
          <input 
            type="text" 
            placeholder="price,buy,link,dm,details..." 
            value={keywords} 
            onChange={(e) => setKeywords(e.target.value)}
            style={{ 
              flex: 1, 
              padding: '10px 15px', 
              background: 'rgba(0,0,0,0.25)', 
              border: '1px solid var(--border-glass)', 
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              fontFamily: 'var(--font-sans)',
              outline: 'none'
            }}
          />
          <button className="btn-secondary" onClick={saveKeywords}>
            Save Lead Keywords
          </button>
        </div>
      </div>

      <div className="grid-cols-2">
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 5 }}>Standard DM Replies</h3>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 15 }}>Rotated randomly for normal comments.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 15, maxHeight: '200px', overflowY: 'auto' }}>
            {normalTemplates.map((tpl, idx) => (
              <div className="template-item flex-between" key={idx} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>{tpl}</span>
                <button onClick={() => removeNormal(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <Trash2 size={12} color="var(--color-hate)" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex-row" style={{ gap: 6 }}>
            <input 
              type="text" 
              placeholder="Hi {username}...!" 
              value={newNormal} 
              onChange={(e) => setNewNormal(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'white', fontSize: '0.82rem', outline: 'none' }}
            />
            <button className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.8rem' }} onClick={addNormal}>
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 5, color: 'var(--color-lead)' }}>Lead-Specific DM Replies</h3>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 15 }}>Sent when comment is classified as a Lead.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 15, maxHeight: '200px', overflowY: 'auto' }}>
            {leadTemplates.map((tpl, idx) => (
              <div className="template-item flex-between" key={idx} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>{tpl}</span>
                <button onClick={() => removeLead(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <Trash2 size={12} color="var(--color-hate)" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex-row" style={{ gap: 6 }}>
            <input 
              type="text" 
              placeholder="Pricing for {username}...!" 
              value={newLead} 
              onChange={(e) => setNewLead(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'white', fontSize: '0.82rem', outline: 'none' }}
            />
            <button className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.8rem' }} onClick={addLead}>
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulatorPanel({ onClose }) {
  const { posts, triggerMockComment } = useApp();
  const [mediaId, setMediaId] = useState('');
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (posts.length > 0) {
      setMediaId(posts[0].id);
    }
  }, [posts]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!mediaId || !username || !text) return;
    setSubmitting(true);
    const success = await triggerMockComment(mediaId, username, text);
    if (success) {
      setText('');
    }
    setSubmitting(false);
  };

  const triggerPreset = async (type) => {
    setSubmitting(true);
    let mockUser = '';
    let mockText = '';

    switch (type) {
      case 'lead':
        mockUser = 'buyer_rahul';
        mockText = 'Price please? DM details';
        break;
      case 'flood':
        mockUser = 'bot_flood_spam';
        for (let i = 0; i < 4; i++) {
          const texts = ["Awesome video!", "Nice reels!", "Loved it 🔥", "Cool!"];
          await triggerMockComment(mediaId, mockUser, texts[i]);
          await new Promise(r => setTimeout(r, 800));
        }
        setSubmitting(false);
        return;
      case 'duplicate':
        mockUser = 'promo_builder';
        mockText = 'Check out my profile for free gift vouchers! 🎁🔥';
        await triggerMockComment(mediaId, mockUser, mockText);
        await new Promise(r => setTimeout(r, 1000));
        await triggerMockComment(mediaId, mockUser, mockText);
        setSubmitting(false);
        return;
      case 'hate':
        mockUser = 'troll_hater_12';
        mockText = 'worst video ever, bad chutiya content useless idiot creator';
        break;
      case 'emoji':
        mockUser = 'emoji_queen';
        mockText = '😂😂😂😂😂😂😂😂😂😂😂😂🔥🔥🔥🔥';
        break;
      case 'fan':
        mockUser = 'loyal_supporter';
        mockText = 'Incredible content as always! Keep rocking bro! ❤️🚀';
        break;
    }

    if (mockUser && mockText) {
      await triggerMockComment(mediaId, mockUser, mockText);
    }
    setSubmitting(false);
  };

  return (
    <div className="glass-card simulator-drawer">
      <div className="card-header flex-between" style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <div className="flex-row">
          <Play size={18} color="var(--color-normal)" style={{ marginRight: 8 }} />
          <h2 style={{ fontSize: '1.1rem' }}>Instagram Comment Simulator</h2>
        </div>
        <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={onClose}>Close</button>
      </div>

      <div style={{ padding: 15 }}>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 15 }}>
          Test the system behavior by writing a custom comment or triggering one of the spam/hate simulation presets below.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div className="form-group-sim">
            <label>Target Media Post</label>
            <select value={mediaId} onChange={(e) => setMediaId(e.target.value)} required>
              {posts.map(p => (
                <option key={p.id} value={p.id}>{p.caption?.substring(0, 30)}...</option>
              ))}
            </select>
          </div>

          <div className="form-group-sim">
            <label>Commenter Username</label>
            <input 
              type="text" 
              placeholder="e.g. user_raj" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group-sim">
            <label>Comment Text</label>
            <textarea 
              rows="2"
              placeholder="Type comment message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            ></textarea>
          </div>

          <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }} disabled={submitting}>
            {submitting ? 'Processing...' : 'Send Custom Comment'} <Send size={14} />
          </button>
        </form>

        <h3 style={{ fontSize: '0.9rem', marginBottom: 10, color: '#f3f4f6' }}>Simulate Presets</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn-preset flex-row" onClick={() => triggerPreset('fan')} disabled={submitting}>
            <span>😍 Loyal Fan Comment</span>
          </button>
          <button className="btn-preset flex-row" onClick={() => triggerPreset('lead')} disabled={submitting}>
            <span>💰 Potential Lead</span>
          </button>
          <button className="btn-preset flex-row" onClick={() => triggerPreset('flood')} disabled={submitting}>
            <span>🤖 Flood Spam Attack</span>
          </button>
          <button className="btn-preset flex-row" onClick={() => triggerPreset('duplicate')} disabled={submitting}>
            <span>🔄 Duplicate Spammer</span>
          </button>
          <button className="btn-preset flex-row" onClick={() => triggerPreset('emoji')} disabled={submitting}>
            <span>🥳 Emoji Spam</span>
          </button>
          <button className="btn-preset flex-row" onClick={() => triggerPreset('hate')} disabled={submitting}>
            <span>🤬 Hate / Toxic User</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
