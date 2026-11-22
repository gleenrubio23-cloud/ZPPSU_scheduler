import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { Bar } from '@/components/ui';
import { deptScope, requireUser } from '@/lib/auth';
import { activeTerm, scanConflicts } from '@/lib/conflict';
import { db, raw, sql } from '@/lib/db';
import { num, termLabel } from '@/lib/format';
import { facultyLoad } from '@/lib/matching';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireUser();
  const term = await activeTerm();
  const termId = term?.id ?? 0;

  if (user.role === 'faculty') {
    const load = await facultyLoad(user.id, termId);
    const max = (await db.val<number>(sql`SELECT max_units FROM faculty_profiles WHERE user_id = ${user.id}`)) ?? 21;
    const pending = (await db.val<number>(sql`
      SELECT (SELECT COUNT(*) FROM faculty_degrees WHERE faculty_id = ${user.id} AND status = 'pending')
           + (SELECT COUNT(*) FROM faculty_certifications WHERE faculty_id = ${user.id} AND status = 'pending')`)) ?? 0;
    const classes = await db.rows(sql`
      SELECT o.id, sub.code, sub.title, sub.units, sec.name AS section_name, o.match_score,
             (SELECT COUNT(*) FROM schedules s WHERE s.offering_id = o.id) AS meetings
      FROM offerings o JOIN subjects sub ON sub.id = o.subject_id JOIN sections sec ON sec.id = o.section_id
      WHERE o.faculty_id = ${user.id} AND o.term_id = ${termId} ORDER BY sub.code`);

    return (
      <Shell user={user} active="/dashboard">
        <h1>Welcome, {user.full_name}</h1>
        <div className="grid" style={{ marginBottom: 18 }}>
          <div className="stat"><b>{classes.length}</b><span>Classes this term</span></div>
          <div className="stat"><b>{num(load)} / {num(max)}</b><span>Units assigned / maximum</span></div>
          <div className="stat"><b>{pending}</b><span>Credentials awaiting verification</span></div>
        </div>
        <div className="card">
          <h2>My classes, {termLabel(term)}</h2>
          {classes.length === 0 ? <p className="muted">No classes assigned to you yet.</p> : (
            <>
              <div className="table-wrap"><table>
                <thead><tr><th>Subject</th><th>Section</th><th className="num">Units</th><th className="num">Match score</th><th>Meetings set</th></tr></thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong> {c.title}</td><td>{c.section_name}</td>
                      <td className="num">{num(c.units)}</td>
                      <td className="num">{c.match_score !== null ? `${num(c.match_score)}%` : '-'}</td>
                      <td>{c.meetings}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <p style={{ marginTop: 12 }}>
                <a className="btn" href="/timetable">View my weekly schedule</a>{' '}
                <a className="btn ghost" href="/profile">Update my profile</a>
              </p>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // Admin and chair. A chair only sees their own department.
  const dept = deptScope(user);
  const subjDept = dept ? sql`AND sub.department_id = ${dept}` : raw('');
  const userDept = dept ? sql`AND u.department_id = ${dept}` : raw('');
  const [total, unassigned, unscheduled, facultyCount, pending, conflicts, loads] = await Promise.all([
    db.val<number>(sql`SELECT COUNT(*) FROM offerings o JOIN subjects sub ON sub.id = o.subject_id WHERE o.term_id = ${termId} ${subjDept}`),
    db.val<number>(sql`SELECT COUNT(*) FROM offerings o JOIN subjects sub ON sub.id = o.subject_id WHERE o.term_id = ${termId} AND o.faculty_id IS NULL ${subjDept}`),
    db.val<number>(sql`SELECT COUNT(*) FROM offerings o JOIN subjects sub ON sub.id = o.subject_id
                       WHERE o.term_id = ${termId} AND NOT EXISTS (SELECT 1 FROM schedules s WHERE s.offering_id = o.id) ${subjDept}`),
    db.val<number>(sql`SELECT COUNT(*) FROM users u WHERE u.role = 'faculty' AND u.is_active ${userDept}`),
    db.val<number>(sql`SELECT (SELECT COUNT(*) FROM faculty_degrees d JOIN users u ON u.id = d.faculty_id WHERE d.status = 'pending' ${userDept})
                            + (SELECT COUNT(*) FROM faculty_certifications c JOIN users u ON u.id = c.faculty_id WHERE c.status = 'pending' ${userDept})`),
    scanConflicts(termId),
    db.rows(sql`
      SELECT u.id, u.full_name, COALESCE(p.max_units, 21) AS max_units,
             COALESCE((SELECT SUM(s.units) FROM offerings o JOIN subjects s ON s.id = o.subject_id
                       WHERE o.faculty_id = u.id AND o.term_id = ${termId}), 0) AS units
      FROM users u LEFT JOIN faculty_profiles p ON p.user_id = u.id
      WHERE u.role = 'faculty' AND u.is_active ${userDept} ORDER BY u.full_name`),
  ]);

  return (
    <Shell user={user} active="/dashboard">
      <h1>Welcome, {user.full_name}</h1>
      <div className="grid" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{total}</b><span>Class offerings this term</span></div>
        <div className="stat"><b>{unassigned}</b><span>Without a faculty member</span></div>
        <div className="stat"><b>{unscheduled}</b><span>Without a schedule</span></div>
        <div className="stat"><b>{conflicts.length}</b><span>Schedule conflicts</span></div>
        <div className="stat"><b>{facultyCount}</b><span>Active faculty</span></div>
        <div className="stat"><b>{pending}</b><span>Credentials to verify</span></div>
      </div>
      {!term && <div className="alert warning">No active term is set. An administrator must set one under Terms.</div>}
      <div className="card">
        <div className="head">
          <h2>Faculty teaching load, {termLabel(term)}</h2>
          <a className="btn" href="/offerings">Manage class offerings</a>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Faculty</th><th className="num">Units</th><th className="num">Maximum</th><th style={{ width: '40%' }}>Load</th></tr></thead>
          <tbody>
            {loads.map((l) => (
              <tr key={l.id}>
                <td><a href={`/faculty/${l.id}`}>{l.full_name}</a></td>
                <td className="num">{num(l.units)}</td><td className="num">{num(l.max_units)}</td>
                <td><Bar percent={l.max_units > 0 ? (l.units / l.max_units) * 100 : 0} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </Shell>
  );
}
