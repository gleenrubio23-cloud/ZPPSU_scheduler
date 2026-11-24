/** The page frame: top bar, side menu (by role), and flash messages. */
import type { ReactNode } from 'react';
import { takeFlash, type User } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { APP_NAME, ROLES, SCHOOL_NAME } from '@/lib/constants';
import { termLabel } from '@/lib/format';
import { logout } from '@/actions/auth';
import FlashClear from './FlashClear';

function menuFor(user: User): [string, string][] {
  const isStaff = user.role === 'admin' || user.role === 'chair';
  const menu: [string, string][] = [['/dashboard', 'Dashboard']];
  if (isStaff) {
    menu.push(['/faculty', 'Faculty Profiles'], ['/subjects', 'Subjects'], ['/sections', 'Sections'],
      ['/offerings', 'Class Offerings'], ['/conflicts', 'Conflict Report']);
  }
  if (user.role === 'faculty') menu.push(['/profile', 'My Profile']);
  menu.push(['/timetable', user.role === 'faculty' ? 'My Schedule' : 'Timetables']);
  if (user.role === 'admin') {
    menu.push(['/users', 'Users'], ['/departments', 'Departments'], ['/rooms', 'Rooms'], ['/terms', 'Terms'],
      ['/settings', 'Settings']);
  }
  if (isStaff) menu.push(['/lookups', 'Skills and Fields']);
  menu.push(['/account', 'My Account']);
  return menu;
}

export default async function Shell({
  user, active, children,
}: { user: User; active: string; children: ReactNode }) {
  const [term, flashes] = await Promise.all([activeTerm(), takeFlash()]);
  return (
    <>
      <header className="topbar">
        <label htmlFor="nav-toggle" className="burger" aria-label="Menu">&#9776;</label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.jpg" alt="" />
        <span className="brand">{APP_NAME}<small>{SCHOOL_NAME}</small></span>
        <span className="who">
          {user.full_name} <small>({ROLES[user.role]})</small>
          <form action={logout} className="inline"><button className="linkish">Log out</button></form>
        </span>
      </header>
      <input type="checkbox" id="nav-toggle" hidden />
      <nav className="sidebar">
        <div className="term">Active term<br /><strong>{termLabel(term)}</strong></div>
        {menuFor(user).map(([href, label]) => (
          <a key={href} href={href} className={active === href ? 'active' : ''}>{label}</a>
        ))}
      </nav>
      <main className="content">
        {flashes.map((f, i) => (
          <div key={i} className={`alert ${f.type}`}>{f.message}</div>
        ))}
        {flashes.length > 0 && <FlashClear />}
        {children}
      </main>
    </>
  );
}
