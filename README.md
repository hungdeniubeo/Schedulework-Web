<div align="center">

# ScheduleWork Web

### Plan availability. Build schedules. Publish with confidence.

A clean internal scheduling platform for small teams.

<p>
  <a href="https://schedulework-web.vercel.app/"><strong>Live App</strong></a>
  &nbsp;•&nbsp;
  <a href="#features">Features</a>
  &nbsp;•&nbsp;
  <a href="#getting-started">Getting Started</a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel" />
</p>

</div>

---

## About

**ScheduleWork Web** helps employees submit weekly availability and gives admins one place to review requests, build schedules, detect conflicts, and publish the final week.

Built for a small internal team with a simple employee/admin workflow.

## Features

| Employee | Admin |
| --- | --- |
| Submit weekly availability | Manage employees, groups, positions & shifts |
| Update availability before deadline | Open, lock & archive registration weeks |
| View published schedules | Review availability in one matrix |
| Export schedule as JPG | Build schedules with drag & drop |
| Responsive desktop/mobile UI | Detect conflicts & publish schedules |

## Tech Stack

`React 19` · `TypeScript` · `Vite` · `Supabase` · `PostgreSQL` · `dnd-kit` · `Vitest` · `Vercel`

## Getting Started

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

Build for production:

```bash
npm run build
```

## Structure

```text
src/        Application UI and scheduling logic
supabase/   Database migrations and Edge Functions
tests/      Application tests
docs/       Project documentation
```

## Scope & Security

- Built for one internal team of up to 20 employees.
- No public signup; accounts are managed internally.
- Draft schedules stay private until published.
- Sensitive Supabase credentials remain server-side.

---

<div align="center">

Maintained by [@hungdeniubeo](https://github.com/hungdeniubeo)

</div>
