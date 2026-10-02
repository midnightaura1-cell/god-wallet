export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'adjustment';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance_cents: number;
  currency: string;
  status: 'test' | 'verified';
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount_cents: number;
  description: string;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
};

export type WalletTransfer = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  sender_wallet_id: string | null;
  recipient_wallet_id: string | null;
  amount_cents: number;
  description: string;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
};
