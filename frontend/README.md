# SmartTrust Frontend Web Application

The responsive web interface for **SmartTrust – Dairy Plant Energy Consumption, Hygiene & Waste Tracking** (Problem ID: `DL-SJBIT-HK26-GOVP010`), built in React 18, Vite, Tailwind CSS, React Router, and Recharts.

---

## 1. Quick Start

Ensure Node.js 20+ is installed:

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The web application runs at `http://localhost:5173`.

To run component and role guard tests:
```bash
npm test
```

To build for production:
```bash
npm run build
```

---

## 2. Design System & Industrial UI Theme

- **Sidebar Background**: Deep Navy (`#0F2A43`)
- **App Surface Background**: Soft Cool Grey (`#F4F7FA`)
- **Primary Teal**: `#0E9AA7`
- **Warnings / Corrections**: Industrial Amber (`#F5A524`)
- **Critical / High Anomalies**: Deep Coral Red (`#D64545`)
- **Compliant / Approved**: Forest Mint Green (`#2E9E6B`)
- **Typography**: Inter (sans-serif), minimum 16px for form inputs on mobile
- **Cards**: Rounded 12px with subtle drop shadows
- **Icons**: `lucide-react` (Zap, Droplets, Recycle, Package, ShieldCheck, Bell)

---

## 3. Demo Accounts & Role Permissions

The login page includes one-click demo prefill buttons:

| Account | Email | Password | Role | Redirect Target |
| :--- | :--- | :--- | :--- | :--- |
| **Ramesh Kumar** | `employee@smarttrust.demo` | `Demo@1234` | `EMPLOYEE` | `/home` |
| **Priya Sharma** | `supervisor@smarttrust.demo` | `Demo@1234` | `SUPERVISOR` | `/dashboard` |
| **Vikram Malhotra** | `manager@smarttrust.demo` | `Demo@1234` | `MANAGER` | `/dashboard` |

### Permissions Enforcement
- **`EMPLOYEE`**: Sees only their personal submissions and recent logs. Submits energy, sanitation, production, and waste forms. Fixes records in `CORRECTION_REQUESTED`.
- **`SUPERVISOR`**: Accesses plant dashboard, approvals queue, alerts, and historical records. Approves, rejects, or requests corrections on submissions.
- **`MANAGER`**: Full plant oversight, user management, and master data administration (`/admin`). Confirms or dismisses anomaly alerts.

---

## 4. Component Inventory

```text
frontend/src/
├── api/
│   ├── client.js             # Unified fetch client, JWT handling, envelope parsing & mock fallback
│   └── mockData.js           # Deterministic data matching SQLite database seed
├── components/
│   ├── Sidebar.jsx           # Deep navy industrial navigation sidebar with user badge
│   ├── Navbar.jsx            # Top bar with operational shift indicator and alert badge
│   ├── RouteGuard.jsx        # Role-based route authorization & redirection
│   └── ConfirmModal.jsx      # Confirmation and review dialog with required comments
├── context/
│   ├── AuthContext.jsx       # Global user session, token storage & role utilities
│   └── ToastContext.jsx      # Success toasts, warning badges & error notifications
├── layouts/
│   └── AppLayout.jsx         # Layout wrapper with desktop sidebar & mobile bottom bar
├── pages/
│   ├── LoginPage.jsx         # Welcoming branding, credential inputs, demo prefill buttons
│   ├── EmployeeHomePage.jsx  # 4 big action cards, correction banners, recent entries
│   ├── DashboardPage.jsx     # KPI metrics, Recharts energy band, hygiene & waste charts
│   ├── ApprovalsPage.jsx     # Unified queue table, detail inspection drawer, decision dialog
│   ├── AlertsPage.jsx        # Severity badges, evidence inspector, manager review workflow
│   ├── RecordsPage.jsx       # Searchable historical tables & CSV/Excel preview table
│   ├── InsightsPage.jsx      # Prioritized root-cause recommendations
│   ├── AdminPage.jsx         # Master data CRUD (machines, users, products, schedules)
│   └── forms/
│       ├── EnergyFormPage.jsx     # Live delta calculation, rollback protection, machine picker
│       ├── HygieneFormPage.jsx    # Chemical titration, contact minutes, SOP checklist
│       ├── ProductionFormPage.jsx # Live loss % yield comparison with standard benchmarks
│       └── WasteFormPage.jsx      # Categorized loss incident logging with cause textarea
└── tests/
    ├── forms.test.jsx        # Form live calculation and input validation tests
    └── roleguards.test.jsx   # Role access control and redirection unit tests
```

---

## 5. Verification Checklist

- [x] **Login Page**: All 3 demo accounts log in with correct role routing (`EMPLOYEE` -> `/home`, `SUPERVISOR`/`MANAGER` -> `/dashboard`).
- [x] **Employee Home**: Big action cards, banner for `CORRECTION_REQUESTED`, recent submissions table.
- [x] **Energy Form**: Auto-calculates net consumption live, flags end reading < start reading.
- [x] **Hygiene Form**: Validates chemical concentration against schedule limits, verifies dwell time.
- [x] **Production Form**: Compares raw input vs actual output, flags elevated losses (>1.5× expected).
- [x] **Waste Form**: Records categorized losses (`SPILLAGE`, `REJECT`, `CLEANING_LOSS`) with root causes.
- [x] **Dashboard**: Live KPI cards, Recharts energy baseline band, hygiene bar chart, and waste breakdown.
- [x] **Approvals Queue**: Inspects records with drawer, handles Approve, Reject, and Request Correction with comments.
- [x] **Alerts**: Displays detected anomalies, shows raw evidence numbers, allows managers to Confirm or Dismiss.
- [x] **Spreadsheet Import**: Previews uploaded CSV/Excel files with validation feedback before commit.
- [x] **Mobile Responsiveness**: Sidebar collapses to hamburger and sticky bottom navigation on phones.
- [x] **Zero Fabricated Data**: Every metric maps directly to the SmartTrust schema and API contracts.
