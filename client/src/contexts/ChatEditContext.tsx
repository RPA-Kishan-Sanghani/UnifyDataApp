import { createContext, useContext, useState, ReactNode } from 'react';

interface ChartEditData {
  chartId: string;
  title: string;
  sql: string;
  chartType: string;
  connectionName: string;
  layer: string;
  data: any;
  columns: string[];
}

interface ChatEditContextType {
  editChart: ChartEditData | null;
  setEditChart: (chart: ChartEditData | null) => void;
}

const ChatEditContext = createContext<ChatEditContextType | undefined>(undefined);

export function ChatEditProvider({ children }: { children: ReactNode }) {
  const [editChart, setEditChart] = useState<ChartEditData | null>(null);

  return (
    <ChatEditContext.Provider value={{ editChart, setEditChart }}>
      {children}
    </ChatEditContext.Provider>
  );
}

export function useChatEdit() {
  const context = useContext(ChatEditContext);
  if (context === undefined) {
    throw new Error('useChatEdit must be used within a ChatEditProvider');
  }
  return context;
}
