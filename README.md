<h1 align="center">
  FINNECT Finance OS
</h1>

<p align="center">
  <strong>A Modern Full-Stack Loan Management System for Finance Businesses</strong>
</p>

<p align="center">
Built with <strong>FastAPI</strong>, <strong>React</strong>, <strong>TypeScript</strong>, <strong>PostgreSQL</strong>, and <strong>SQLAlchemy</strong>
</p>

<p align="center">

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-ORM-D71F00?style=for-the-badge)
![JWT](https://img.shields.io/badge/JWT-Authentication-000000?style=for-the-badge)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)

</p>

---

# 🌐 Live Demo

| Application | URL |
| :---------- | :-- |
| Frontend | https://finnect-finance-os.vercel.app |
| Backend API | https://finnect-backend-hrq8.onrender.com |
| Swagger Docs | https://finnect-backend-hrq8.onrender.com/docs |

---

# 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Application Screenshots](#-application-screenshots)
- [Business Problem](#-business-problem)
- [Solution](#-solution)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Core Modules](#-core-modules)
- [Database Design](#-database-design)
- [Business Workflow](#-business-workflow)
- [Authentication Flow](#-authentication-flow)
- [REST API Overview](#-rest-api-overview)
- [Interest Calculation](#-interest-calculation)
- [Payment Allocation Logic](#-payment-allocation-logic)
- [Business Rules](#-business-rules)
- [Validation & Error Handling](#-validation--error-handling)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Security Features](#-security-features)
- [Performance Highlights](#-performance-highlights)
- [Testing Checklist](#-testing-checklist)
- [Future Enhancements](#-future-enhancements)
- [Contributing](#-contributing)
- [Coding Standards](#-coding-standards)
- [License](#-license)
- [Author](#-author)

---

# 📖 Project Overview

**FINNECT Finance OS** is a production-oriented full-stack Loan Management System built to digitize and simplify the day-to-day operations of small and medium-sized finance businesses.

Instead of maintaining customer records in notebooks or spreadsheets, finance owners can manage the complete lending lifecycle from a centralized web application.

The system supports:

- Finance Owner Authentication
- Customer Management
- Loan Management
- Interest Calculation
- Payment Tracking
- Loan Renewals
- Loan Settlement
- Dashboard Analytics
- Business Reports
- Finance Settings

FINNECT is designed around real-world finance business workflows rather than simple CRUD operations. Every module follows practical business rules such as interest-first payment allocation, loan renewal history, settlement validation, and configurable interest calculation methods.

The project follows a layered architecture consisting of:

- React Frontend
- FastAPI REST Backend
- SQLAlchemy ORM
- PostgreSQL Database
- JWT Authentication
- Production Deployment using Render and Vercel

The architecture is modular, scalable, and structured to allow future enhancements without major changes to the existing codebase.

---

# 📸 Application Screenshots

The following screenshots demonstrate the major workflows of FINNECT Finance OS.

---

## 🔐 Login

<p align="center">
<img src="docs/screenshots/login.png" width="95%" alt="Login">
</p>

Finance owners securely authenticate using email and password. JWT tokens are issued after successful authentication.

---

## 📊 Dashboard

<p align="center">
<img src="docs/screenshots/dashboard.png" width="95%" alt="Dashboard">
</p>

Provides an overview of:

- Total Customers
- Active Loans
- Closed Loans
- Collections
- Interest Earned
- Recent Activities
- Business Reports

---

## 👥 Customer Management

<p align="center">
<img src="docs/screenshots/customers.png" width="95%" alt="Customers">
</p>

Manage customer information including:

- Registration
- Updates
- Search
- Customer History
- Loan Overview

---

## 💰 Loan Management

<p align="center">
<img src="docs/screenshots/loans.png" width="95%" alt="Loans">
</p>

Features include:

- Loan Creation
- Loan Search
- Statements
- Renewals
- Settlement
- Due Date Tracking

---

## 💳 Payment Management

<p align="center">
<img src="docs/screenshots/payments.png" width="95%" alt="Payments">
</p>

Payment processing includes:

- Automatic Interest Allocation
- Principal Tracking
- Payment History
- Outstanding Balance Calculation

---

## 🔄 Loan Renewals

<p align="center">
<img src="docs/screenshots/renewals.png" width="95%" alt="Renewals">
</p>

Extend active loans while preserving complete renewal history.

---

## 📈 Reports

<p align="center">
<img src="docs/screenshots/reports.png" width="95%" alt="Reports">
</p>

Generate reports including:

- Profit Summary
- Maturity Reports
- Overdue Loans
- Collection Reports
- Closed Loans

---

# 💼 Business Problem

Many finance businesses still rely on manual processes to manage customers and loans. Daily operations are often maintained in paper registers, notebooks, or disconnected spreadsheets.

These approaches create several operational challenges:

- Manual interest calculations
- Human calculation mistakes
- Missing payment history
- Duplicate customer records
- Difficulty tracking loan maturity
- Poor visibility into business performance
- Time-consuming report generation
- Limited audit history
- Risk of financial inconsistencies

As the number of customers increases, these issues become harder to manage and directly impact operational efficiency.

---

# 💡 Solution

FINNECT Finance OS provides a centralized digital platform that automates loan management while preserving the flexibility required by local finance businesses.

The application enables finance owners to:

- Register and manage customers
- Create and monitor loans
- Record payments
- Automatically calculate interest
- Configure different interest calculation methods
- Extend loan duration through renewals
- Settle completed loans
- Track overdue accounts
- View dashboard analytics
- Generate operational reports
- Maintain finance-specific settings

By automating repetitive financial operations, FINNECT reduces manual work, improves calculation accuracy, and provides complete visibility into business performance.

---

# ✨ Key Features

## 🔐 Authentication

- Finance Owner Registration
- Secure Login
- JWT Authentication
- BCrypt Password Hashing
- Protected REST APIs
- Session-Based Authorization

---

## 👥 Customer Management

- Register Customers
- Update Customer Information
- Search Customers
- Customer Profile Management
- Customer Loan History

---

## 💰 Loan Management

- Create Loans
- Search Loans
- Loan Statements
- Loan Renewals
- Loan Settlement
- Interest Tracking
- Due Date Management
- Loan Status Monitoring

---

## 💳 Payment Management

- Record Payments
- Automatic Interest Allocation
- Principal Balance Tracking
- Payment History
- Latest Payment Deletion Validation

---

## 📊 Dashboard & Reports

- Business Dashboard
- Customer Statistics
- Active Loan Summary
- Closed Loan Summary
- Collection Reports
- Profit Reports
- Maturity Reports
- Overdue Loan Reports
- Recent Activity

---

## ⚙️ Finance Settings

- Business Configuration
- Interest Settings
- Finance Owner Profile
- System Preferences

---

## 🚀 Production Features

- Responsive UI
- RESTful APIs
- PostgreSQL Database
- SQLAlchemy ORM
- Environment-Based Configuration
- Production Deployment
- CORS Configuration
- Swagger Documentation

---

# 🛠️ Technology Stack

## Frontend

| Technology | Purpose |
| :--------- | :------ |
| React 19 | User Interface |
| TypeScript | Type Safety |
| Vite | Build Tool |
| React Router | Routing |
| Axios | API Communication |
| CSS | Styling |

---

## Backend

| Technology | Purpose |
| :--------- | :------ |
| Python 3.12 | Programming Language |
| FastAPI | REST Framework |
| SQLAlchemy | ORM |
| PostgreSQL | Database |
| Alembic | Database Migrations |
| Pydantic | Validation |
| JWT | Authentication |
| Passlib + BCrypt | Password Hashing |

---

## DevOps

| Technology | Purpose |
| :--------- | :------ |
| Git | Version Control |
| GitHub | Source Repository |
| GitHub Actions | CI/CD |
| Render | Backend Hosting |
| Vercel | Frontend Hosting |
| Swagger UI | API Documentation |

---

# 🏗️ System Architecture

FINNECT Finance OS follows a modern three-layer architecture where the frontend communicates with the backend through secure REST APIs, while SQLAlchemy manages communication with PostgreSQL.

```text
                           Client Browser
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │     React Frontend         │
                    │────────────────────────────│
                    │ React                      │
                    │ TypeScript                 │
                    │ Vite                       │
                    │ React Router               │
                    │ Axios                      │
                    └─────────────┬──────────────┘
                                  │
                          HTTPS + JWT
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │      FastAPI Backend       │
                    │────────────────────────────│
                    │ Authentication             │
                    │ Customers                  │
                    │ Loans                      │
                    │ Payments                   │
                    │ Renewals                   │
                    │ Reports                    │
                    │ Finance Settings           │
                    └─────────────┬──────────────┘
                                  │
                           SQLAlchemy ORM
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │    PostgreSQL Database     │
                    └────────────────────────────┘
```

---

# 📂 Project Structure

```text
FINNECT-Finance-OS
│
├── backend
│   ├── alembic
│   │   └── versions
│   │
│   ├── app
│   │   ├── api
│   │   ├── core
│   │   ├── database
│   │   ├── models
│   │   ├── schemas
│   │   ├── services
│   │   ├── utils
│   │   └── main.py
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── frontend
│   ├── public
│   ├── src
│   │   ├── api
│   │   ├── assets
│   │   ├── components
│   │   ├── pages
│   │   ├── router
│   │   ├── services
│   │   ├── types
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── vercel.json
│
├── docs
│   └── screenshots
│
├── .github
│   └── workflows
│
├── README.md
├── LICENSE
└── .gitignore
```

---

# 🧩 Core Modules

The application follows a modular architecture where every business responsibility is isolated into independent modules. This separation improves maintainability, scalability, and future extensibility.

| Module | Responsibilities |
| :------ | :--------------- |
| Authentication | Finance Owner Registration, Login, JWT Authentication |
| Customer Management | Customer Registration, Search, Update, Customer Details |
| Loan Management | Loan Creation, Search, Statement Generation, Settlement |
| Payment Management | Record Payments, Payment History, Payment Validation |
| Loan Renewals | Extend Existing Loans and Maintain Renewal History |
| Dashboard | Business Overview and Statistics |
| Reports | Profit Reports, Maturity Reports, Overdue Reports |
| Finance Settings | Business Configuration and Interest Preferences |

---

# 🗄️ Database Design

FINNECT Finance OS uses **PostgreSQL** as its primary relational database.

All database interactions are performed using **SQLAlchemy ORM**, allowing the business layer to remain independent of raw SQL queries while maintaining strong relationships between entities.

The database is designed around real-world finance operations where one finance owner manages multiple customers, each customer may have multiple loans, and every loan maintains its own payment and renewal history.

---

## Entity Relationship Diagram

```text
                    ┌───────────────────────────┐
                    │      Finance Owner        │
                    └─────────────┬─────────────┘
                                  │
                             One-to-Many
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │         Customer          │
                    └─────────────┬─────────────┘
                                  │
                             One-to-Many
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │           Loan            │
                    └───────┬───────────┬───────┘
                            │           │
                       One-to-Many  One-to-Many
                            │           │
                            ▼           ▼
                    ┌─────────────┐ ┌──────────────┐
                    │   Payment   │ │ Loan Renewal │
                    └─────────────┘ └──────────────┘
```

---

# 📦 Primary Entities

## 👤 Finance Owner

Represents the authenticated business owner using the application.

Responsibilities:

- Account Registration
- Secure Login
- JWT Authentication
- Finance Configuration
- Dashboard Access
- Business Ownership

---

## 👥 Customer

Stores complete borrower information.

Typical information includes:

- Full Name
- Mobile Number
- Address
- Identification Details
- Customer Notes

Relationship:

```
One Finance Owner
        │
        ▼
Many Customers
```

A customer can have multiple active or completed loans.

---

## 💰 Loan

The Loan entity represents the core business object of the application.

Each loan stores:

- Principal Amount
- Interest Rate
- Interest Method
- Issue Date
- Due Date
- Loan Status
- Remaining Principal
- Total Interest Paid
- Total Principal Paid
- Settlement Information

Relationship:

```
One Customer
      │
      ▼
Many Loans
```

---

## 💳 Payment

Every payment made by a borrower is permanently recorded.

Payment information includes:

- Payment Amount
- Interest Paid
- Principal Paid
- Payment Date
- Payment Method
- Remarks

Relationship:

```
One Loan
    │
    ▼
Many Payments
```

The application uses payment history to calculate:

- Outstanding Interest
- Remaining Principal
- Loan Balance
- Settlement Amount

---

## 🔄 Loan Renewal

Loan renewals maintain the complete extension history of every loan.

Renewal records include:

- Previous Due Date
- New Due Date
- Updated Interest Rate
- Updated Interest Method
- Renewal Remarks

Relationship:

```
One Loan
    │
    ▼
Many Renewal Records
```

Historical renewals are preserved to maintain a complete audit trail.

---

# 🔄 Business Workflow

The application mirrors the daily workflow of a finance business.

Every loan passes through a structured lifecycle from creation to settlement.

```text
                        Finance Owner
                              │
                              ▼
                     Secure Authentication
                              │
                              ▼
                        Dashboard
                              │
                              ▼
                    Register Customer
                              │
                              ▼
                        Create Loan
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      Record Payments                 Loan Renewal
              │                               │
              └───────────────┬───────────────┘
                              ▼
                       Loan Settlement
                              │
                              ▼
                   Dashboard & Reports
```

This workflow ensures that every customer interaction follows a consistent business process while maintaining complete financial records.

---

# 🔐 Authentication Flow

FINNECT Finance OS uses **JWT (JSON Web Token)** authentication to secure all protected APIs.

Only authenticated finance owners can access customer, loan, payment, and reporting endpoints.

```text
                Finance Owner
                      │
                      ▼
            Enter Email & Password
                      │
                      ▼
       POST /finance-owners/login
                      │
                      ▼
          Validate Credentials
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
      Authentication        Authentication
          Failed              Successful
           │                     │
           ▼                     ▼
      Return Error          Generate JWT
                                  │
                                  ▼
                       Return Access Token
                                  │
                                  ▼
                       Store Token in Frontend
                                  │
                                  ▼
                     Authorization: Bearer <JWT>
                                  │
                                  ▼
                     Access Protected APIs
```

---

# 🌐 REST API Overview

The backend exposes RESTful endpoints grouped according to business functionality.

| HTTP Method | Endpoint | Description |
| :---------- | :------- | :---------- |
| POST | `/finance-owners/register` | Register Finance Owner |
| POST | `/finance-owners/login` | Login |
| GET | `/dashboard` | Dashboard Summary |
| POST | `/customers` | Create Customer |
| GET | `/customers` | List Customers |
| GET | `/customers/{id}` | Customer Details |
| PUT | `/customers/{id}` | Update Customer |
| POST | `/loans` | Create Loan |
| GET | `/loans` | List Loans |
| GET | `/loans/search` | Search Loans |
| GET | `/loans/{id}` | Loan Details |
| GET | `/loans/{id}/statement` | Loan Statement |
| POST | `/payments` | Record Payment |
| GET | `/payments` | Payment History |
| POST | `/loan-renewals` | Renew Loan |
| GET | `/finance-settings` | Retrieve Settings |
| PUT | `/finance-settings` | Update Settings |

---

# 💹 Interest Calculation

FINNECT supports two configurable interest calculation methods.

Finance owners can choose the preferred calculation method while creating or renewing a loan.

| Method | Description |
| :----- | :---------- |
| Percentage | Monthly interest calculated using a percentage rate. |
| Rupees per ₹100 | Monthly interest calculated as a fixed amount per ₹100 of principal. |

---

## Percentage Method

```text
Monthly Interest

=

Principal × Interest Rate (%)
──────────────────────────────
            100
```

---

## Rupees per ₹100 Method

```text
Monthly Interest

=

Principal
────────── × Interest per ₹100
   100
```

This flexibility allows the application to support different lending models commonly used by finance businesses.

---

# 💳 Payment Allocation Logic

Payments follow strict finance business rules.

Outstanding interest is always cleared before reducing the principal balance.

```text
             Customer Payment
                    │
                    ▼
        Outstanding Interest?
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
         YES                  NO
          │                   │
          ▼                   ▼
  Allocate to Interest   Allocate to Principal
          │                   │
          └─────────┬─────────┘
                    ▼
          Update Loan Balance
                    │
                    ▼
           Store Payment Record
```

This prevents principal reduction while unpaid interest remains, ensuring financial accuracy and consistent loan accounting.

---

# 📜 Business Rules

FINNECT Finance OS enforces business rules that reflect real-world lending practices. These rules ensure financial accuracy, protect data integrity, and maintain consistency throughout the loan lifecycle.

| Rule | Description |
| :--- | :---------- |
| Authentication Required | All protected APIs require a valid JWT access token. |
| Customer Before Loan | A loan cannot be created without an existing customer. |
| Interest First | Outstanding interest must be cleared before principal is reduced. |
| Principal Protection | Principal balance cannot decrease while unpaid interest exists. |
| Latest Payment Deletion | Only the most recent payment can be deleted. |
| Loan Renewal | Only active loans are eligible for renewal. |
| Loan Settlement | A loan can be settled only after all outstanding dues are cleared. |
| Data Validation | All incoming requests are validated using Pydantic schemas. |
| Password Security | Passwords are securely hashed using BCrypt. |
| Database Integrity | SQLAlchemy relationships maintain referential integrity. |

---

# 🛡️ Validation & Error Handling

Every request passes through multiple validation layers before any database transaction is executed.

```text
             Incoming Request
                    │
                    ▼
        Pydantic Schema Validation
                    │
                    ▼
        Business Rule Validation
                    │
                    ▼
     Authentication & Authorization
                    │
                    ▼
        Database Transaction Layer
                    │
                    ▼
          Successful API Response
```

Whenever validation fails, the API returns an appropriate HTTP status code along with a descriptive error message.

Typical validations include:

- Missing required fields
- Invalid request payloads
- Unauthorized access
- Resource not found
- Duplicate records
- Invalid loan operations
- Business rule violations
- Database transaction failures

---

# 🚀 Getting Started

Follow the instructions below to set up FINNECT Finance OS locally.

---

# 📋 Prerequisites

Install the following software before running the project.

| Software | Recommended Version |
| :-------- | :-----------------: |
| Python | 3.12+ |
| Node.js | 20+ |
| npm | Latest |
| PostgreSQL | 16+ |
| Git | Latest |

---

# 📦 Clone Repository

```bash
git clone https://github.com/sakethreddymamidigari/FINNECT-Finance-OS.git

cd FINNECT-Finance-OS
```

---

# ⚙️ Backend Setup

Navigate to the backend folder.

```bash
cd backend
```

---

## Create Virtual Environment

### Windows

```bash
python -m venv .venv
```

Activate the environment.

```bash
.venv\Scripts\activate
```

---

### macOS / Linux

```bash
python3 -m venv .venv

source .venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Configure Environment Variables

Create a `.env` file inside the backend directory.

```text
backend
│
├── .env
├── requirements.txt
└── app
```

Example configuration:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/finnect

SECRET_KEY=your_secret_key

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60
```

---

## Apply Database Migrations

```bash
alembic upgrade head
```

---

## Start Backend Server

```bash
python -m uvicorn backend.app.main:app --reload
```

Backend URL

```text
http://127.0.0.1:8000
```

Swagger Documentation

```text
http://127.0.0.1:8000/docs
```

---

# 💻 Frontend Setup

Open a new terminal.

Navigate to the frontend directory.

```bash
cd frontend
```

Install dependencies.

```bash
npm install
```

---

## Frontend Environment Variables

Create a `.env` file.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## Start Development Server

```bash
npm run dev
```

Frontend URL

```text
http://localhost:5173
```

---

# ▶️ Running the Complete Application

Start the backend server.

```text
http://127.0.0.1:8000
```

Start the frontend server.

```text
http://localhost:5173
```

Open the frontend in your browser.

Use the following workflow:

1. Register a Finance Owner
2. Login to the application
3. Create Customers
4. Create Loans
5. Record Payments
6. Renew Loans when required
7. Settle Completed Loans
8. Monitor Dashboard Reports

---

# 🌍 Production Deployment

FINNECT Finance OS is deployed using a modern cloud-native architecture that separates the frontend and backend into independent deployment environments.

This approach provides:

- Independent deployments
- Better scalability
- Simplified maintenance
- Faster frontend delivery
- Secure backend hosting
- Automatic HTTPS

---

## Frontend Deployment

| Platform | URL |
| :------- | :-- |
| Vercel | https://finnect-finance-os.vercel.app |

### Responsibilities

- React Application Hosting
- Static Asset Delivery
- Automatic HTTPS
- Global CDN
- Continuous Deployment

---

## Backend Deployment

| Platform | URL |
| :------- | :-- |
| Render | https://finnect-backend-hrq8.onrender.com |

### Responsibilities

- FastAPI Application
- PostgreSQL Connectivity
- REST APIs
- JWT Authentication
- Business Logic
- Swagger Documentation

---

## API Documentation

| Documentation | URL |
| :------------ | :-- |
| Swagger UI | https://finnect-backend-hrq8.onrender.com/docs |

---

# 🔄 CI/CD Pipeline

The project uses GitHub as the central source repository with automatic deployment to Render and Vercel.

```text
                    Developer
                        │
                        ▼
                Local Development
                        │
                        ▼
                 Git Commit & Push
                        │
                        ▼
             GitHub Repository (Main)
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
  Render Auto Deploy          Vercel Auto Deploy
 (FastAPI Backend)           (React Frontend)
          │                           │
          └─────────────┬─────────────┘
                        ▼
             Production Environment
```

### Deployment Flow

1. Code is committed locally.
2. Changes are pushed to GitHub.
3. Render automatically deploys backend changes.
4. Vercel automatically deploys frontend changes.
5. Updated application becomes available online.

---

# 📚 API Documentation

FastAPI automatically generates OpenAPI-compliant documentation.

## Available Documentation

| Feature | Status |
| :------ | :----: |
| Interactive Swagger UI | ✅ |
| OpenAPI Specification | ✅ |
| Request Validation | ✅ |
| Response Models | ✅ |
| JWT Authentication Testing | ✅ |

Swagger URL

```text
https://finnect-backend-hrq8.onrender.com/docs
```

---

# 🔐 Security Features

Security is integrated throughout the application to protect sensitive financial data.

| Feature | Description |
| :------ | :---------- |
| JWT Authentication | Stateless authentication using access tokens |
| BCrypt Password Hashing | Passwords are securely hashed before storage |
| Protected Routes | Authentication required for secured APIs |
| Request Validation | Input validation using Pydantic |
| SQLAlchemy ORM | Prevents SQL Injection through parameterized queries |
| Environment Variables | Secrets stored outside source code |
| CORS Configuration | Controlled cross-origin requests |
| HTTP Exception Handling | Standardized error responses |

---

# ⚡ Performance Highlights

FINNECT Finance OS follows a modular architecture designed for scalability and maintainability.

## Architectural Strengths

- Layered Backend Architecture
- Service-Based Business Logic
- Modular API Design
- SQLAlchemy ORM Relationships
- Efficient PostgreSQL Queries
- Stateless JWT Authentication
- Reusable Pydantic Schemas
- RESTful APIs
- Frontend and Backend Separation
- Production Ready Deployment

---

## Maintainability

The project follows a clean separation of concerns.

```text
Presentation Layer
        │
        ▼
API Layer
        │
        ▼
Business Logic Layer
        │
        ▼
Database Layer
```

This architecture makes the application easier to maintain, extend, and test.

---

# 🧪 Testing Checklist

The following functionality has been verified during development.

| Module | Status |
| :----- | :----: |
| Finance Owner Registration | ✅ |
| Login Authentication | ✅ |
| Customer Management | ✅ |
| Loan Creation | ✅ |
| Loan Search | ✅ |
| Loan Statements | ✅ |
| Payment Recording | ✅ |
| Loan Renewals | ✅ |
| Loan Settlement | ✅ |
| Dashboard | ✅ |
| Reports | ✅ |
| Finance Settings | ✅ |
| JWT Authentication | ✅ |
| Swagger Documentation | ✅ |
| Production Deployment | ✅ |

---

# 🚀 Future Enhancements

The modular architecture allows future capabilities to be integrated without major structural changes.

| Feature | Description | Status |
| :------ | :---------- | :----: |
| WhatsApp Payment Reminders | Notify customers about due dates and overdue payments | 🔄 Planned |
| SMS Notifications | Payment confirmations and reminders | 🔄 Planned |
| Email Notifications | Automated finance notifications | 🔄 Planned |
| Receipt Generation | Downloadable PDF receipts | 🔄 Planned |
| Report Export | Excel and PDF export support | 🔄 Planned |
| Advanced Analytics | Revenue trends and business insights | 🔄 Planned |
| Multi-Branch Support | Manage multiple finance offices | 🔄 Planned |
| Employee Management | Role-based access control | 🔄 Planned |
| Audit Logs | Complete activity tracking | 🔄 Planned |
| Cloud Document Storage | Secure customer document management | 🔄 Planned |

---

# 🤝 Contributing

Contributions are welcome.

## Contribution Workflow

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push the branch.
5. Open a Pull Request.

```bash
git checkout -b feature/your-feature-name

git add .

git commit -m "Add new feature"

git push origin feature/your-feature-name
```

Before submitting a pull request, ensure:

- Code follows project standards.
- All features are tested.
- No unnecessary files are committed.
- Documentation is updated where applicable.

---

# 📝 Coding Standards

The project follows clean architecture principles.

## Backend

- Follow PEP 8
- Use descriptive naming
- Keep business logic inside services
- Validate requests using Pydantic
- Handle errors using FastAPI exceptions
- Maintain database access through SQLAlchemy

---

## Frontend

- Use TypeScript
- Build reusable components
- Keep API calls inside service modules
- Organize pages by feature
- Maintain responsive layouts
- Avoid duplicated UI logic

---

# 📈 Project Highlights

## Business Features

- Finance Owner Authentication
- Customer Management
- Loan Management
- Payment Tracking
- Loan Statements
- Loan Renewals
- Loan Settlement
- Dashboard Analytics
- Reports
- Finance Settings

---

## Technical Highlights

- Full-Stack Web Application
- FastAPI Backend
- React + TypeScript Frontend
- PostgreSQL Database
- SQLAlchemy ORM
- JWT Authentication
- BCrypt Password Hashing
- Alembic Database Migrations
- RESTful API Design
- Modular Architecture
- Production Deployment
- Responsive User Interface

---

# 📊 Project Statistics

| Category | Details |
| :------- | :------ |
| Project Type | Full-Stack Web Application |
| Domain | Financial Technology (FinTech) |
| Frontend | React + TypeScript + Vite |
| Backend | FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Authentication | JWT |
| API Style | REST |
| Deployment | Render + Vercel |
| Version Control | Git + GitHub |

---

# 🏆 Learning Outcomes

Development of FINNECT Finance OS involved practical implementation of modern software engineering concepts.

## Backend

- REST API Development
- Authentication & Authorization
- Business Logic Design
- Database Design
- SQLAlchemy ORM
- Alembic Migrations
- Data Validation
- Error Handling

---

## Frontend

- React Development
- TypeScript
- Component Architecture
- Routing
- API Integration
- Responsive Design

---

## DevOps

- Git Version Control
- GitHub Workflow
- Render Deployment
- Vercel Deployment
- Environment Configuration
- CI/CD

---

# 📄 License

This project is licensed under the **MIT License**.

You are free to:

- Use
- Modify
- Fork
- Distribute

in accordance with the MIT License.

---

# 👨‍💻 Author

<div align="center">

## Saketh Reddy Mamidigari

**Backend Python Developer**

**GitHub**

https://github.com/sakethreddymamidigari

**LinkedIn**

https://www.linkedin.com/in/mamidigari-saketh-reddy

**Email**

sakethreddymamidigari@gmail.com

</div>

---

# 🙏 Acknowledgements

Special thanks to the open-source community and the technologies that made this project possible.

- Python
- FastAPI
- React
- TypeScript
- PostgreSQL
- SQLAlchemy
- Pydantic
- Alembic
- JWT
- Vite
- Git
- GitHub
- Render
- Vercel

---

<div align="center">

# ⭐ Star this Repository

If you found this project useful, consider giving it a star on GitHub.

Your support helps improve the project and motivates continued development.

---

### FINNECT Finance OS

*A modern, production-ready full-stack Loan Management System demonstrating scalable backend architecture, secure authentication, business-driven finance workflows, and contemporary web development using React, FastAPI, and PostgreSQL.*

**Made with using Python, FastAPI, React, TypeScript, and PostgreSQL**

</div>