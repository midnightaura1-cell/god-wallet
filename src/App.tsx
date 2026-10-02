import { useMemo } from 'react';
import { formatMoney, getStatusClass, supabase } from './lib/supabase';
import type { Profile, Transaction, Wallet } from './types';

const API_MODE = 'TEST USD MODE';

const defaultWallet: Wallet = {
  id: 'wallet',
  user_id: 'n/a',
  balance_cents: 0,
  currency: 'USD',
  status: 'test',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet>(defaultWallet);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [action, setAction] = useState<'deposit' | 'withdrawal' | 'transfer' | null>(null);
  const [form, setForm] = useState({ amount: '0', description: '', recipient: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const loadSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setLoading(false);
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setWallet(defaultWallet);
      setTransactions([]);
      return;
    }

    const loadDashboardData = async () => {
      const [profileResult, walletResult, transactionResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('wallets').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('transactions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10),
      ]);

      if (profileResult.data) setProfile(profileResult.data as Profile);
      if (walletResult.data) setWallet(walletResult.data as Wallet);
      if (transactionResult.data) setTransactions(transactionResult.data as Transaction[]);
    };

    loadDashboardData();
  }, [session]);

  const totals = useMemo(() => {
    const deposits = transactions
      .filter((item) => item.type === 'deposit' && item.status !== 'failed')
      .reduce((sum, item) => sum + item.amount_cents, 0);

    const withdrawals = transactions
      .filter((item) => item.type === 'withdrawal' && item.status !== 'failed')
      .reduce((sum, item) => sum + item.amount_cents, 0);

    return {
      deposits,
      withdrawals,
      balance: wallet.balance_cents,
    };
  }, [transactions, wallet.balance_cents]);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        const createdUser = data.user;
        if (createdUser) {
          setMessage('Account created. Please confirm your email if required, then sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('Signed in successfully.');
      }
    } catch (error: any) {
      setMessage(error.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setAction(null);
    setForm({ amount: '0', description: '', recipient: '' });
    setMessage('');
  };

  const updateWalletBalance = async (deltaCents: number) => {
    const nextBalance = Math.max(0, wallet.balance_cents + deltaCents);
    await supabase.from('wallets').update({ balance_cents: nextBalance, updated_at: new Date().toISOString() }).eq('id', wallet.id);
    setWallet({ ...wallet, balance_cents: nextBalance, updated_at: new Date().toISOString() });
  };

  const submitAction = async () => {
    if (!session?.user || !wallet.id) return;

    const amountCents = Math.round(Number(form.amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setMessage('Enter a valid amount greater than zero.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (action === 'deposit') {
        const description = form.description || 'TEST USD deposit';

        const { error: txError } = await supabase.from('transactions').insert({
          user_id: session.user.id,
          type: 'deposit',
          amount_cents: amountCents,
          description,
          status: 'completed',
        });

        if (txError) throw txError;

        await updateWalletBalance(amountCents);
        setMessage('TEST USD deposit recorded successfully.');
      }

      if (action === 'withdrawal') {
        const description = form.description || 'TEST USD withdrawal';

        if (amountCents > wallet.balance_cents) {
          throw new Error('Insufficient TEST USD balance for this withdrawal.');
        }

        const { error: txError } = await supabase.from('transactions').insert({
          user_id: session.user.id,
          type: 'withdrawal',
          amount_cents: amountCents,
          description,
          status: 'pending',
        });

        if (txError) throw txError;

        await updateWalletBalance(-amountCents);
        setMessage('TEST USD withdrawal is pending review.');
      }

      if (action === 'transfer') {
        const recipientEmail = form.recipient.trim();
        if (!recipientEmail) {
          throw new Error('Please provide a recipient email.');
        }

        if (recipientEmail.toLowerCase() === session.user.email?.toLowerCase()) {
          throw new Error('You cannot transfer TEST USD to yourself.');
        }

        const { data: recipientProfile, error: recipientErr } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', recipientEmail)
          .maybeSingle();

        if (recipientErr) throw recipientErr;
        if (!recipientProfile) throw new Error('Recipient email not found.');

        const { data: recipientWallet, error: walletErr } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', recipientProfile.id)
          .maybeSingle();

        if (walletErr) throw walletErr;
        if (!recipientWallet) throw new Error('Recipient wallet not found.');

        if (amountCents > wallet.balance_cents) {
          throw new Error('Insufficient TEST USD balance for this transfer.');
        }

        const transferDescription = form.description || `TEST USD transfer to ${recipientProfile.email}`;

        await supabase.from('wallet_transfers').insert({
          sender_user_id: session.user.id,
          recipient_user_id: recipientProfile.id,
          sender_wallet_id: wallet.id,
          recipient_wallet_id: recipientWallet.id,
          amount_cents: amountCents,
          description: transferDescription,
          status: 'completed',
        });

        await supabase.from('transactions').insert([
          {
            user_id: session.user.id,
            type: 'transfer',
            amount_cents: amountCents,
            description: `TEST transfer to ${recipientProfile.email}`,
            status: 'completed',
          },
          {
            user_id: recipientProfile.id,
            type: 'transfer',
            amount_cents: amountCents,
            description: `TEST transfer from ${session.user.email}`,
            status: 'completed',
          },
        ]);

        await supabase
          .from('wallets')
          .update({ balance_cents: wallet.balance_cents - amountCents, updated_at: new Date().toISOString() })
          .eq('id', wallet.id);

        await supabase
          .from('wallets')
          .update({ balance_cents: recipientWallet.balance_cents + amountCents, updated_at: new Date().toISOString() })
          .eq('id', recipientWallet.id);

        setWallet({ ...wallet, balance_cents: wallet.balance_cents - amountCents, updated_at: new Date().toISOString() });
        setMessage('TEST USD transfer completed successfully.');
      }

      const { data: refreshedTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (refreshedTransactions) setTransactions(refreshedTransactions as Transaction[]);

      const { data: refreshedWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (refreshedWallet) setWallet(refreshedWallet as Wallet);
      resetForm();
    } catch (error: any) {
      setMessage(error.message || 'The transaction could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setWallet(defaultWallet);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading GOD Wallet…</div>;
  }

  if (!session) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
        <div className="panel max-w-md w-full p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-sky-500 font-semibold">GOD Wallet</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">Secure USD Access</h1>
            </div>
            <button
              type="button"
              className="button-secondary px-3 py-2 text-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div className="mb-6 flex rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-700 dark:bg-slate-800/80">
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${authMode === 'signup' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              onClick={() => setAuthMode('signup')}
            >
              Sign up
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${authMode === 'login' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              onClick={() => setAuthMode('login')}
            >
              Log in
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</span>
              <input className="input-shell" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Password</span>
              <input className="input-shell" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </label>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              TEST USD ONLY. No real money is created or transferred in this version.
            </div>

            {message ? <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-100">{message}</div> : null}

            <button type="submit" className="button-primary w-full" disabled={busy}>
              {busy ? 'Please wait...' : authMode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="panel mb-6 flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-500 font-semibold">GOD Wallet</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">TEST USD Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button type="button" className="button-secondary" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="panel p-5">
            <div className="text-sm text-muted">Current USD balance</div>
            <div className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{formatMoney(wallet.balance_cents)}</div>
            <div className="mt-2 text-xs text-sky-600 dark:text-sky-300">{API_MODE}</div>
          </div>

          <div className="panel p-5">
            <div className="text-sm text-muted">Total deposits</div>
            <div className="mt-3 text-2xl font-bold text-emerald-600">{formatMoney(totals.deposits)}</div>
            <div className="mt-2 text-xs text-muted">Simulated USD only</div>
          </div>

          <div className="panel p-5">
            <div className="text-sm text-muted">Total withdrawals</div>
            <div className="mt-3 text-2xl font-bold text-amber-600">{formatMoney(totals.withdrawals)}</div>
            <div className="mt-2 text-xs text-muted">Pending or completed test flows</div>
          </div>

          <div className="panel p-5">
            <div className="text-sm text-muted">User account</div>
            <div className="mt-3 text-lg font-semibold text-slate-800 dark:text-slate-100">{profile?.full_name || profile?.email || 'New account'}</div>
            <div className="mt-2 text-xs text-muted">{profile?.email || session.user.email}</div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent transactions</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">TEST MODE</span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/90">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500">Type</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500">Description</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">No transactions yet.</td>
                    </tr>
                  ) : (
                    transactions.map((item) => (
                      <tr key={item.id} className="bg-white/40 dark:bg-slate-900/30">
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{item.type}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.description}</td>
                        <td className={`px-4 py-3 text-sm font-semibold ${item.amount_cents > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {item.amount_cents > 0 ? '+' : '-'}{formatMoney(item.amount_cents)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`status-pill ${getStatusClass(item.status)}`}>{item.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Quick actions</h2>

            <div className="space-y-3">
              <button className="button-primary w-full" onClick={() => setAction('deposit')}>
                Deposit TEST USD
              </button>
              <button className="button-secondary w-full" onClick={() => setAction('withdrawal')}>
                Withdraw TEST USD
              </button>
              <button className="button-secondary w-full" onClick={() => setAction('transfer')}>
                Transfer TEST USD
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-300/40 bg-sky-50 p-3 text-sm text-sky-700 dark:border-sky-700 dark:bg-sky-500/10 dark:text-sky-200">
              This version does not connect to a real bank or payment network. All actions are simulated and explicitly labeled as TEST USD.
            </div>
          </div>
        </div>
      </div>

      {action ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="panel w-full max-w-lg p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {action === 'deposit' ? 'Deposit' : action === 'withdrawal' ? 'Withdraw' : 'Transfer'} TEST USD
              </h3>
              <button type="button" className="button-secondary px-2 py-1 text-sm" onClick={resetForm}>Close</button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Amount (USD)</span>
                <input
                  className="input-shell"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Description</span>
                <input
                  className="input-shell"
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={action === 'deposit' ? 'Demo deposit' : action === 'withdrawal' ? 'Wall test withdrawal' : 'Transfer to teammate'}
                />
              </label>

              {action === 'transfer' ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Recipient email</span>
                  <input
                    className="input-shell"
                    type="email"
                    value={form.recipient}
                    onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                    placeholder="recipient@example.com"
                  />
                </label>
              ) : null}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                No actual funds are moved. This action is a simulated TEST USD event.
              </div>

              {message ? <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-100">{message}</div> : null}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="button-secondary" onClick={resetForm}>Cancel</button>
                <button type="button" className="button-primary" onClick={submitAction} disabled={busy}>
                  {busy ? 'Processing...' : `Confirm ${action}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
