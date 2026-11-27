import React from 'react';

export interface TransactionFilterState {
  direction?: 'all' | 'inbound' | 'outbound';
  status?: 'all' | 'success' | 'pending' | 'failed';
  startDate?: string;
  endDate?: string;
}

export interface TransactionFiltersProps {
  filters: TransactionFilterState;
  onChange: (filters: TransactionFilterState) => void;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({ filters, onChange }) => {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Direction</label>
        <select
          value={filters.direction || 'all'}
          onChange={(e) => onChange({ ...filters, direction: e.target.value as any })}
          className="mt-1 block rounded-md border-gray-300 shadow-sm sm:text-sm"
        >
          <option value="all">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Status</label>
        <select
          value={filters.status || 'all'}
          onChange={(e) => onChange({ ...filters, status: e.target.value as any })}
          className="mt-1 block rounded-md border-gray-300 shadow-sm sm:text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Start Date</label>
        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
          className="mt-1 block rounded-md border-gray-300 shadow-sm sm:text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">End Date</label>
        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
          className="mt-1 block rounded-md border-gray-300 shadow-sm sm:text-sm"
        />
      </div>
    </div>
  );
};
