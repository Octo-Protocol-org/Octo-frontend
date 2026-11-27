import React from 'react';

export interface NetworkIndicatorProps {
  network?: string;
  className?: string;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({
  network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
  className = ''
}) => {
  const isMainnet = network.toLowerCase() === 'mainnet';
  return (
    <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isMainnet ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} ${className}`}>
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${isMainnet ? 'bg-green-500' : 'bg-yellow-500'}`} />
      {network.toUpperCase()}
    </div>
  );
};
