# RosterDesk
### Smart Roster Management System

A web-based application for managing employee schedules, brand assignments and monthly rosters across multiple operational teams.

**DataStraw Tech Internship Assessment**

[Live Demo](YOUR_VERCEL_URL) · [GitHub Repository](YOUR_GITHUB_URL) · [Demo Video](YOUR_DEMO_VIDEO_URL)

---

## About the Project
<img width="947" height="443" alt="image" src="https://github.com/user-attachments/assets/63061d1a-4092-4282-944b-637d01ef5ffc" />

RosterDesk is a roster management application built to address the scheduling challenges faced by operations teams working across multiple brands and processes.

When employees handle different brands, have individual weekly offs and availability, and work under different process schedules, preparing a monthly roster manually can become difficult. Even a small change in employee availability can affect coverage across multiple processes.

I built RosterDesk to bring these operations into one place. It allows an operations manager to maintain workforce information, configure operating rules, generate monthly roster drafts, identify conflicts and make manual scheduling changes.

The main focus was to get the scheduling and validation logic right rather than build just another calendar interface.

## Features

**Workforce Management**
- Manage employees and their operational pods.
- Create and manage brands and processes.
- Assign employees to brands and specific processes.
- Support both dedicated and shared employee allocations.

**Operating Rules and Availability**
- Configure working days for individual brand-process combinations.
- Set minimum staffing requirements.
- Manage weekly offs, public holidays, planned leaves and comp-offs.
- Maintain employee availability.

**Monthly Roster Generation**
- Generate monthly roster drafts.
- Consider employee assignments and availability.
- Account for process-specific operating days.
- Prioritize employees who are not on their preferred weekly off.
- Consider existing workload during allocation.

**Conflict Detection**
- Detect assignments during approved leave or unavailability.
- Identify insufficient process coverage.
- Flag comp-off conflicts and scheduling overlaps.
- Separate hard constraints from soft preferences.

**Roster Views**
- Company-wide view.
- Pod-wise view.
- Brand-wise view.
- Process-wise view.
- Employee-wise view.

**Manual Editing**
- Make changes to generated roster allocations.
- Validate manual changes against scheduling constraints.
- Review and resolve conflicts.
- Prevent publication when hard conflicts remain.

---

## Tech Stack

| Technology | Usage |
|---|---|
| React | Frontend |
| TypeScript | Application logic and type safety |
| Vite | Development and build tooling |
| Bootstrap & CSS | Styling |
| Supabase | PostgreSQL database and backend services |
| Zustand | State management |
| React Router | Client-side routing |
| Lucide React | Icons |
| Vercel | Deployment |
| Git & GitHub | Version control |

## Application Structure

The application is built with React and TypeScript, with Supabase handling persistent data storage.

```text
RosterDesk
│
├── Frontend
│   ├── Dashboard
│   ├── Employee Management
│   ├── Brand Management
│   ├── Pod Management
│   ├── Availability
│   ├── Operating Rules
│   ├── Roster Management
│   └── Conflict Management
│
├── Supabase
│   ├── PostgreSQL Database
│   ├── Workforce Data
│   ├── Assignments
│   ├── Availability Records
│   └── Roster Data
│
└── Vercel
    └── Deployment
```

## Database Design

I used a relational structure to keep workforce information, operational requirements and roster data separate.

| Table | Purpose |
|---|---|
| `employees` | Employee details and active status |
| `pods` | Operational teams and pod information |
| `brands` | Brand records |
| `processes` | Operational process definitions |
| `brand_processes` | Processes associated with brands |
| `assignments` | Employee-to-brand/process assignments |
| `employee_availability` | Employee availability |
| `leaves` | Planned and approved leaves |
| `holidays` | Public holidays |
| `process_day_rules` | Process-specific operating rules |
| `rosters` | Monthly roster records |
| `roster_entries` | Generated roster entries |
| `roster_allocations` | Employee allocation records |
| `roster_conflicts` | Detected scheduling conflicts |

Keeping assignments separate from employees and brands allows the same employee to work across multiple operational responsibilities without hardcoding those relationships.

## How Roster Generation Works

The roster generator follows a deterministic scheduling approach.

**1. Load the required data**

The application retrieves employee assignments, brand-process configurations, operating rules, availability, weekly offs, leaves, comp-offs and holidays.

**2. Determine working days**

For each date in the selected month, the system checks which brand-process combinations are scheduled to operate and what staffing they require.

**3. Check employee eligibility**

Employees are evaluated against their assignments and availability.

Employees with hard constraints such as approved leave, explicit unavailability or applicable comp-offs are excluded from allocation.

**4. Allocate employees**

The scheduling logic prioritizes employees who are not on their preferred weekly off and considers workload when selecting eligible employees.

**5. Validate the roster**

The generated draft is checked for insufficient coverage, unavailable employees, scheduling overlaps and other constraint violations.

**6. Review and publish**

The manager can inspect the draft, make manual changes and revalidate it. Publishing is blocked while unresolved hard conflicts remain.

## Conflict Handling

I separated scheduling constraints into two categories.

| Type | Examples | Handling |
|---|---|---|
| Hard constraints | Approved leave, explicit unavailability, comp-offs, insufficient coverage | Must be resolved before publishing |
| Soft preferences | Preferred weekly offs | Can be overridden when operational coverage requires it |

For example, if an employee is responsible for all processes under a brand and becomes unavailable on a required working day, the system flags the affected coverage requirements rather than silently assigning an invalid roster.

For shared-resource brands, the remaining eligible employees are evaluated against the required process coverage.

---

## Sample Dataset

The application currently uses fictional sample data for demonstration.

| Entity | Count |
|---|---:|
| Employees | 32 |
| Brands | 25 |
| Pods | 4 |
| Processes | 5 |
| Brand-process relationships | 75 |
| Employee assignments | 78 |

The dataset includes both dedicated and shared brand assignments, employees working across processes and different availability scenarios.

---

## Running Locally

### Requirements
- Node.js and npm
- Git
- A Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/Klausk0/RosterDeck
cd RosterDeck
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use the Supabase project URL and public anon key. Never expose the service-role key in frontend code.

### 4. Start the development server

```bash
npm run dev
```

### 5. Create a production build

```bash
npm run build
```

## Environment Variables

An `.env.example` file is provided as a reference.

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

---

# Design Decisions — Assessment Questions

### 1. How did you model employees, brands, processes, pods, and their relationships?

I used separate relational tables for employees, brands, processes and pods.

The `brand_processes` table connects brands with the processes they operate, while `assignments` connects employees with their responsibilities.

This makes it possible for one employee to handle multiple processes under a brand, for multiple employees to share a brand, and for employees to work across different assignments.

I kept these relationships separate instead of hardcoding employee-brand combinations into the application.

### 2. How does your system generate a roster and determine whether it satisfies the required constraints?

The generator uses the selected month, employee assignments, process operating rules and availability information to prepare a roster.

It evaluates which processes require coverage on each date, checks employee eligibility and prioritizes employees based on weekly-off preferences and workload.

After generation, the application validates the roster for availability conflicts, scheduling overlaps and coverage gaps. Unresolved issues are recorded so that the manager can review them.

### 3. How did you handle the difference between single-resource brands and brands with multiple employees?

The assignment model supports both cases.

For a dedicated brand, one employee can be assigned to all the processes associated with that brand.

For shared brands, multiple employees can be assigned to different processes or share the same process.

The generator uses these assignments when evaluating eligible employees, so it does not assume that every brand follows the same staffing pattern.

### 4. What happens when an employee manages all processes for a brand but is unavailable on a required working day?

The employee is excluded from allocation when a hard availability constraint applies.

The validation logic identifies the affected processes and flags any resulting coverage gaps.

The manager can then inspect the issue and consider a reassignment or another resolution. The roster cannot be published while unresolved hard conflicts remain.

### 5. How does your system handle conflicting requirements or insufficient staffing?

I separated mandatory constraints from scheduling preferences.

Approved leave, explicit unavailability, comp-offs and required staffing coverage are treated as hard constraints. Weekly offs are treated as preferences that can be overridden when necessary.

The application records hard conflicts and soft warnings separately. This makes it easier for the manager to understand which issues must be resolved and which involve scheduling trade-offs.

### 6. Which parts of the process did you automate, and which did you leave under human control? Why?

Roster generation, employee eligibility checks and conflict detection are automated.

Manual reassignment, conflict review and final publication remain under the manager's control.

I chose this approach because scheduling can involve operational decisions that cannot always be resolved through automatic allocation alone. Automation reduces repetitive work, while the manager remains responsible for the final decision.

### 7. If the company doubled its team and brand count, what would you change about your solution?

I would first look at database query performance and the scheduling process.

Some improvements would include:
- Adding appropriate database indexes.
- Optimizing queries and batch operations.
- Moving larger roster-generation jobs to background processing.
- Improving the scheduling algorithm for larger datasets.
- Adding audit logs and role-based access.
- Separating scheduling and validation logic into more maintainable services.

### 8. If you had one additional week to work on this, what would you improve first?

I would focus on improving the scheduling logic, particularly backup employee recommendations when an assigned employee becomes unavailable.

I would also work on fairer weekly-off distribution, automated testing, roster change history and approval workflows.

These improvements would make the system more useful for an operations team beyond the initial demonstration.

---

## Limitations and Future Improvements

Some areas I would like to improve with more development time:

- Better backup employee recommendations.
- Fairer distribution of weekly offs.
- More advanced scheduling optimization.
- Roster change history and audit logs.
- Approval workflows for managers and pod leads.
- Exporting rosters to CSV and Excel.
- Automated regeneration after availability changes.
- More comprehensive automated testing.

## Security Note

The deployed application currently uses anonymous Supabase access for the internship demonstration so that evaluators can explore its features without signing in.

The database contains fictional demonstration data. This public configuration is not intended for production use with real employee information.

A production version would require authentication, role-based permissions and more restrictive Row Level Security policies.

---

## Closing Note

RosterDesk was a practical exercise in translating an operational problem into a working application.

The main challenge was not displaying employee schedules, but handling the relationships between brands, processes, assignments and availability while identifying situations where the required coverage could not be maintained.

Building this project helped me work through relational data modelling, frontend development, database integration and constraint-based scheduling in a practical setting.

**Built by Nishant Acharya**  
B.Tech — Computer Science, AI & Machine Learning
