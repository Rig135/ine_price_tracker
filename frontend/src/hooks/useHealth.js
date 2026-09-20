import { useState, useEffect } from 'react';
import { api } from '../api/client';

export function useHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkHealth = async () => {
    try {
      setLoading(true);
      const data = await api.getHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend');
      setHealth({ status: 'offline' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return { health, loading, error, refetch: checkHealth };
}
