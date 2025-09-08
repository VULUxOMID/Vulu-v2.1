import { useState, useEffect } from 'react';

export interface StreamMetrics {
  totalViews: number;
  totalMessages: number;
  averageViewTime: number;
  peakViewers: number;
  totalRevenue: number;
}

export interface ChartData {
  label: string;
  value: number;
}

export interface TopListItem {
  id: string;
  name: string;
  value: number;
  subtitle?: string;
}

export interface StreamAnalyticsData {
  metrics: StreamMetrics;
  viewerData: ChartData[];
  messageData: ChartData[];
  topViewers: TopListItem[];
  topChatters: TopListItem[];
}

export const useStreamAnalytics = () => {
  const [data, setData] = useState<StreamAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual analytics service calls
      const mockData: StreamAnalyticsData = {
        metrics: {
          totalViews: 1250,
          totalMessages: 3840,
          averageViewTime: 8.5,
          peakViewers: 89,
          totalRevenue: 127.50,
        },
        viewerData: [
          { label: '00:00', value: 12 },
          { label: '01:00', value: 25 },
          { label: '02:00', value: 45 },
          { label: '03:00', value: 67 },
          { label: '04:00', value: 89 },
          { label: '05:00', value: 76 },
          { label: '06:00', value: 54 },
          { label: '07:00', value: 32 },
        ],
        messageData: [
          { label: 'Mon', value: 120 },
          { label: 'Tue', value: 180 },
          { label: 'Wed', value: 240 },
          { label: 'Thu', value: 190 },
          { label: 'Fri', value: 280 },
          { label: 'Sat', value: 340 },
          { label: 'Sun', value: 220 },
        ],
        topViewers: [
          { id: '1', name: 'User123', value: 45, subtitle: '2.5 hours watched' },
          { id: '2', name: 'StreamFan', value: 38, subtitle: '2.1 hours watched' },
          { id: '3', name: 'RegularViewer', value: 32, subtitle: '1.8 hours watched' },
        ],
        topChatters: [
          { id: '1', name: 'ChatMaster', value: 156, subtitle: '156 messages' },
          { id: '2', name: 'TalkativeUser', value: 89, subtitle: '89 messages' },
          { id: '3', name: 'ActiveChatter', value: 67, subtitle: '67 messages' },
        ],
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setData(mockData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const refresh = async () => {
    await fetchAnalytics();
  };

  return {
    data,
    loading,
    error,
    refresh,
  };
};