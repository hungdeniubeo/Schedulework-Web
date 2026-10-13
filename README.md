<div align="center">

# ScheduleWork

**Weekly staff scheduling, without the spreadsheet chaos.**

A lightweight scheduling tool for small teams to collect availability, plan shifts, and keep everyone on the same page.

<p>
  <a href="https://schedulework-web.vercel.app/"><strong>Open Live App ↗</strong></a>
  &nbsp;·&nbsp;
  <a href="#features">Features</a>
  &nbsp;·&nbsp;
  <a href="#getting-started">Setup</a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Hosted_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel" />
</p>

</div>

---

## Overview

**ScheduleWork** streamlines the weekly scheduling process for a small team. Employees submit their availability, and administrators use that information to plan shifts in one place.

The project focuses on a straightforward workflow, a responsive interface, and practical tools for day-to-day scheduling.

## Features

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>For employees</h3>
      <ul>
        <li>Submit weekly availability</li>
        <li>Update availability before the deadline</li>
        <li>View assigned schedules</li>
        <li>Export schedules as JPG images</li>
        <li>Use the interface on desktop or mobile</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>For administrators</h3>
      <ul>
        <li>Manage employees, groups, positions, and shifts</li>
        <li>Open, lock, and archive availability weeks</li>
        <li>Review team availability in a single matrix</li>
        <li>Create schedules with drag-and-drop interactions</li>
        <li>Identify scheduling conflicts</li>
      </ul>
    </td>
  </tr>
</table>

## How it works

1. **Collect availability** — Employees submit the days and times they can work.
2. **Review requests** — Administrators review the team's availability for the week.
3. **Plan shifts** — Administrators assign shifts and check for conflicts.
4. **View the schedule** — Employees check their assigned shifts.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Backend & data | Supabase, PostgreSQL |
| Interactions | dnd-kit |
| Testing | Vitest |
| Deployment | Vercel |

## Getting started

### Prerequisites

- Node.js and npm
- A Supabase project with the project's database migrations applied

### 1. Clone the repository

```bash
git clone https://github.com/hungdeniubeo/Schedulework-Web.git
cd Schedulework-Web
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

Use your own Supabase project values. Never put a Supabase service-role key in client-side environment variables.

### 3. Start the development server

```bash
npm run dev
```

### 4. Run checks and build

```bash
npm test
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Project structure

```text
src/        Application interface and scheduling logic
supabase/   Database migrations and Edge Functions
tests/      Automated tests
docs/       Project documentation
```

## Project scope

- Designed for a small internal team of up to 20 employees.
- Uses employee and administrator roles.
- Accounts are managed internally; there is no public sign-up flow.
- Keeps the product focused on availability and shift scheduling rather than unnecessary workforce-management features.

## Security notes

- Apply the repository's Supabase migrations and Row Level Security policies when configuring a project.
- Keep privileged credentials, including `SUPABASE_SERVICE_ROLE_KEY`, on the server only.
- The frontend should use only the Supabase URL and publishable key.

---

<div align="center">

Built and maintained by [@hungdeniubeo](https://github.com/hungdeniubeo)

</div>
