# FinanceFlow — Manual Test Cases

> **Application:** FinanceFlow (FINNECT Finance OS extension)  
> **Document version:** 1.0  
> **Last updated:** August 2026  
> **Purpose:** End-to-end manual QA for UI, UX, mobile, backend behaviour, and cross-page data reflection.

---

## How to use this document

| Column / symbol | Meaning |
|-----------------|--------|
| **ID** | Unique test case reference (e.g. `AUTH-01`) |
| **Priority** | P0 = release blocker, P1 = important, P2 = nice-to-have |
| **Role** | Owner, Agent, or Both |
| **Pass / Fail** | Mark during test run |
| **Notes** | Bugs, screenshots, environment quirks |

**Recommended order:** Environment → Auth → Global UI → Owner flows → Agent flows → Integration (reflection) → Mobile → Backend API smoke.

---

## 1. Test environment

### 1.1 Prerequisites

| Step | Action | Expected |
|------|--------|----------|
| ENV-01 | `docker compose up -d` in `FINNECT-Finance-OS/` | Postgres healthy on port **5433** |
| ENV-02 | Backend: `python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000` | API at http://127.0.0.1:8000, `/docs` loads |
| ENV-03 | Frontend: `cd frontend && npm run dev` | App at http://localhost:5173 |
| ENV-04 | Seed demo data (`scripts/fresh_seed.py` or existing DB) | Owner + Kumar agent exist with loans |

### 1.2 Demo credentials

| Role | Tab | Email | Password |
|------|-----|-------|----------|
| Owner | Owner | `owner@financeflow.demo` | `Owner@12345` |
| Agent (Kumar) | Agent | `kumar@financeflow.demo` | `Agent@12345` |
| Manager (optional) | Agent | `manager@financeflow.demo` | `Manager@12345` |

### 1.3 Test devices / viewports

| Viewport | Width | Use for |
|----------|-------|---------|
| Desktop | ≥ 1024px | Full sidebar, tables |
| Tablet | 768–1023px | Layout transition |
| Mobile | 320–767px | Hamburger menu, scroll, touch |

**Browsers:** Chrome (primary), Edge or Firefox (secondary).

---

## 2. Global UI & UX

### 2.1 Layout & navigation

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| UI-01 | P0 | Both | Login as Owner | Sidebar shows owner nav items; no "My Settlement" |
| UI-02 | P0 | Agent | Login as Kumar | Sidebar shows agent items including My Settlement, Account; no owner-only pages |
| UI-03 | P0 | Both | Click each sidebar link | Correct page loads; active link highlighted |
| UI-04 | P0 | Both | Navbar title | Matches current page (Dashboard, Collections, etc.) |
| UI-05 | P0 | Both | Navbar | **No Logout button** in header |
| UI-06 | P0 | Both | Navbar bell icon | Notification bell visible; unread badge when applicable |
| UI-07 | P1 | Both | Open notification dropdown | Recent notifications; "Mark read" works; count decreases |
| UI-08 | P1 | Owner | Bell → View all | Navigates to Audit page |
| UI-09 | P1 | Agent | Bell → View all | Navigates to Account/Settings |
| UI-10 | P0 | Both | Settings / Account → Log out | Session cleared; redirected to login |
| UI-11 | P0 | Both | Visit `/dashboard` without token | Redirect to login |
| UI-12 | P0 | Agent | Direct URL `/agent-settlements` | Blocked or owner-only route rejects agent |

### 2.2 Mobile responsiveness

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| MOB-01 | P0 | Both | Mobile width: open app | Sidebar hidden; hamburger visible |
| MOB-02 | P0 | Both | Tap hamburger | Sidebar drawer opens; overlay behind |
| MOB-03 | P0 | Both | Tap overlay / X | Drawer closes |
| MOB-04 | P0 | Both | Navigate via mobile menu | Drawer closes after link tap |
| MOB-05 | P1 | Both | Scroll long page (Dashboard, Loans table) | **Only main content scrolls**; sidebar/header stay fixed |
| MOB-06 | P1 | Both | Horizontal tables (Collections, Agents) | Table scrolls horizontally inside container; no page-wide horizontal scroll |
| MOB-07 | P1 | Both | Tap buttons / form fields | Adequate touch targets; no mis-taps |
| MOB-08 | P2 | Both | Rotate portrait ↔ landscape | Layout reflows; no broken overflow |
| MOB-09 | P1 | Both | Notification dropdown on mobile | Panel fits screen; scrollable list |
| MOB-10 | P1 | Agent | Settlement 3-step form on mobile | Steps usable; inputs full width |

### 2.3 Loading, errors & feedback

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| UX-01 | P1 | Both | Slow network (throttle) | Page shows loading state; no blank flash |
| UX-02 | P1 | Both | API failure (stop backend) | Error message + retry where implemented |
| UX-03 | P1 | Both | Invalid form submit | Inline validation / error message |
| UX-04 | P1 | Both | Successful save (settings, payment) | Success feedback visible |
| UX-05 | P2 | Both | Currency display | Amounts formatted consistently (₹, 2 decimals) |

---

## 3. Authentication

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| AUTH-01 | P0 | Owner | Owner tab, valid credentials | Login success → Dashboard |
| AUTH-02 | P0 | Agent | Agent tab, Kumar credentials | Login success → Dashboard |
| AUTH-03 | P0 | Both | Wrong password | Error message; no login |
| AUTH-04 | P0 | Owner | Owner email on Agent tab | Login fails |
| AUTH-05 | P1 | Both | Refresh page while logged in | Session persists |
| AUTH-06 | P1 | Both | Logout → back button | Does not re-enter app without login |

---

## 4. Dashboard (`/dashboard`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| DASH-01 | P0 | Owner | Open Dashboard | Capital, Profit, Lending, **Agent settlements** cards load |
| DASH-02 | P0 | Owner | Check settlement cards | Unsettled with agents, Pending count, Pending ₹ shown |
| DASH-03 | P1 | Owner | Click settlement cards | Navigates to Agent Settlements |
| DASH-04 | P1 | Owner | Quick actions | Add Capital, New Loan, Collect Payment navigate correctly |
| DASH-05 | P1 | Owner | Finance overview numbers | Match Capital / Profit pages (approx.) |
| DASH-06 | P1 | Agent | Agent dashboard | Expected today, collected, pending, wallet summary |
| DASH-07 | P2 | Owner | Legacy stats + recent tables | Loans/payments tables render |

---

## 5. Collections (`/collections`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| COL-01 | P0 | Agent | View today's list | Only Kumar-assigned borrowers shown |
| COL-02 | P0 | Agent | Record Cash payment | Success; amount reflects in list |
| COL-03 | P0 | Agent | Record UPI payment | UPI reference required; success |
| COL-04 | P1 | Agent | Multi-installment payment | Select schedules; amount auto-sum; pay |
| COL-05 | P1 | Agent | Pay future installment (strict date) | Validates schedule dates |
| COL-06 | P0 | Owner | Owner collects payment | `collected_by_agent_id` null; no agent wallet credit |
| COL-07 | P1 | Agent | After collection | Owner notification: "Collection recorded" |
| COL-08 | P1 | Agent | Wallet after collection | Cash/UPI balance increased on My Settlement |

---

## 6. My Settlement — Agent (`/settlements`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| SET-A01 | P0 | Agent | Open My Settlement | Wallet balances, ledger, history visible |
| SET-A02 | P0 | Agent | Submit settlement Step 1 | Clear from Cash/UPI/Other; total shown |
| SET-A03 | P0 | Agent | Step 2: Delivery UPI | UPI delivery selected |
| SET-A04 | P0 | Agent | Step 3 without UPI ref | Validation error |
| SET-A05 | P0 | Agent | Cross-channel: clear Cash, deliver UPI + ref | Submit success |
| SET-A06 | P0 | Agent | While pending | Amber banner; Submit disabled |
| SET-A07 | P0 | Agent | Second submit while pending | API/UI blocks duplicate |
| SET-A08 | P1 | Agent | Settlement history | Status PENDING_VERIFICATION shown |
| SET-A09 | P1 | Agent | After owner approves | Wallet debited; ledger SETTLEMENT debit; notification |
| SET-A10 | P1 | Agent | After owner rejects | Wallet unchanged; rejection notification |

---

## 7. Agent Settlements — Owner (`/agent-settlements`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| SET-O01 | P0 | Owner | Pending table after agent submit | Agent name, Clearing from, Received via, Total |
| SET-O02 | P0 | Owner | Approve settlement | Success; removed from pending |
| SET-O03 | P0 | Owner | After approve | Agent unsettled ↓; reconciliation unsettled ↓ |
| SET-O04 | P0 | Owner | Reject with reason | Status REJECTED; agent notified |
| SET-O05 | P1 | Owner | Agent list | Unsettled + Pending columns correct |
| SET-O06 | P1 | Owner | Settlement history | Completed/rejected entries listed |
| SET-O07 | P1 | Owner | Notification on submit | Bell + Audit: settlement pending |

---

## 8. Customers (`/customers`, `/customers/:id/ledger`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| CUST-01 | P0 | Owner | List customers | All borrowers visible |
| CUST-02 | P1 | Owner | Create customer | New row appears |
| CUST-03 | P1 | Owner | Edit customer | Changes persist |
| CUST-04 | P1 | Owner | Open customer ledger | Ledger page loads |
| CUST-05 | P2 | Owner | Delete customer (if allowed) | Confirm + remove or soft rule |

---

## 9. Loans (`/loans`, `/loans/:loanId`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| LOAN-01 | P0 | Owner | List loans | Active loans with amounts |
| LOAN-02 | P0 | Owner | Create daily-collection loan | Frequency, installment count, due start date |
| LOAN-03 | P0 | Owner | Create loan exceeding capital | Validation error |
| LOAN-04 | P1 | Owner | Loan detail page | Schedule, payments, status |
| LOAN-05 | P1 | Owner | Settle loan modal | Preview + settlement amount |
| LOAN-06 | P1 | Owner | Close loan via settlement | Status CLOSED |
| LOAN-07 | P1 | Agent | Agent loan access | Per permissions only |

---

## 10. Payments (`/payments`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| PAY-01 | P0 | Owner | List payments | Historical payments with amounts |
| PAY-02 | P1 | Owner | Payment detail / loan filter | Correct loan linkage |
| PAY-03 | P1 | Owner | Delete payment (if enabled) | Balances/schedules revert per rules |

---

## 11. Capital (`/capital`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| CAP-01 | P0 | Owner | View capital summary | Added, available, lent |
| CAP-02 | P0 | Owner | Add capital | Balance increases; ledger entry |
| CAP-03 | P1 | Owner | Withdraw capital | Balance decreases; notification |
| CAP-04 | P1 | Owner | Withdraw over available | Error message |

---

## 12. Profit (`/profit`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| PROF-01 | P0 | Owner | View profit summary | Available profit, earned |
| PROF-02 | P1 | Owner | Withdraw profit | Notification; balance ↓ |
| PROF-03 | P1 | Owner | Reinvest profit to capital | Profit ↓, capital ↑; notification |
| PROF-04 | P1 | Owner | Transaction list | Recent profit movements |

---

## 13. Ledgers (`/ledgers`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| LED-01 | P0 | Owner | Business ledger | Capital + profit entries merged, sorted |
| LED-02 | P1 | Owner | After payment | Principal recovery + profit recognition entries |
| LED-03 | P1 | Owner | After expense | Expense debit in profit ledger |
| LED-04 | P1 | Owner | After settlement approve | Agent ledger (separate page) shows debit |

---

## 14. Expenses (`/expenses`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| EXP-01 | P0 | Owner | List expenses | Categories and amounts |
| EXP-02 | P0 | Owner | Create expense from **Profit** | Profit ↓; notification |
| EXP-03 | P0 | Owner | Create expense from **Capital** | Capital ↓; notification |
| EXP-04 | P1 | Owner | Expense over available balance | Error |

---

## 15. Defaults (`/defaults`) — Owner only

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| DEF-01 | P0 | Owner | Overdue loans list | Pending amounts correct |
| DEF-02 | P1 | Owner | Mark defaulted | Loan status updated; notification |
| DEF-03 | P1 | Owner | Write off loan | Write-off record; notification |

---

## 16. Reports (`/reports`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| REP-01 | P1 | Owner | Financial summary | Totals load |
| REP-02 | P1 | Owner | Collections report | Day-wise data |
| REP-03 | P1 | Owner | Portfolio report | Active/overdue counts |
| REP-04 | P2 | Owner | Export transactions CSV | File downloads; opens in Excel |

---

## 17. Reconciliation (`/reconciliation`) — Owner only

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| REC-01 | P0 | Owner | Open page | Capital, profit, unsettled, pending settlement cards |
| REC-02 | P0 | Owner | With unsettled agents | Amber status; notes mention settlements |
| REC-03 | P0 | Owner | After all agents settled | Green balanced when unsettled=0 and pending=0 |
| REC-04 | P1 | Owner | Numbers vs Dashboard | Unsettled/pending match |

---

## 18. Audit (`/audit`) — Owner only

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| AUD-01 | P1 | Owner | Notifications list | All owner-targeted notifications |
| AUD-02 | P1 | Owner | Mark read | `is_read` updates |
| AUD-03 | P1 | Owner | Audit log | SETTLEMENT_SUBMITTED, APPROVED, EXPENSE_CREATED, etc. |
| AUD-04 | P1 | Owner | After agent action | Actor type agent in log |

---

## 19. Manage Agents (`/agents`) — Owner only

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| AGT-01 | P0 | Owner | List agents | Kumar + unsettled/pending columns |
| AGT-02 | P0 | Owner | Create agent | Login works with permissions |
| AGT-03 | P0 | Owner | Assign borrowers to Kumar | Collections show assigned only |
| AGT-04 | P1 | Owner | Edit agent / deactivate | Changes apply |
| AGT-05 | P1 | Owner | Unassign borrower | Agent no longer sees in collections |

---

## 20. Renewals (`/renewals`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| REN-01 | P1 | Owner | View renewals | Eligible loans listed |
| REN-02 | P1 | Owner | Create renewal | New loan linked; capital rules apply |

---

## 21. Settings / Account (`/settings`)

| ID | Priority | Role | Steps | Expected result |
|----|----------|------|-------|-----------------|
| SETT-01 | P0 | Owner | Finance settings form | Load + save business defaults |
| SETT-02 | P0 | Both | Notifications section | Full list; mark read |
| SETT-03 | P0 | Both | Account + Log out | Works from here only |
| SETT-04 | P1 | Agent | Account page | No business form; notifications + logout |
| SETT-05 | P1 | Owner | Invalid settings save | Error displayed |

---

## 22. Cross-page reflection (integration flows)

These verify that **one action updates every dependent screen**.

### 22.1 Collection → wallet → settlement → approve

| Step | Action | Verify on |
|------|--------|-----------|
| 1 | Agent collects ₹120 Cash for Ravi | Collections: paid; Agent wallet +₹120 cash |
| 2 | Owner bell | Notification "Collection recorded" |
| 3 | Agent My Settlement | Cash balance includes ₹120 |
| 4 | Agent submits: clear Cash, deliver UPI + ref | Pending banner; owner pending table |
| 5 | Owner Dashboard | Pending count ≥ 1 |
| 6 | Owner Reconciliation | Pending settlement ₹ matches |
| 7 | Owner Agents page | Pending column for Kumar |
| 8 | Owner approves | Pending clears everywhere |
| 9 | Agent wallet | Cash −₹120; ledger debit with delivery note |
| 10 | Owner unsettled | Total unsettled ↓ by ₹120 |
| 11 | Agent notification | Settlement approved |

### 22.2 Loan disbursement → capital

| Step | Action | Verify on |
|------|--------|-----------|
| 1 | Note available capital | Capital page + Dashboard |
| 2 | Create new ₹10,000 loan | Capital available ↓ ₹10,000 |
| 3 | Ledgers | Capital disbursement entry |
| 4 | Reconciliation | Capital lent ↑ |

### 22.3 Payment → profit & principal

| Step | Action | Verify on |
|------|--------|-----------|
| 1 | Record ₹120 daily payment | Loan schedule paid |
| 2 | Profit page | Available profit ↑ (profit portion) |
| 3 | Capital page | Available capital ↑ (principal portion) |
| 4 | Ledgers | Principal recovery + profit recognition |
| 5 | Dashboard profit today | Increases |

### 22.4 Expense funding source

| Step | Action | Verify on |
|------|--------|-----------|
| 1 | Expense ₹500 from Profit | Profit ↓; not capital |
| 2 | Expense ₹500 from Capital | Capital ↓; not profit |
| 3 | Net profit summary | Expenses reflected |

### 22.5 Settlement reject → retry

| Step | Action | Verify on |
|------|--------|-----------|
| 1 | Owner rejects settlement | Agent notification with reason |
| 2 | Agent wallet | Unchanged |
| 3 | Agent can submit again | Submit enabled; no duplicate block |

---

## 23. Backend API test cases

Use **Swagger** (`http://127.0.0.1:8000/docs`) or curl/Postman. Obtain JWT via owner/agent login endpoints.

### 23.1 Auth

| ID | Endpoint | Method | Test | Expected |
|----|----------|--------|------|----------|
| API-A01 | `/finance-owners/login` | POST | Valid owner body | 200 + `access_token` |
| API-A02 | `/agents/login` | POST | Valid agent body | 200 + token |
| API-A03 | `/agents/session` | GET | With Bearer token | Session info + permissions |
| API-A04 | Any protected route | GET | No token | 401 |

### 23.2 Capital & profit

| ID | Endpoint | Method | Test | Expected |
|----|----------|--------|------|----------|
| API-C01 | `/capital/summary` | GET | Owner token | Balances |
| API-C02 | `/capital/add` | POST | Valid amount | 201; balance ↑ |
| API-C03 | `/capital/withdraw` | POST | Over balance | 400 |
| API-P01 | `/profit/summary` | GET | Owner token | Profit totals |
| API-P02 | `/profit/withdraw` | POST | Valid | Notification created |
| API-P03 | `/profit/reinvest` | POST | Valid | Capital + profit move |

### 23.3 Loans & payments

| ID | Endpoint | Method | Test | Expected |
|----|----------|--------|------|----------|
| API-L01 | `/loans/` | POST | Daily loan payload | 201; schedule generated |
| API-L02 | `/loans/` | POST | Insufficient capital | 400 |
| API-PAY01 | `/payments/` | POST | Agent token, daily loan | Wallet credited |
| API-PAY02 | `/payments/preview` | GET | Multi schedule | Allocation preview |
| API-PAY03 | `/payments/` | POST | UPI without reference | 400 if required |

### 23.4 Agent wallet & settlements

| ID | Endpoint | Method | Test | Expected |
|----|----------|--------|------|----------|
| API-W01 | `/agent-wallet/me` | GET | Agent token | Balances + pending flags |
| API-W02 | `/agent-wallet/me/dashboard` | GET | Agent token | Today summary |
| API-S01 | `/agent-settlements/` | POST | Valid cross-channel | 201 PENDING |
| API-S02 | `/agent-settlements/` | POST | UPI delivery no ref | 400 |
| API-S03 | `/agent-settlements/` | POST | Second while pending | 400 |
| API-S04 | `/agent-settlements/pending` | GET | Owner token | List |
| API-S05 | `/agent-settlements/{id}/approve` | POST | Owner | COMPLETED; wallet debit |
| API-S06 | `/agent-settlements/{id}/reject` | POST | Owner + reason | REJECTED |

### 23.5 Extended / notifications

| ID | Endpoint | Method | Test | Expected |
|----|----------|--------|------|----------|
| API-N01 | `/notifications` | GET | Owner token | Owner notifications only |
| API-N02 | `/notifications` | GET | Agent token | Agent-targeted only |
| API-N03 | `/notifications/count` | GET | Both | `unread_count` |
| API-N04 | `/notifications/{id}/read` | POST | Valid id | `is_read: true` |
| API-R01 | `/ledger/reconciliation` | GET | Owner | unsettled + pending fields |
| API-E01 | `/expenses` | POST | Profit funding | 201 + notification |

### 23.6 Permissions

| ID | Test | Expected |
|----|------|----------|
| API-SEC01 | Agent calls `/agent-settlements/pending` | 403 or owner-only reject |
| API-SEC02 | Agent calls `/audit/logs` | 403 |
| API-SEC03 | Agent with only collections | Cannot access capital endpoints |

---

## 24. Data integrity rules (backend)

| ID | Rule | How to verify |
|----|------|----------------|
| DATA-01 | Principal recovery increases available capital | Payment → capital summary |
| DATA-02 | Profit recognition increases available profit | Payment → profit summary |
| DATA-03 | Loan disbursement decreases available capital | New loan → capital |
| DATA-04 | Agent wallet = sum of channel balances | Wallet API vs ledger |
| DATA-05 | Settlement approve debits **source** channels only | Not delivery channel |
| DATA-06 | Pending settlement does not debit wallet until approve | Wallet unchanged while pending |
| DATA-07 | One pending settlement per agent | Second POST fails |
| DATA-08 | Collection frequency schedules | WEEKLY/BI_WEEKLY/MONTHLY dates correct |

---

## 25. Regression checklist (pre-release)

| Area | P0 tests |
|------|----------|
| Login / logout | AUTH-01–03, UI-10 |
| Collections + wallet | COL-02, COL-08 |
| Settlement E2E | SET-A05, SET-O02, Section 22.1 |
| Notifications | UI-06, SET-O07, COL-07 |
| Mobile menu | MOB-01–04 |
| Scroll | MOB-05–06 |
| Capital / profit math | CAP-02, PROF-02, Section 22.2–22.3 |
| Permissions | UI-12, API-SEC01–03 |

---

## 26. Test execution log (template)

Copy per release:

```markdown
## Release: ______  Date: ______  Tester: ______

| ID | Pass | Fail | Notes |
|----|------|------|-------|
| AUTH-01 | | | |
| ... | | | |

**Blockers:**  
**Sign-off:** Pass / Fail with conditions
```

---

## 27. Known limitations (document, not bugs)

- Owner capital/profit ledger does **not** auto-credit on settlement approve (cash in hand model); agent wallet + unsettled totals are the source of truth for agent cash.
- Notifications are in-app only (no push/email/WhatsApp).
- Simulator removed from product.
- Automated E2E suite may exist in `scripts/full_e2e_test.py`; this document is for **manual** QA.

---

## 28. Quick smoke (15 minutes)

1. Owner login → Dashboard loads  
2. Agent login → Collect ₹120 cash  
3. Agent → Submit settlement (UPI delivery + ref)  
4. Owner → Bell shows notification → Approve settlement  
5. Owner → Reconciliation unsettled ↓  
6. Agent → Notification approved → Wallet ↓  
7. Mobile width → Menu + scroll one table  
8. Settings → Logout  

If all pass, core path is healthy.

---

*End of test cases.*
