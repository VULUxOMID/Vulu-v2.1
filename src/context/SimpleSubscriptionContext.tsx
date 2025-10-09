import React, { createContext, useContext, ReactNode } from 'react';

console.log('🔄 SimpleSubscriptionContext module loaded');

interface SimpleSubscriptionContextType {
  subscription: any;
  isLoading: boolean;
}

const SimpleSubscriptionContext = createContext<SimpleSubscriptionContextType | undefined>(undefined);

interface SimpleSubscriptionProviderProps {
  children: ReactNode;
}

export const SimpleSubscriptionProvider: React.FC<SimpleSubscriptionProviderProps> = ({ children }) => {
  console.log('🔄 SimpleSubscriptionProvider component initializing');

  const value: SimpleSubscriptionContextType = {
    subscription: null,
    isLoading: false,
  };

  console.log('✅ SimpleSubscriptionProvider rendering with value:', value);

  return (
    <SimpleSubscriptionContext.Provider value={value}>
      {children}
    </SimpleSubscriptionContext.Provider>
  );
};

export const useSimpleSubscription = () => {
  const context = useContext(SimpleSubscriptionContext);
  if (context === undefined) {
    throw new Error('useSimpleSubscription must be used within a SimpleSubscriptionProvider');
  }
  return context;
};

console.log('✅ SimpleSubscriptionContext module exports ready');
