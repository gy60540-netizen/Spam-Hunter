import React, { createContext, useState, useEffect, useContext } from 'react';

const AppContext = createContext();

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';


export const AppProvider = ({ children }) => {
  const [creator, setCreator] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({
    total_comments: 0,
    total_users: 0,
    spam_comments: 0,
    hate_comments: 0,
    leads_detected: 0,
    top_flood_spammers: [],
    top_hate_commenters: []
  });
  const [commenters, setCommenters] = useState([]);
  const [loyalFans, setLoyalFans] = useState([]);
  const [queue, setQueue] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, commenters, queue, templates
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metaConfig, setMetaConfig] = useState(null);

  // Auto-login from localStorage on mount and sync with API
  useEffect(() => {
    // Fetch Meta configuration
    fetch(`${API_BASE_URL}/auth/config`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) setMetaConfig(data);
      })
      .catch(err => console.error("Failed to fetch meta config:", err));

    const savedCreator = localStorage.getItem('instagram_creator');
    if (savedCreator) {
      try {
        const parsed = JSON.parse(savedCreator);
        setCreator(parsed);
        // Sync fresh profile details (e.g. subscription status)
        fetch(`${API_BASE_URL}/creators/${parsed.id}`)
          .then(res => {
            if (res.ok) return res.json();
            throw new Error();
          })
          .then(data => {
            setCreator(data);
            localStorage.setItem('instagram_creator', JSON.stringify(data));
          })
          .catch(() => {
            // Fallback: keep localStorage version if backend is offline
          });
      } catch (e) {
        localStorage.removeItem('instagram_creator');
      }
    }
  }, []);

  // Fetch data whenever creator changes
  useEffect(() => {
    if (creator) {
      fetchDashboardData();

      // Fast auto-polling every 3 seconds for instant real-time UI updates
      const interval = setInterval(() => {
        fetchStats();
        fetchQueue();
      }, 3000);

      return () => clearInterval(interval);
    } else {
      setPosts([]);
      setCommenters([]);
      setLoyalFans([]);
      setQueue([]);
    }
  }, [creator]);

  const fetchDashboardData = async () => {
    if (!creator) return;
    setLoading(true);
    try {
      // Sync real Instagram data first if it's a live connection
      if (!creator.is_mock) {
        try {
          await fetch(`${API_BASE_URL}/creators/${creator.id}/sync`, {
            method: 'POST'
          });
        } catch (syncErr) {
          console.error("Instagram synchronization failed:", syncErr);
        }
      }

      await Promise.all([
        fetchPosts(),
        fetchStats(),
        fetchCommenters(),
        fetchLoyalFans(),
        fetchQueue()
      ]);
      setError('');
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError('Failed to connect to backend server. Make sure FastAPI is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${creator.id}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (e) {
      console.warn('fetchPosts note:', e);
    }
  };

  const fetchStats = async () => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/${creator.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn('fetchStats note:', e);
    }
  };

  const fetchCommenters = async () => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/commenters/${creator.id}`);
      if (res.ok) {
        const data = await res.json();
        setCommenters(data);
      }
    } catch (e) {
      console.warn('fetchCommenters note:', e);
    }
  };

  const fetchLoyalFans = async () => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/loyalty/${creator.id}`);
      if (res.ok) {
        const data = await res.json();
        setLoyalFans(data);
      }
    } catch (e) {
      console.warn('fetchLoyalFans note:', e);
    }
  };

  const fetchQueue = async () => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/queue/${creator.id}`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (e) {
      console.warn('fetchQueue note:', e);
    }
  };

  const fetchPostComments = async (mediaId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${mediaId}/comments`);
      if (!res.ok) throw new Error('Failed to fetch post comments');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const login = async (username) => {
    const cleanUser = (username && username.trim()) ? username.trim().replace(/^@/, '') : 'pro_creator';
    const fallbackCreator = {
      id: 1,
      instagram_username: cleanUser,
      is_mock: true,
      subscription_status: 'pro_active'
    };
    setCreator(fallbackCreator);
    localStorage.setItem('instagram_creator', JSON.stringify(fallbackCreator));
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login?username=${encodeURIComponent(cleanUser)}`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setCreator(data);
        localStorage.setItem('instagram_creator', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Backend login fallback active:', err);
    }
    return true;
  };

  const loginWithFacebookCode = async (code) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/facebook-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Facebook login failed');
      }
      const data = await res.json();
      setCreator(data);
      localStorage.setItem('instagram_creator', JSON.stringify(data));
      setError('');
      return true;
    } catch (err) {
      console.error("Facebook Login Error:", err);
      setError(`Login Failed: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCreator(null);
    localStorage.removeItem('instagram_creator');
    setActiveTab('dashboard');
  };

  const updateTemplates = async (templatesList) => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/creators/${creator.id}/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dm_templates: templatesList })
      });
      if (!res.ok) throw new Error('Update templates failed');
      const updatedCreator = await res.json();
      setCreator(updatedCreator);
      localStorage.setItem('instagram_creator', JSON.stringify(updatedCreator));
      return true;
    } catch (err) {
      console.error(err);
      setError('Failed to update DM templates.');
      return false;
    }
  };

  const updateLeadTemplates = async (templatesList) => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/creators/${creator.id}/lead-templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dm_templates: templatesList })
      });
      if (!res.ok) throw new Error('Update lead templates failed');
      const updatedCreator = await res.json();
      setCreator(updatedCreator);
      localStorage.setItem('instagram_creator', JSON.stringify(updatedCreator));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const updateLeadKeywords = async (keywordsString) => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/creators/${creator.id}/lead-keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_keywords: keywordsString })
      });
      if (!res.ok) throw new Error('Update lead keywords failed');
      const updatedCreator = await res.json();
      setCreator(updatedCreator);
      localStorage.setItem('instagram_creator', JSON.stringify(updatedCreator));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const toggleCreatorMode = async (isMockValue) => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE_URL}/creators/${creator.id}/toggle-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_mock: isMockValue })
      });
      if (!res.ok) throw new Error('Toggle mode failed');
      const updatedCreator = await res.json();
      setCreator(updatedCreator);
      localStorage.setItem('instagram_creator', JSON.stringify(updatedCreator));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const triggerMockComment = async (mediaId, username, text) => {
    try {
      const res = await fetch(`${API_BASE_URL}/simulator/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_id: mediaId,
          username: username,
          text: text
        })
      });
      if (!res.ok) throw new Error('Failed to post comment');
      
      // Refresh all statistics, loyal list and queues
      await fetchStats();
      await fetchCommenters();
      await fetchLoyalFans();
      await fetchQueue();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const seedMockData = async () => {
    if (!creator) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/simulator/seed/${creator.id}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Seeding failed');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      setError('Failed to seed mock data.');
    } finally {
      setLoading(false);
    }
  };

  const clearDemoData = async () => {
    if (!creator) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/simulator/clear/${creator.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Clear failed');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      setError('Failed to clear demo data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContext.Provider value={{
      creator,
      posts,
      stats,
      commenters,
      loyalFans,
      queue,
      activeTab,
      setActiveTab,
      loading,
      error,
      metaConfig,
      login,
      loginWithFacebookCode,
      logout,
      updateTemplates,
      updateLeadTemplates,
      updateLeadKeywords,
      toggleCreatorMode,
      triggerMockComment,
      seedMockData,
      clearDemoData,
      fetchPostComments,  // Expose helper
      refreshData: fetchDashboardData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
