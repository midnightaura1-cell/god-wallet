import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const formatMoney = (amountCents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
};

export const centsToNumber = (amountCents: number): number => amountCents / 100;

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatTransactionLabel = (type: string) => {
  const map: Record<string, string> = {
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    transfer: 'Transfer',
    adjustment: 'Adjustment',
  };

  return map[type] ?? type;
};

export const getStatusClass = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'status-completed';
    case 'pending':
      return 'status-pending';
    case 'failed':
      return 'status-failed';
    case 'reversed':
      return 'status-reversed';
    default:
      return 'status-pending';
  }
};
