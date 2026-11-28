# Intelligent Class Schedule Management System (Next.js version)

Web-based class scheduling for higher education institutions, with faculty profiling,
qualification-based subject assignment, automated conflict detection, room capacity checking,
and role-based access control. Branded for Zamboanga Peninsula Polytechnic State University.

This is the Node.js version of the PHP system. The features and rules are the same.

**Built with:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (`pg` driver), bcryptjs.
No UI framework and no ORM: plain SQL, so every query can be read and explained.

---

## 1. Run it on your computer

You need **Node.js 20.9 or later** (nodejs.org, LTS version) and a **PostgreSQL database**.
The easiest database is a free **Neon** project (neon.com), so you do not have to install PostgreSQL.
A local PostgreSQL installation also works.

1. Create a Neon project. On its dashboard click **Connect** and copy the connection string.
2. In the project folder, copy `.env.example` to a new file named `.env.local` and paste the
   connection string after `DATABASE_URL=`.
3. Open a terminal in the project folder and run:

   ```
   npm install
   npm run db:setup
   npm run dev
   ```

   `db:setup` creates the tables and loads the sample data. **Running it again erases all data.**
4. Open http://localhost:3000

## 2. Put it online with Vercel

1. Put the project on GitHub. `.env.local` is listed in `.gitignore`, so your password is not uploaded.
2. At vercel.com click **Add New > Project** and import the repository. Vercel detects Next.js by itself.
3. Add the database, either way:
   - **Easiest:** in the Vercel project open **Storage** (or the **Marketplace**), choose **Neon**, and
     connect it to the project. Vercel sets `DATABASE_URL` for you.
   - **Or** open **Settings > Environment Variables** and add `DATABASE_URL` with your Neon connection string.
4. Load the tables into that database, either way:
   - Put the same `DATABASE_URL` in your `.env.local` and run `npm run db:setup`, or
   - open the **SQL Editor** in the Neon console, paste and run `db/schema.sql`, then `db/seed.sql`.
5. **Deploy** (or Redeploy if the first build ran before the database was added), open the site, and log in.
6. **Change every sample password right away** (My Account, and Users for the other accounts).
   The site is public and the sample passwords are written in this file.

## Sample accounts

| Role          | Username                                              | Password     |
|---------------|-------------------------------------------------------|--------------|
| Administrator | `admin`                                               | `admin123`   |
| Program Chair | `chair` (College of Computer Studies)                 | `chair123`   |
| Faculty       | `jcruz`, `areyes`, `rgarcia`, `lmendoza`, `pbautista` | `faculty123` |

## What each role can do

| Feature                                   | Admin | Chair (own department) | Faculty (self only) |
|-------------------------------------------|:-----:|:----------------------:|:-------------------:|
| Users, departments, rooms, terms          | yes   |                        |                     |
| Matching weights                          | yes   |                        |                     |
| Fields of study list                      | yes   | yes                    |                     |
| Subjects and teaching requirements        | yes   | yes                    |                     |
| Sections                                  | yes   | yes                    |                     |
| Verify degrees and certifications         | yes   | yes                    |                     |
| Employment details and maximum load       | yes   | yes                    |                     |
| Class offerings, matching, assignment     | yes   | yes                    |                     |
| Scheduling and conflict report            | yes   | yes                    |                     |
| Edit profile: degrees, certifications, history, availability | yes | yes | yes |
| View weekly schedule                      | all   | all                    | own                 |

Access is checked on the server by **every page and every server action**
(`requireRole()` and `canManageDept()` in `lib/auth.ts`), not only by hiding menu items.
Server actions are public endpoints, so each one checks the user again.

## Printed forms

- **Faculty Teaching Load**: Timetables, then Print.
- **Individual Daily Program (IDP)**: Timetables (faculty view), then *Individual Daily Program*. Prints landscape on long bond.
  Official time comes from the faculty member's availability; the number of students comes from the class list when one was entered.
- **List of Students (class list)**: Class Offerings, then *Class list* (faculty open it from My Schedule). Paste one student per
  line as `SURNAME, First Name MI`, save, then Print (A4). Only the admin and the department chair can edit it;
  the assigned faculty member can view and print it.

The letterhead lines and signatories of all three forms are set by the administrator under Settings.
The class-list table is created automatically the first time it is used, so an existing database does not need `db:setup` again.

## Typical workflow

1. **Admin**: add departments, rooms, the term, and user accounts.
2. **Faculty**: fill in the profile (degrees, certifications, subjects taught, availability).
3. **Chair**: verify the degrees and certifications, and set each subject's requirements
   (minimum degree, accepted degree fields).
4. **Chair**: under Class Offerings, offer subjects to sections, then click **Match faculty**
   (or **Auto-assign**) to assign by qualification.
5. **Chair**: click **Schedule** to set meetings. The system blocks conflicts and suggests free slots.

## How faculty matching works (`lib/matching.ts`)

Each faculty member gets three scores from 0 to 100 for a subject:

| Part        | How it is computed                                                                   | Default weight |
|-------------|---------------------------------------------------------------------------------------|:--------------:|
| Degree      | Best verified degree in an accepted field: bachelor's 70, master's 85, doctorate 100 | 40 |
| Credentials | Verified certifications, licenses, trainings: one = 70, two or more = 100            | 15 |
| Experience  | Terms the subject was taught (up to 4) 70%, years of teaching (up to 10) 30%         | 15 |

Match score = weighted average of the parts. Weights are editable under Settings.

A faculty member is **not eligible**, whatever the score, when:

- they have no verified degree at the subject's minimum level,
- the subject would push them over their maximum teaching load, or
- they already teach another class at a time this class meets.

## How conflict detection works (`lib/conflict.ts`)

Two meetings on the same day overlap when `startA < endB AND endA > startB`.
A meeting is rejected when an overlapping meeting in the same term uses the same
**room**, the same **faculty member**, or the same **section**.

**Room capacity** is also a hard rule: each class offering records its number of enrolled students
(it starts as the section size and can be edited), and a meeting is rejected when
`enrolled > room capacity`. The enrolled count cannot be raised above the capacity of a room the
class already uses, and suggested slots only use rooms with enough seats.

Saved with a warning (not blocked): wrong room type (lecture vs laboratory), time outside the
faculty member's stated availability.

While a meeting is saved, the term's row is locked (`SELECT ... FOR UPDATE`), so two people
saving at the same moment cannot create a double booking.

The Conflict Report page rescans the whole term and also lists overloaded faculty
and classes that still lack a faculty member or weekly hours.

## Folder structure

```
app/                         one folder per page (Next.js App Router)
  login/                     login page and form
  dashboard/                 dashboards for staff and faculty
  faculty/, faculty/[id]/    faculty list and faculty profile
  subjects/                  subjects and teaching requirements
  offerings/                 class offerings
  offerings/[id]/match/      ranked faculty for one class
  offerings/[id]/schedule/   meetings, conflict checking, suggested slots
  timetable/, conflicts/     weekly grids and the conflict report
  users/, departments/, rooms/, sections/, terms/, settings/, lookups/, account/
actions/                     server actions: every form submits to one of these
  auth.ts                    login, logout, change password
  profile.ts                 faculty profile changes and credential verification
  subjects.ts, offerings.ts, admin.ts, crud.ts
lib/
  db.ts                      PostgreSQL connection and the safe `sql` query builder
  auth.ts                    sessions, flash messages, role checks
  matching.ts                qualification scoring and ranking
  conflict.ts                conflict detection, capacity rule, slot suggestions
  crud.ts                    definitions for the simple add / edit / delete screens
  constants.ts, format.ts
components/                  page frame (Shell), shared buttons and widgets
db/schema.sql, db/seed.sql   tables and sample data
scripts/setup-db.mjs         runs schema.sql and seed.sql (npm run db:setup)
public/logo.jpg              school seal
```

## Security measures

- Passwords stored with bcrypt; login pauses for a minute after 5 failed attempts on an account
- Every query uses numbered parameters through the `sql` tag (no SQL injection)
- Sessions: a random token in an httpOnly cookie; only its SHA-256 hash is stored in the database;
  sessions end after 8 hours without activity; a disabled account is logged out at once
- Server actions are protected against cross-site form posts by Next.js (Origin check)
- React escapes all output (no cross-site scripting through names or titles)
- The database password lives in environment variables, never in the code

## Differences from the PHP version

- MySQL became PostgreSQL. `ENUM` columns became `CHECK` constraints, and `is_active` is a real boolean.
- Each form posts to a **server action** instead of back to the same `.php` file.
- Messages such as "Subject saved." are carried in a short-lived cookie instead of the PHP session.
- Ranking faculty runs a fixed handful of queries for all faculty at once, and suggested slots are
  checked in memory, so pages stay fast on a cloud database.
