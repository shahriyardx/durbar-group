# Durbar

Student management for a Discord-based course. Next.js 16 (Bun runtime),
better-auth with Discord-only login, Drizzle + Postgres, shadcn/ui on the
radix-nova preset themed after programming-hero.com.

## Roles

| Role          | Can do                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| `super_admin` | Everything. The first account ever created is promoted automatically.     |
| `admin`       | Import students, add instructors, assign students, manage roles.          |
| `instructor`  | Full control of their own Discord category, read their assigned students. |
| `student`     | Verify a course email, then get Discord access for their instructor.      |

## How verification works

A user's Discord email is never used to decide whether they are a student.
After signing in they submit their **course email**, which is matched against
`imported_student` — the student list an admin uploads from Excel. That table holds
no Discord state and no instructor link; it only answers "is this person
enrolled?". Assignment to an instructor is a separate, later admin action, and
`student_assignment` keys on `user.id`, not on an email.

## Discord model

Access is carried by **roles**, not per-user channel overwrites, so a category
never hits Discord's ~500-overwrite ceiling. Promoting a user to instructor
provisions:

- `instructor-<slug>` role — full access inside their category only
- `students-<slug>` role — read-only inside the category
- a category with `@everyone` denied `VIEW_CHANNEL`
- six channels: `announcements`, `task`, `session`, `discussion`, `resources`
  as text, and `help` as a **forum** so every question gets its own post
  (it ships with Unsolved / Solved tags). Only `discussion` and `help` re-open
  `SEND_MESSAGES` for the student role.

Teaching is a row in `instructor`, not a value of `role`. That means an admin
or super admin can run their own course without giving up admin rights —
`/admin/instructors` will offer any account that does not already have a
space. Only a plain student is lifted to the `instructor` role when granted
one, and only a plain instructor drops back to `student` when it is removed.

Because instructor roles carry zero guild-wide permissions, one instructor
cannot see another instructor's category.

Students are placed in the guild with the OAuth `guilds.join` scope, so no
invite link is needed. If an admin assigns an email that has not verified yet,
the grant is parked in `pending_assignment` and applied the moment that student
verifies.

## Setup

```bash
cp .env.example .env          # then fill in the Discord values
bun install
bun run db:up                 # Postgres 17 on localhost:5433
bun run db:migrate
bun run dev
```

Discord Developer Portal setup:

1. Create an application, add a bot, invite it to your guild with **Manage
   Roles** and **Manage Channels**.
2. Under OAuth2, add the redirect URL
   `http://localhost:3000/api/auth/callback/discord`.
3. Put the client id, client secret, bot token and guild id in `.env`.
4. Drag the bot's own role above every role it will create, otherwise Discord
   refuses the role assignments.

The first Discord account to sign in becomes `super_admin`.

## Screens

There is no login page — the landing page is where you sign in, and OAuth
failures land on `/error` with the actual reason and a retry button.

| Route                     | Who         | What                                                              |
| ------------------------- | ----------- | ----------------------------------------------------------------- |
| `/`                       | signed out  | Bengali landing page for the Durbar Group announcement            |
| `/verify`                 | signed in   | course-email form (Bengali)                                       |
| `/student`                | student     | their instructor + Discord channel deep links (Bengali)           |
| `/instructor`             | instructor  | counts, their channels, Discord link                              |
| `/instructor/students`    | instructor  | joined / not-joined tabs, export                                  |
| `/admin`                  | admin       | overview and shortcuts                                            |
| `/admin/students`         | admin       | Excel/CSV student import, searchable list                         |
| `/admin/instructors`      | admin       | promote, assign by pasted emails, revoke                          |
| `/admin/instructors/[id]` | admin       | per-instructor students, unassign, withdraw pending, re-sync      |
| `/admin/users`            | admin       | role changes and bans                                             |

The UI is dark-only. Student-facing screens are Bengali (Hind Siliguri); staff
screens are English.

## Student import

`/admin/students` accepts `.xlsx` or `.csv`. The header row is found by
scanning the first 20 rows for an email column, so a title banner above the
table is fine. `Full Name`, `E-Mail`, `Roll No`, `Batch` and `Mobile` all match
by alias; unmapped columns are kept in `imported_student.extra`. Rows upsert on
email using `coalesce`, so a partial re-upload updates what it carries and
never blanks what it omits. Invalid and duplicate rows are reported back rather
than silently dropped.

## Export

`GET /api/export/students?status=joined|not-joined|all&format=xlsx|csv`

Excel exports get separate Joined / Not joined sheets plus a Summary sheet;
CSV is written with a UTF-8 BOM so Bengali names survive Excel on Windows.
Instructors can only export their own students — passing another
`instructorId` is a 403. Admins can export anyone's.

## Layout

```
src/
  app/            routes (see the table above) + /api/export/students
  components/     app shell, landing sections, shadcn/ui
  db/schema/      auth.ts (better-auth tables), app.ts (students, instructors)
  lib/
    auth.ts       better-auth server config
    rbac.ts       requireUser / requireRole / requireVerifiedStudent
    discord/      REST client, permission bits, provisioning
  server/         student import, instructors, users, verification,
                  Discord sync, instructor view, export builders
```

Server actions call into `src/server/*`, and every one of them re-checks the
caller with `requireRole` — the UI disabling a button is never the guard.
