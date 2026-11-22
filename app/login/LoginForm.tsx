'use client';
import { useActionState } from 'react';
import { login } from '@/actions/auth';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action}>
      {state?.error && <div className="alert error">{state.error}</div>}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="username">Username</label>
        <input type="text" id="username" name="username" required autoFocus autoComplete="username" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="password">Password</label>
        <input type="password" id="password" name="password" required autoComplete="current-password" />
      </div>
      <button type="submit" disabled={pending}>{pending ? 'Logging in...' : 'Log in'}</button>
    </form>
  );
}
