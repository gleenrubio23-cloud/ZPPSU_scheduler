import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { APP_NAME, SCHOOL_NAME } from '@/lib/constants';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage() {
  if (await currentUser()) redirect('/dashboard');
  return (
    <main className="content plain">
      <div className="card login-card">
        <div className="login-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt={`${SCHOOL_NAME} seal`} />
          <div className="school">{SCHOOL_NAME}</div>
          <h1>{APP_NAME}</h1>
        </div>
        <p className="muted">Sign in with your account.</p>
        <LoginForm />
        <footer className="login-foot">
          Designed and developed by<br />Gleen M. Rubio · Jhonmar A. Abaton · Anabella M. Galvez<br />
          &copy; {new Date().getFullYear()}. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
