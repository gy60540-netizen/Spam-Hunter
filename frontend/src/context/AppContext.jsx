import React, { createContext, useState, useEffect, useContext } from 'react';

const AppContext = createContext();

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';


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

  // Auto-login from localStorage on mount and sync with API
  useEffect(() => {
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
    const res = await fetch(`${API_BASE_URL}/posts/${creator.id}`);
    const data = await res.json();
    setPosts(data);
  };

  const fetchStats = async () => {
    const res = await fetch(`${API_BASE_URL}/analytics/${creator.id}`);
    const data = await res.json();
    setStats(data);
  };

  const fetchCommenters = async () => {
    const res = await fetch(`${API_BASE_URL}/commenters/${creator.id}`);
    const data = await res.json();
    setCommenters(data);
  };

  const fetchLoyalFans = async () => {
    const res = await fetch(`${API_BASE_URL}/loyalty/${creator.id}`);
    const data = await res.json();
    setLoyalFans(data);
  };

  const fetchQueue = async () => {
    const res = await fetch(`${API_BASE_URL}/queue/${creator.id}`);
    const data = await res.json();
    setQueue(data);
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
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login?username=${encodeURIComponent(username)}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Login failed');
      const data = await res.json();
      setCreator(data);
      localStorage.setItem('instagram_creator', JSON.stringify(data));
      setError('');
      return true;
    } catch (err) {
      setError('Server connection error. Please start backend first.');
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
      login,
      logout,
      updateTemplates,
      updateLeadTemplates,
      updateLeadKeywords,
      toggleCreatorMode,
      triggerMockComment,
      seedMockData,
      fetchPostComments,  // Expose helper
      refreshData: fetchDashboardData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
