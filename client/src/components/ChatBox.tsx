import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, AlertCircle, Table as TableIcon, BarChart3, Maximize2, Minimize2, History, Plus, Trash2, PieChart as PieChartIcon, TrendingUp, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { useChatEdit } from '@/contexts/ChatEditContext';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'error' | 'table-selection';
  content: string;
  sql?: string;
  data?: any[];
  columns?: string[];
  rowCount?: number;
  chartType?: string;
  availableTables?: any[];
  sessionId?: string;
}

interface Config {
  connectionName: string;
  layer: string;
}

export default function ChatBox() {
  const { toast } = useToast();
  const { editChart, setEditChart } = useChatEdit();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [selectedLayer, setSelectedLayer] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [selectedTableOverride, setSelectedTableOverride] = useState<string[]>([]);
  const [lastUserQuery, setLastUserQuery] = useState<string>('');
  const [pendingTableSelection, setPendingTableSelection] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editingChart, setEditingChart] = useState<any | null>(null);
  const [loadedSessionIds, setLoadedSessionIds] = useState<string[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastInitializedRef = useRef<string>('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // Fetch configs for dropdown
  const { data: configs = [] } = useQuery<Config[]>({
    queryKey: ['/api/config'],
    enabled: isOpen
  });

  // Get unique layers for selected connection
  const availableLayers = selectedConnection
    ? Array.from(new Set(configs.filter(c => c.connectionName === selectedConnection).map(c => c.layer)))
    : [];

  // Fetch all chat sessions (not filtered - show entire history)
  const { data: chatSessions = [], refetch: refetchSessions } = useQuery<any[]>({
    queryKey: ['/api/chat/sessions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/chat/sessions');
      return await response.json();
    },
    enabled: isOpen,
    staleTime: 1000,
  });

  // Create new chat session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/chat/sessions', {
        connectionName: selectedConnection,
        layer: selectedLayer,
      });
      return await response.json();
    },
    onSuccess: async (data: any) => {
      setCurrentSessionId(data.sessionId);
      // Refetch sessions to update the history list
      await refetchSessions();
    },
  });

  // Save chat message
  const saveMessageMutation = useMutation({
    mutationFn: async (message: {
      sessionId: string;
      messageType: string;
      content: string;
      sql?: string;
      data?: any;
      columns?: string[];
      rowCount?: number;
      chartType?: string;
    }) => {
      const response = await apiRequest('POST', '/api/chat/messages', message);
      return await response.json();
    },
  });

  // Delete chat session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('DELETE', `/api/chat/sessions/${sessionId}`);
      return await response.json();
    },
    onSuccess: () => {
      refetchSessions();
      // If deleted current session, start a new one
      if (currentSessionId && !chatSessions.some((s: any) => s.sessionId === currentSessionId)) {
        handleNewChat();
      }
    },
  });

  // Pin chart to dashboard
  const pinChartMutation = useMutation({
    mutationFn: async (message: Message) => {
      // Fetch existing charts to calculate next available position
      const existingChartsResponse = await apiRequest('GET', '/api/saved-charts');
      const existingCharts = await existingChartsResponse.json();
      
      // Check for duplicate chart (same SQL)
      const isDuplicate = existingCharts.some((chart: any) => 
        chart.sql.trim().toLowerCase() === (message.sql || '').trim().toLowerCase()
      );
      
      if (isDuplicate) {
        throw new Error('This chart is already pinned to your dashboard');
      }
      
      // Calculate next available position (3-column grid layout: columns at x=0, x=4, x=8)
      let gridX = 0;
      let gridY = 0;
      
      if (existingCharts.length > 0) {
        const totalCharts = existingCharts.length;
        const column = totalCharts % 3; // 0, 1, or 2
        const row = Math.floor(totalCharts / 3);
        
        gridX = column * 4; // 0, 4, or 8 (3 columns in a 12-unit grid)
        gridY = row * 4; // Each chart is 4 units tall
      }
      
      const response = await apiRequest('POST', '/api/saved-charts', {
        title: `${message.chartType || 'Table'} - ${new Date().toLocaleDateString()}`,
        sql: message.sql || '',
        chartType: message.chartType || 'table',
        chartData: JSON.stringify(message.data),
        columns: JSON.stringify(message.columns),
        connectionName: selectedConnection,
        layer: selectedLayer,
        gridX,
        gridY,
        gridW: 4, // Width of 4 for 3-column layout (12/3 = 4)
        gridH: 4,
      });
      return await response.json();
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure immediate update
      await queryClient.invalidateQueries({ queryKey: ['/api/saved-charts'] });
      await queryClient.refetchQueries({ queryKey: ['/api/saved-charts'] });
      toast({
        title: "✅ Chart Pinned Successfully!",
        description: "Your chart has been added to the Custom Dashboard. Navigate to Custom Dashboard to view it.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Pin Chart",
        description: error.message || "An error occurred while saving the chart.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load most recent session once on mount (persist conversation across connection/layer changes)
  useEffect(() => {
    // Only load once
    if (lastInitializedRef.current === 'loaded') {
      return;
    }

    const loadMostRecentSession = async () => {
      try {
        // Get all sessions sorted by most recent first (API returns them sorted)
        const response = await apiRequest('GET', '/api/chat/sessions');
        const allSessions = await response.json();
        
        if (allSessions && allSessions.length > 0) {
          const mostRecentSession = allSessions[0];
          await loadSession(mostRecentSession.sessionId);
          
          // Set the connection/layer from the most recent session
          setSelectedConnection(mostRecentSession.connectionName);
          setSelectedLayer(mostRecentSession.layer);
        }
        
        lastInitializedRef.current = 'loaded';
      } catch (error) {
        console.error('Error loading session:', error);
        lastInitializedRef.current = 'loaded';
      }
    };

    if (isOpen) {
      loadMostRecentSession();
    }
  }, [isOpen]);

  // Handle click outside to minimize chat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't minimize if clicking inside the chat container
      if (chatContainerRef.current && chatContainerRef.current.contains(target)) {
        return;
      }
      
      // Don't minimize if clicking on Radix UI portals (Select, Dialog, etc.)
      if (target.closest('[role="dialog"]') || 
          target.closest('[role="menu"]') || 
          target.closest('[role="listbox"]') ||
          target.closest('[data-radix-portal]')) {
        return;
      }
      
      // Minimize if in non-fullscreen mode and clicking outside
      if (isOpen && !isFullscreen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, isFullscreen]);

  // Infinite scroll - load older messages when scrolling to top
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasMoreSessions) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingOlder && hasMoreSessions) {
          loadOlderSession();
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [isLoadingOlder, hasMoreSessions, loadedSessionIds, chatSessions]);

  const handleNewChat = () => {
    // Reset current session immediately
    setCurrentSessionId(null);
    setMessages([]);
    setConversationHistory([]);
    setShowHistory(false);
    setEditingChart(null); // Clear editing mode on new chat
    setLoadedSessionIds([]);
    setHasMoreSessions(true);
    
    // Create new session
    createSessionMutation.mutate();
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await apiRequest('GET', `/api/chat/sessions/${sessionId}/messages`);
      const sessionMessages = await response.json();
      
      // Convert stored messages back to Message format
      const loadedMessages: Message[] = sessionMessages.map((msg: any) => ({
        id: msg.messageId,
        type: msg.messageType,
        content: msg.content,
        sql: msg.sql || undefined,
        data: msg.data ? JSON.parse(msg.data) : undefined,
        columns: msg.columns ? JSON.parse(msg.columns) : undefined,
        rowCount: msg.rowCount || undefined,
        chartType: msg.chartType || undefined,
        sessionId: sessionId, // Track which session this message belongs to
      }));

      // Reconstruct conversationHistory from stored messages
      // Format: array of {role: 'user'|'assistant', content: string}
      const reconstructedHistory: any[] = [];
      sessionMessages.forEach((msg: any) => {
        if (msg.messageType === 'user') {
          reconstructedHistory.push({
            role: 'user',
            content: msg.content
          });
        } else if (msg.messageType === 'assistant') {
          const histEntry: any = {
            role: 'assistant',
            content: msg.content
          };
          if (msg.sql) {
            histEntry.sql = msg.sql;
          }
          reconstructedHistory.push(histEntry);
        }
      });

      setCurrentSessionId(sessionId);
      setMessages(loadedMessages);
      setConversationHistory(reconstructedHistory);
      setLoadedSessionIds([sessionId]);
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const loadOlderSession = async () => {
    if (isLoadingOlder || !hasMoreSessions || !chatSessions.length) {
      return;
    }

    setIsLoadingOlder(true);

    try {
      // Find the next session to load
      const currentIndex = chatSessions.findIndex((s: any) => s.sessionId === loadedSessionIds[0]);
      const nextIndex = currentIndex + loadedSessionIds.length;

      if (nextIndex >= chatSessions.length) {
        setHasMoreSessions(false);
        setIsLoadingOlder(false);
        return;
      }

      const nextSession = chatSessions[nextIndex];
      
      // Capture scroll position before loading
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) {
        setIsLoadingOlder(false);
        return;
      }

      const prevScrollHeight = scrollContainer.scrollHeight;
      const prevScrollTop = scrollContainer.scrollTop;

      // Fetch older session messages
      const response = await apiRequest('GET', `/api/chat/sessions/${nextSession.sessionId}/messages`);
      const sessionMessages = await response.json();

      if (!sessionMessages || sessionMessages.length === 0) {
        setHasMoreSessions(false);
        setIsLoadingOlder(false);
        return;
      }

      // Convert to Message format with sessionId marker
      const olderMessages: Message[] = sessionMessages.map((msg: any) => ({
        id: msg.messageId,
        type: msg.messageType,
        content: msg.content,
        sql: msg.sql || undefined,
        data: msg.data ? JSON.parse(msg.data) : undefined,
        columns: msg.columns ? JSON.parse(msg.columns) : undefined,
        rowCount: msg.rowCount || undefined,
        chartType: msg.chartType || undefined,
        sessionId: nextSession.sessionId,
      }));

      // Prepend older messages
      setMessages(prev => [...olderMessages, ...prev]);
      setLoadedSessionIds(prev => [nextSession.sessionId, ...prev]);

      // Restore scroll position after layout
      requestAnimationFrame(() => {
        if (scrollContainer) {
          const newScrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop = newScrollHeight - (prevScrollHeight - prevScrollTop);
        }
      });

    } catch (error) {
      console.error('Error loading older session:', error);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const chatMutation = useMutation({
    mutationFn: async (data: { userQuery: string; previousError?: string; attempt?: number; tableOverride?: string[]; chartContext?: any }) => {
      const response = await apiRequest('POST', '/api/chat/query', {
        userQuery: data.userQuery,
        connectionName: selectedConnection,
        layer: selectedLayer,
        conversationHistory: conversationHistory,
        previousError: data.previousError,
        attempt: data.attempt || 1,
        tableOverride: data.tableOverride,
        chartContext: data.chartContext
      });
      return await response.json();
    },
    onSuccess: async (result: any) => {
      if (result.success) {
        // Update conversation history
        setConversationHistory(result.conversation_history || []);

        // Add assistant response with results
        const newMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: result.explanation || 'Query executed successfully',
          sql: result.sql,
          data: result.data,
          columns: result.columns,
          rowCount: result.row_count,
          chartType: result.chart_type
        };
        setMessages(prev => [...prev, newMessage]);

        // Auto-save assistant message to database
        if (currentSessionId) {
          await saveMessageMutation.mutateAsync({
            sessionId: currentSessionId,
            messageType: 'assistant',
            content: result.explanation || 'Query executed successfully',
            sql: result.sql,
            data: result.data,
            columns: result.columns,
            rowCount: result.row_count,
            chartType: result.chart_type,
          });
        }
      } else if (result.max_attempts_reached) {
        // Show table selection UI
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'table-selection',
          content: result.message || 'Please select the correct table',
          availableTables: result.available_tables || []
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        // Show error
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'error',
          content: result.error || 'An error occurred'
        };
        setMessages(prev => [...prev, errorMessage]);

        // Auto-save error message
        if (currentSessionId) {
          await saveMessageMutation.mutateAsync({
            sessionId: currentSessionId,
            messageType: 'error',
            content: result.error || 'An error occurred',
          });
        }
      }
    },
    onError: async (error: any) => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'error',
        content: error.message || 'Failed to process query'
      };
      setMessages(prev => [...prev, errorMessage]);

      // Auto-save error message
      if (currentSessionId) {
        await saveMessageMutation.mutateAsync({
          sessionId: currentSessionId,
          messageType: 'error',
          content: error.message || 'Failed to process query',
        });
      }
    }
  });

  const handleSendMessage = async () => {
    if (!userInput.trim() || !selectedConnection || !selectedLayer) return;

    // Create session if it doesn't exist (first message)
    let sessionId = currentSessionId;
    if (!sessionId) {
      const response = await apiRequest('POST', '/api/chat/sessions', {
        connectionName: selectedConnection,
        layer: selectedLayer,
      });
      const newSession = await response.json();
      sessionId = newSession.sessionId;
      setCurrentSessionId(sessionId);
      refetchSessions();
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userInput
    };
    setMessages(prev => [...prev, userMessage]);
    setLastUserQuery(userInput);
    const currentInput = userInput;
    const currentChartContext = editingChart;
    setUserInput('');
    setEditingChart(null); // Clear editing mode after sending

    // Auto-save user message to database
    await saveMessageMutation.mutateAsync({
      sessionId: sessionId!,
      messageType: 'user',
      content: currentInput,
    });

    // Send to backend (NO table override for new queries - only for retries)
    chatMutation.mutate({ 
      userQuery: currentInput,
      chartContext: currentChartContext // Include chart context if editing
    });
  };

  const handleTableCheckbox = (tableName: string, checked: boolean) => {
    setPendingTableSelection(prev => {
      if (checked) {
        return [...prev, tableName];
      } else {
        return prev.filter(t => t !== tableName);
      }
    });
  };

  const handleConfirmTableSelection = () => {
    if (pendingTableSelection.length === 0) return;

    // Add user message indicating table selection
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: `Using ${pendingTableSelection.length} table(s): ${pendingTableSelection.join(', ')}`
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Set the table override and retry with original query
    setSelectedTableOverride(pendingTableSelection);
    
    // Retry with the last user query and the selected tables (reset to attempt 1)
    chatMutation.mutate({ 
      userQuery: lastUserQuery,
      tableOverride: pendingTableSelection,
      attempt: 1 // Reset attempt counter with table selection
    });
    
    // Reset pending selection
    setPendingTableSelection([]);
  };

  // Chart rendering helper
  const renderChart = (chartType: string, data: any[], columns: string[]) => {
    if (!data || data.length === 0 || !columns || columns.length < 2) {
      return null;
    }

    // Define colors for charts
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

    // For most charts, assume first column is category/x-axis, second is value/y-axis
    const xKey = columns[0];
    const yKey = columns[1];

    switch (chartType) {
      case 'pie':
        return (
          <div className="mt-4 w-full max-w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <PieChartIcon className="h-4 w-4" />
              <p className="text-xs font-semibold">Pie Chart:</p>
            </div>
            <div className="w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%' }}>
              <ResponsiveContainer width="100%" height={250} minWidth={0}>
                <PieChart margin={{ left: 8, right: 8, top: 5, bottom: 5 }}>
                <Pie
                  data={data}
                  dataKey={yKey}
                  nameKey={xKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }) => {
                    const truncatedName = name.length > 10 ? name.substring(0, 8) + '...' : name;
                    return `${truncatedName}: ${(percent * 100).toFixed(0)}%`;
                  }}
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'bar':
        return (
          <div className="mt-4 w-full max-w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4" />
              <p className="text-xs font-semibold">Bar Chart:</p>
            </div>
            <div className="w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%' }}>
              <ResponsiveContainer width="100%" height={250} minWidth={0}>
                <BarChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={xKey} 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                />
                  <YAxis tick={{ fontSize: 11 }} width={45} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={yKey} fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'line':
        return (
          <div className="mt-4 w-full max-w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              <p className="text-xs font-semibold">Line Chart:</p>
            </div>
            <div className="w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%' }}>
              <ResponsiveContainer width="100%" height={250} minWidth={0}>
                <LineChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={xKey} 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                />
                  <YAxis tick={{ fontSize: 11 }} width={45} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey={yKey} stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'histogram':
        // For histogram, treat the data as frequency distribution
        return (
          <div className="mt-4 w-full max-w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4" />
              <p className="text-xs font-semibold">Histogram:</p>
            </div>
            <div className="w-full max-w-full min-w-0" style={{ width: '100%', maxWidth: '100%' }}>
              <ResponsiveContainer width="100%" height={250} minWidth={0}>
                <BarChart data={data} margin={{ left: 8, right: 8, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={xKey}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                />
                  <YAxis tick={{ fontSize: 11 }} width={45} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={yKey} fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderMessage = (message: Message) => {
    if (message.type === 'user') {
      return (
        <div className="flex justify-end mb-4 w-full">
          <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%] break-words overflow-wrap-anywhere">
            {message.content}
          </div>
        </div>
      );
    }

    if (message.type === 'error') {
      return (
        <div className="flex justify-start mb-4">
          <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded-lg px-4 py-2 max-w-[80%] flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div className="break-words">{message.content}</div>
          </div>
        </div>
      );
    }

    if (message.type === 'table-selection') {
      return (
        <div className="flex justify-start mb-4">
          <Card className="max-w-[80%]">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{message.content}</p>
              {message.availableTables && message.availableTables.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold">Select one or more tables:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {message.availableTables.map((table: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <Checkbox
                          id={`table-${idx}`}
                          checked={pendingTableSelection.includes(table.full_name)}
                          onCheckedChange={(checked) => handleTableCheckbox(table.full_name, checked as boolean)}
                          data-testid={`checkbox-table-${idx}`}
                        />
                        <Label
                          htmlFor={`table-${idx}`}
                          className="text-sm cursor-pointer"
                        >
                          {table.full_name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleConfirmTableSelection}
                    disabled={pendingTableSelection.length === 0}
                    data-testid="button-confirm-tables"
                  >
                    Confirm Selection ({pendingTableSelection.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    // Assistant message with results
    return (
      <div className="flex justify-start mb-4 w-full">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-3 max-w-[95%] min-w-0 overflow-hidden">
          <p className="text-sm mb-2 break-words whitespace-pre-wrap overflow-wrap-anywhere">{message.content}</p>
          
          {message.sql && (
            <div className="mt-3 mb-2 max-w-full overflow-hidden">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">SQL Query:</p>
              <div className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto max-w-full">
                <pre className="whitespace-pre-wrap break-all overflow-wrap-anywhere">{message.sql}</pre>
              </div>
            </div>
          )}

          {/* Render chart if chartType is provided and not 'table' */}
          {message.chartType && message.chartType !== 'table' && message.data && message.data.length > 0 && message.columns && (
            <div className="w-full max-w-full min-w-0 overflow-hidden" style={{ maxWidth: 'calc(100% - 0px)' }}>
              {renderChart(message.chartType, message.data, message.columns)}
            </div>
          )}

          {message.data && message.data.length > 0 && (
            <div className="mt-3 w-full max-w-full overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <TableIcon className="h-4 w-4" />
                <p className="text-xs font-semibold">Data ({message.rowCount} rows):</p>
              </div>
              <div className="max-h-64 overflow-x-auto overflow-y-auto border rounded w-full max-w-full">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      {message.columns?.map((col, idx) => (
                        <TableHead key={idx} className="text-xs whitespace-nowrap px-2">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {message.data.slice(0, 10).map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        {message.columns?.map((col, colIdx) => (
                          <TableCell key={colIdx} className="text-xs whitespace-nowrap px-2">{row[col]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {message.rowCount && message.rowCount > 10 && (
                <p className="text-xs text-gray-500 mt-1">Showing first 10 of {message.rowCount} rows</p>
              )}
            </div>
          )}

          {/* Pin to Dashboard button - show for charts or data tables */}
          {(message.chartType || (message.data && message.data.length > 0)) && message.sql && (
            <div className="mt-3 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => pinChartMutation.mutate(message)}
                disabled={pinChartMutation.isPending}
                className="text-xs"
                data-testid="button-pin-chart"
              >
                <Pin className="h-3 w-3 mr-1" />
                {pinChartMutation.isPending ? 'Pinning...' : 'Pin to Dashboard'}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Watch for edit chart requests from Custom Dashboard
  useEffect(() => {
    if (editChart && !chatMutation.isPending) {
      // Open chat if closed
      if (!isOpen) {
        setIsOpen(true);
      }

      // Switch to the correct connection/layer
      setSelectedConnection(editChart.connectionName);
      setSelectedLayer(editChart.layer);

      // Store the chart context for editing
      setEditingChart(editChart);

      // Clear the edit context to prevent repeated triggers
      setEditChart(null);

      // Clear input so user can type their own prompt
      setUserInput('');

      // Show toast
      toast({
        title: "Editing chart",
        description: `Loaded "${editChart.title}" for editing. Describe your changes!`,
      });
    }
  }, [editChart, chatMutation.isPending, isOpen, setEditChart, toast]);

  // Clear editing mode when connection/layer changes
  useEffect(() => {
    setEditingChart(null);
  }, [selectedConnection, selectedLayer]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-50"
        data-testid="button-open-chat"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div ref={chatContainerRef} className={`fixed z-50 ${isFullscreen ? 'inset-0' : 'bottom-4 right-4 sm:bottom-6 sm:right-6'}`}>
      <Card className={`shadow-xl flex flex-col ${isFullscreen ? 'w-full h-full' : 'w-[calc(100vw-2rem)] sm:w-96 md:w-[28rem] lg:w-[32rem] h-[85vh] max-h-[600px]'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-2 bg-blue-600 text-white ${isFullscreen ? '' : 'rounded-t-lg'}`}>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            <span className="font-semibold text-sm">Chat with Your Data</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-6 w-6 p-0 text-white hover:bg-blue-700"
              data-testid="button-toggle-fullscreen"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0 text-white hover:bg-blue-700"
              data-testid="button-close-chat"
              title="Minimize"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Configuration selectors */}
        <div className="p-2 border-b bg-gray-50 dark:bg-gray-900 space-y-1.5">
          <div className="flex gap-1.5">
            <Select value={selectedConnection} onValueChange={(value) => {
              setSelectedConnection(value);
              setSelectedLayer('');
            }}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-connection">
                <SelectValue placeholder="Select Connection" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set(configs.map(c => c.connectionName))).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLayer} onValueChange={setSelectedLayer} disabled={!selectedConnection}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-layer">
                <SelectValue placeholder="Layer" />
              </SelectTrigger>
              <SelectContent>
                {availableLayers.map((layer, idx) => (
                  <SelectItem key={idx} value={layer}>
                    {layer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedConnection && selectedLayer && (
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!showHistory) {
                    refetchSessions();
                  }
                  setShowHistory(!showHistory);
                }}
                className="flex-1 h-7 text-xs"
                data-testid="button-toggle-history"
              >
                <History className="h-3 w-3 mr-1.5" />
                {showHistory ? 'Hide History' : 'Show History'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="h-7 text-xs"
                data-testid="button-new-chat"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                New Chat
              </Button>
            </div>
          )}
        </div>

        {/* Main content area with optional history sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat History Sidebar */}
          {showHistory && selectedConnection && selectedLayer && (
            <div className="w-80 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-sm">Chat History</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Last 10 sessions</p>
              </div>
              <ScrollArea className="flex-1">
                {chatSessions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No previous chats
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {chatSessions.map((session: any) => (
                      <Card
                        key={session.sessionId}
                        className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                          currentSessionId === session.sessionId ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                        }`}
                        onClick={() => loadSession(session.sessionId)}
                        data-testid={`session-${session.sessionId}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {new Date(session.createdAt).toLocaleString()}
                            </p>
                            <p className="text-sm truncate">
                              {session.firstMessage || 'Empty session'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSessionMutation.mutate(session.sessionId);
                            }}
                            data-testid={`button-delete-session-${session.sessionId}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-2 overflow-y-auto overflow-x-hidden" ref={scrollContainerRef}>
            <div className="w-full max-w-full min-w-0 overflow-hidden">
              {/* Top sentinel for infinite scroll */}
              {messages.length > 0 && (
                <div ref={topSentinelRef} className="h-1" />
              )}
              
              {/* Loading indicator for older messages */}
              {isLoadingOlder && (
                <div className="flex justify-center mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading older messages...</span>
                  </div>
                </div>
              )}
              
              {messages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-6">
                  <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a database connection and layer to start chatting</p>
                  <p className="text-xs mt-1">Ask questions about your data in natural language</p>
                </div>
              )}
              
              {/* Render messages with session dividers */}
              {messages.map((message, index) => {
                const showSessionDivider = index > 0 && message.sessionId !== messages[index - 1].sessionId;
                return (
                  <div key={`${message.sessionId}-${message.id}`}>
                    {showSessionDivider && (
                      <div className="flex items-center gap-2 my-6">
                        <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 px-2">
                          Earlier conversation
                        </span>
                        <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                    )}
                    {renderMessage(message)}
                  </div>
                );
              })}
              
              {chatMutation.isPending && (
                <div className="flex justify-start mb-4">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="p-2 border-t bg-white dark:bg-gray-800">
          {/* Editing Chart Badge */}
          {editingChart && (
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs py-0.5 px-2">
                Editing: {editingChart.title}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingChart(null)}
                className="h-5 w-5 p-0"
                title="Cancel editing"
                data-testid="button-cancel-edit"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={editingChart ? "Describe your changes..." : "Ask a question..."}
              disabled={!selectedConnection || !selectedLayer || chatMutation.isPending}
              className="h-8 text-sm"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || !selectedConnection || !selectedLayer || chatMutation.isPending}
              className="h-8 w-8 p-0"
              data-testid="button-send-message"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
