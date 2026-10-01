<div align="center">

# ScheduleWork Web

**Internal workforce scheduling for availability, shift planning, and weekly publishing.**

React · TypeScript · Vite · Supabase · Vercel

</div>

## Overview

ScheduleWork Web is a lightweight scheduling app built for a small internal team. Employees submit availability, while admins review requests, build weekly schedules, check conflicts, and publish the final schedule.

## Features

### Employee
- Sign in with username and password.
- Submit and update weekly availability before the deadline.
- View published schedules.
- Export schedules as JPG.
- Responsive layout for desktop and mobile.

### Admin
- Manage employees, groups, positions, and shifts.
- Open, lock, reopen, and archive registration weeks.
- Review employee availability in one place.
- Build schedules with drag and drop.
- Detect scheduling conflicts and staffing issues.
- Publish official schedules.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Supabase PostgreSQL + Edge Functions
- **Auth:** Supabase Auth
- **Security:** PostgreSQL Row Level Security
- **Drag & Drop:** dnd-kit
- **Testing:** Vitest
- **Deployment:** Vercel / Cloudflare Pages

## Quick Start

```bash
git clone https://github.com/hungdeniubeo/Schedulework-Web.git
cd Schedulework-Web
npm install
npm run dev
```

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-key>
```

Production build:

```bash
npm run build
```

## Project Structure

```text
src/        React application
supabase/   Database migrations and Edge Functions
tests/      Application tests
docs/       Project documentation
```

## Notes

- Designed for one internal team of up to 20 employees.
- No public signup flow.
- Draft schedules are admin-only until published.
- Never expose Supabase service-role credentials in frontend environment variables.

## Maintainer

Maintained by [@hungdeniubeo](https://github.com/hungdeniubeo).
