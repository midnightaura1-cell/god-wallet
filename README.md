# GOD Wallet

A modern USD-only personal wallet dashboard built with React, Vite, Tailwind CSS, and Supabase.

## Features

- Email/password authentication with Supabase Auth
- Protected wallet dashboard
- USD-only balance tracking using integer cents
- Deposit, withdrawal, and transfer flows
- Transaction and transfer tables
- Row-level security policies for private wallet data
- Dark and light mode
- TEST USD only with explicit warnings and no crypto or real-money claims

## Tech stack

- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS
- Auth / storage / data: Supabase
- Database: PostgreSQL

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill in the values.
3. Run the SQL in `supabase/schema.sql` in Supabase SQL editor.
4. Install dependencies:
   npm install
5. Start the app:
   npm run dev

## Environment variables

Create a `.env` file with:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Security notes

- This version is explicitly set to TEST USD mode.
- No real financial institution is connected.
- Wallet data is protected by row-level security.
- Users only access their own profile, wallet, and transactions.

## Database schema

The project includes a ready-to-run schema in `supabase/schema.sql` that creates:

- `profiles`
- `wallets`
- `transactions`
- `wallet_transfers`

with RLS policies and a trigger to create a wallet automatically for each new user.
