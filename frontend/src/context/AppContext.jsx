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
  const [isWakingUp, setIsWakingUp] = useState(false);

  const fetchPosts = async () => {
    if (!creator) return;
    console.log("[AppContext] fetchPosts called for", creator.instagram_username);
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
    console.log("[AppContext] fetchStats called for", creator.instagram_username);
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
    console.log("[AppContext] fetchCommenters called for", creator.instagram_username);
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
    console.log("[AppContext] fetchLoyalFans called for", creator.instagram_username);
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
    console.log("[AppContext] fetchQueue called for", creator.instagram_username);
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
    console.log("[AppContext] fetchPostComments called for", mediaId);
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${mediaId}/comments`);
      if (!res.ok) throw new Error('Failed to fetch post comments');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const fetchDashboardData = async () => {
    if (!creator || loading) return;
    console.log("[AppContext] fetchDashboardData starting for", creator.instagram_username);
    setTimeout(() => setLoading(true), 0);
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
      setTimeout(() => setLoading(false), 0);
    }
  };

  // Auto-login from localStorage on mount and sync with API
  useEffect(() => {
    console.log("[AppContext] Mount useEffect running");
    
    // Set up AbortController for a 12 second timeout
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => {
      console.log("[AppContext] /auth/config request timed out, checking wakeup state");
      controller.abort();
    }, 12000);

    // Detect if server is sleeping (taking longer than 2.5 seconds to reply)
    const wakeupTimer = setTimeout(() => {
      console.log("[AppContext] Backend cold-start detected. Setting isWakingUp to true.");
      setIsWakingUp(true);
    }, 2500);

    fetch(`${API_BASE_URL}/auth/config`, { signal: controller.signal })
      .then(res => {
        clearTimeout(abortTimeout);
        clearTimeout(wakeupTimer);
        setIsWakingUp(false);
        if (res.ok) return res.json();
        throw new Error(`Server responded with status ${res.status}`);
      })
      .then(data => {
        if (data) setMetaConfig(data);
      })
      .catch(err => {
        clearTimeout(abortTimeout);
        clearTimeout(wakeupTimer);
        setIsWakingUp(false);
        console.error("Failed to fetch meta config:", err);
      });

    const savedCreator = localStorage.getItem('instagram_creator');
    if (savedCreator) {
      try {
        const parsed = JSON.parse(savedCreator);
        console.log("[AppContext] Found saved creator in localStorage:", parsed);
        setTimeout(() => setCreator(parsed), 0);
        // Sync fresh profile details (e.g. subscription status) with timeout
        const syncController = new AbortController();
        const syncTimeout = setTimeout(() => syncController.abort(), 12000);
        fetch(`${API_BASE_URL}/creators/${parsed.id}`, { signal: syncController.signal })
          .then(res => {
            clearTimeout(syncTimeout);
            if (res.ok) return res.json();
            throw new Error();
          })
          .then(data => {
            console.log("[AppContext] Fresh creator sync success:", data);
            setCreator(data);
            localStorage.setItem('instagram_creator', JSON.stringify(data));
          })
          .catch(() => {
            clearTimeout(syncTimeout);
            console.log("[AppContext] Fresh creator sync failed, keeping local version");
          });
      } catch (e) {
        localStorage.removeItem('instagram_creator');
      }
    }
  }, []);

  // Fetch data whenever creator changes
  useEffect(() => {
    console.log("[AppContext] creator useEffect running, creator is:", creator);
    if (creator) {
      fetchDashboardData();

      // Safe recursive setTimeout polling to prevent overlapping concurrent calls
      let active = true;
      let timerId = null;

      const poll = async () => {
        if (!active) return;
        try {
          await Promise.all([
            fetchStats(),
            fetchQueue()
          ]);
        } catch (e) {
          console.warn("Polling error:", e);
        }
        if (active) {
          timerId = setTimeout(poll, 5000);
        }
      };

      timerId = setTimeout(poll, 5000);

      return () => {
        active = false;
        clearTimeout(timerId);
      };
    } else {
      setTimeout(() => {
        setPosts([]);
        setCommenters([]);
        setLoyalFans([]);
        setQueue([]);
      }, 0);
    }
  }, [creator]);

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
      isWakingUp,
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
