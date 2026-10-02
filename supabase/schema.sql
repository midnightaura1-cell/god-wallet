-- Enable extensions
create extension if not exists pgcrypto;

-- Public profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Wallet table
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0,
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'test' check (status in ('test','verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transactions table
create type public.transaction_type as enum ('deposit', 'withdrawal', 'transfer', 'adjustment');
create type public.transaction_status as enum ('pending', 'completed', 'failed', 'reversed');

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null default 'TEST USD transaction',
  status public.transaction_status not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transfers table
create table if not exists public.wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  sender_wallet_id uuid references public.wallets(id) on delete set null,
  recipient_wallet_id uuid references public.wallets(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null default 'TEST USD transfer',
  status public.transaction_status not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger to update timestamps
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create or replace trigger wallets_set_updated_at
before update on public.wallets
for each row execute procedure public.set_updated_at();

create or replace trigger transactions_set_updated_at
before update on public.transactions
for each row execute procedure public.set_updated_at();

create or replace trigger wallet_transfers_set_updated_at
before update on public.wallet_transfers
for each row execute procedure public.set_updated_at();

-- Trigger for new auth.user => create profile + wallet
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance_cents, currency, status)
  values (new.id, 0, 'USD', 'test')
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.wallet_transfers enable row level security;

create policy "Profiles are viewable by owner"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Wallets are viewable by owner"
on public.wallets
for select
using (auth.uid() = user_id);

create policy "Users can update their own wallet"
on public.wallets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can insert their own wallet"
on public.wallets
for insert
with check (auth.uid() = user_id);

create policy "Transactions are viewable by owner"
on public.transactions
for select
using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
on public.transactions
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own transactions"
on public.transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Transfers are viewable by sender or recipient"
on public.wallet_transfers
for select
using (auth.uid() = sender_user_id or auth.uid() = recipient_user_id);

create policy "Users can insert their own outgoing transfers"
on public.wallet_transfers
for insert
with check (auth.uid() = sender_user_id);

create policy "Users can update their own transfers"
on public.wallet_transfers
for update
using (auth.uid() = sender_user_id or auth.uid() = recipient_user_id)
with check (auth.uid() = sender_user_id or auth.uid() = recipient_user_id);

-- Grant access to authenticated users
grant usage on schema public to authenticated;
grants not needed for tables because RLS handles this. 
