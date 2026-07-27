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

| Application | URL                                            |
| :---------- | :--------------------------------------------- |
| Frontend    | https://finnect-finance-os.vercel.app          |
| Backend API | https://finnect-backend-hrq8.onrender.com      |
| API Docs    | https://finnect-backend-hrq8.onrender.com/docs |

---

# 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Business Problem](#-business-problem)
- [Solution](#-solution)
- [Key Features](#-key-features)
- [Application Screenshots](#-application-screenshots)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Database Design](#-database-design)
- [Business Workflow](#-business-workflow)
- [Authentication Flow](#-authentication-flow)
- [API Modules](#-api-modules)
- [Interest Calculation](#-interest-calculation)
- [Business Rules](#-business-rules)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Deployment](#-deployment)
- [Security Features](#-security-features)
- [Performance Highlights](#-performance-highlights)
- [Future Enhancements](#-future-enhancements)
- [License](#-license)
- [Author](#-author)

---

# 📖 Project Overview

**FINNECT Finance OS** is a modern full-stack Loan Management System designed to digitize the day-to-day operations of finance businesses.

The system manages the complete loan lifecycle—from finance owner authentication and customer registration to loan creation, payment tracking, renewals, settlements, and business reporting—through a secure, responsive web application.

Unlike a traditional CRUD application, FINNECT implements real-world finance business logic such as:

- Secure Finance Owner Authentication using JWT
- Customer Lifecycle Management
- Loan Creation and Tracking
- Multiple Interest Calculation Methods
- Automatic Interest-First Payment Allocation
- Loan Renewals
- Loan Settlement
- Dashboard Analytics
- Profit Reporting
- Maturity Reports
- Overdue Loan Monitoring
- Finance Settings Management
- RESTful API Architecture

The application follows a layered architecture with a React frontend, FastAPI backend, SQLAlchemy ORM, and PostgreSQL database, making it scalable, maintainable, and production-ready.

---

# 💼 Business Problem

Many small and medium-sized finance businesses continue to manage their lending operations using notebooks, spreadsheets, or disconnected software tools.

These manual processes introduce several operational challenges, including:

- Manual interest calculations
- Human calculation errors
- Duplicate customer records
- Missing payment history
- Poor loan tracking
- Difficult loan renewals
- Limited business visibility
- No centralized reporting
- Time-consuming record maintenance

As the number of customers and active loans grows, these issues significantly reduce operational efficiency and increase the risk of financial inaccuracies.

---

# 💡 Solution

FINNECT Finance OS provides a centralized digital platform that streamlines the complete finance management process.

The application enables finance businesses to:

- Register and manage customers
- Create and monitor loans
- Record customer payments
- Automatically calculate interest
- Process loan renewals
- Settle completed loans
- Monitor overdue accounts
- Track business profitability
- Generate operational reports
- Manage finance settings from a single platform

The result is a faster, more accurate, and scalable workflow that reduces manual effort while improving financial transparency.

---

# ✨ Key Features

## 🔐 Authentication

- Finance Owner Registration
- Secure Login
- JWT Token Authentication
- Password Hashing using BCrypt
- Protected REST APIs
- Persistent Login Sessions

---

## 👥 Customer Management

- Register Customers
- Update Customer Information
- Search Customers
- View Customer Profiles
- Customer Loan History

---

## 💰 Loan Management

- Create Loans
- Update Loan Details
- Loan Statements
- Loan Search
- Interest Summary
- Settlement Preview
- Loan Settlement
- Loan Renewal

---

## 💳 Payment Management

- Record Loan Payments
- Automatic Interest Allocation
- Principal Balance Tracking
- Payment History
- Latest Payment Deletion Validation

---

## 📊 Dashboard & Reports

Business insights available through a centralized dashboard:

- Total Customers
- Active Loans
- Closed Loans
- Today's Collection
- Principal Disbursed
- Principal Paid
- Remaining Principal
- Interest Collected
- Recent Loans
- Recent Payments
- Profit Summary
- Maturity Report
- Overdue Loans
- Closed Loan Reports

---

## ⚙️ Finance Settings

- Finance Owner Profile
- Interest Configuration
- Business Settings
- Finance Preferences

---

## 🚀 Production Features

- Responsive User Interface
- RESTful API Architecture
- PostgreSQL Database
- SQLAlchemy ORM
- Environment-Based Configuration
- Production Deployment on Render
- Frontend Deployment on Vercel
- Cross-Origin (CORS) Configuration
- Automatic Deployment from GitHub

---

# 📸 Application Screenshots

The following screenshots demonstrate the primary workflows and modules of FINNECT Finance OS.

> **Note**
>
> Replace the placeholder images with the latest screenshots from the `docs/screenshots/` directory.

---

## 🔐 Login

<p align="center">
  <img src="docs/screenshots/login.png" alt="Login Page" width="95%">
</p>

Secure authentication for Finance Owners using JWT-based login.

---

## 📊 Dashboard

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="95%">
</p>

Provides an overview of business performance, active loans, collections, reports, and financial statistics.

---

<p align="center">
  <img src="docs/screenshots/customers.png" alt="Customers" width="95%">
</p>

Manage customer records, view customer details, and maintain complete borrower information.

---

<p align="center">
  <img src="docs/screenshots/loans.png" alt="Loans" width="95%">
</p>

Create, manage, search, renew, and settle customer loans with automated interest calculations.

---

<p align="center">
  <img src="docs/screenshots/payments.png" alt="Payments" width="95%">
</p>

Record payments with automatic interest allocation and maintain complete payment history.

---

## 🔄 Loan Renewals

<p align="center">
  <img src="docs/screenshots/renewals.png" alt="Loan Renewals" width="95%">
</p>

Extend existing loans while preserving complete renewal history.

---

## 📈 Reports

<p align="center">
  <img src="docs/screenshots/reports.png" alt="Reports" width="95%">
</p>

Generate business insights through profit reports, maturity reports, overdue loans, and closed loan summaries.

---

# 🛠️ Technology Stack

## Frontend

| Technology | Purpose |
| :--------- | :------ |
| React 19 | User Interface Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| React Router | Client-side Routing |
| Axios | API Communication |
| CSS | User Interface Styling |

---

## Backend

| Technology | Purpose |
| :--------- | :------ |
| Python 3.12 | Programming Language |
| FastAPI | REST API Framework |
| SQLAlchemy | ORM |
| PostgreSQL | Relational Database |
| Alembic | Database Migrations |
| Pydantic | Request & Response Validation |
| JWT | Authentication |
| Passlib + BCrypt | Password Hashing |

---

## Database

| Technology | Purpose |
| :--------- | :------ |
| PostgreSQL | Primary Database |
| SQLAlchemy ORM | Object Relational Mapping |
| Alembic | Schema Versioning |

---

## DevOps & Deployment

| Technology | Purpose |
| :--------- | :------ |
| Git | Version Control |
| GitHub | Source Code Hosting |
| GitHub Actions | CI/CD |
| Render | Backend Deployment |
| Vercel | Frontend Deployment |
| Swagger UI | Interactive API Documentation |

---

# 🏗️ System Architecture

The application follows a modern three-tier architecture where the React frontend communicates securely with the FastAPI backend through REST APIs, while SQLAlchemy manages database interactions with PostgreSQL.

```text
                               Client Browser
                                      │
                                      │
                                      ▼
                  ┌───────────────────────────────────────┐
                  │           React Frontend              │
                  │───────────────────────────────────────│
                  │ • React 19                            │
                  │ • TypeScript                          │
                  │ • Vite                                │
                  │ • React Router                        │
                  │ • Axios                               │
                  └───────────────────┬───────────────────┘
                                      │
                             HTTPS / REST APIs
                             JWT Authentication
                                      │
                                      ▼
                  ┌───────────────────────────────────────┐
                  │           FastAPI Backend             │
                  │───────────────────────────────────────│
                  │ • Authentication                      │
                  │ • Customer Management                 │
                  │ • Loan Management                     │
                  │ • Payment Management                  │
                  │ • Loan Renewals                       │
                  │ • Finance Settings                    │
                  │ • Dashboard & Reports                 │
                  └───────────────────┬───────────────────┘
                                      │
                               SQLAlchemy ORM
                                      │
                                      ▼
                  ┌───────────────────────────────────────┐
                  │          PostgreSQL Database          │
                  │───────────────────────────────────────│
                  │ • Customers                           │
                  │ • Loans                               │
                  │ • Payments                            │
                  │ • Loan Renewals                       │
                  │ • Finance Owners                      │
                  └───────────────────────────────────────┘
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
│   │   ├── components
│   │   ├── pages
│   │   ├── services
│   │   ├── router
│   │   ├── types
│   │   ├── assets
│   │   └── App.tsx
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

FINNECT Finance OS is organized into modular business components that separate responsibilities while sharing a common authentication and database layer.

| Module | Description |
| :------ | :---------- |
| Authentication | Finance Owner Registration, Login, JWT Authentication |
| Customer Management | Customer Registration, Search, Update, History |
| Loan Management | Loan Creation, Search, Statements, Settlement |
| Payment Management | Payment Recording and Interest Allocation |
| Loan Renewals | Loan Extension and Renewal Tracking |
| Dashboard | Business Overview and Analytics |
| Reports | Profit Summary, Maturity Reports, Overdue Loans |
| Finance Settings | Business Configuration and Interest Settings |

---

# 🗄️ Database Design

FINNECT Finance OS uses PostgreSQL as the primary relational database with SQLAlchemy ORM for data access and relationship management.

## Entity Relationship Overview

```text
                    ┌──────────────────────┐
                    │    Finance Owner     │
                    └──────────┬───────────┘
                               │
                         One-to-Many
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Customer        │
                    └──────────┬───────────┘
                               │
                         One-to-Many
                               │
                               ▼
                    ┌──────────────────────┐
                    │        Loan          │
                    └───────┬───────┬──────┘
                            │       │
                   One-to-Many   One-to-Many
                            │       │
                            ▼       ▼
                  ┌────────────┐ ┌───────────────┐
                  │  Payment   │ │ Loan Renewal  │
                  └────────────┘ └───────────────┘
```

---

## Primary Entities

### 👤 Finance Owner

Responsible for:

- Secure Authentication
- Business Ownership
- Finance Settings
- Dashboard Access

---

### 👥 Customer

Stores borrower information including:

- Name
- Mobile Number
- Address
- Identification Details
- Customer Notes

A single customer can own multiple loans.

---

### 💰 Loan

Maintains complete loan lifecycle information including:

- Principal Amount
- Interest Rate
- Interest Method
- Issue Date
- Due Date
- Loan Status
- Remaining Principal
- Total Interest Paid
- Total Principal Paid

---

### 💳 Payment

Tracks every payment made against a loan.

Each payment records:

- Total Amount
- Interest Paid
- Principal Paid
- Payment Date
- Payment Mode
- Remarks

---

### 🔄 Loan Renewal

Maintains historical renewal records including:

- Previous Due Date
- New Due Date
- Updated Interest Rate
- Updated Interest Method
- Renewal Remarks

---

The following screenshots demonstrate the primary workflows and modules of FINNECT Finance OS.
---

<p align="center">
  <img src="docs/screenshots/login.png" alt="Login Page" width="95%">
</p>

Secure authentication for Finance Owners using JWT-based login.

---

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="95%">
</p>

Provides an overview of business performance, active loans, collections, reports, and financial statistics.

---

<p align="center">
  <img src="docs/screenshots/customers.png" alt="Customers" width="95%">
</p>

Manage customer records, view customer details, and maintain complete borrower information.

---

<p align="center">
  <img src="docs/screenshots/loans.png" alt="Loans" width="95%">
</p>

Create, manage, search, renew, and settle customer loans with automated interest calculations.

---

<p align="center">
  <img src="docs/screenshots/payments.png" alt="Payments" width="95%">
</p>

Record payments with automatic interest allocation and maintain complete payment history.

---

<p align="center">
  <img src="docs/screenshots/renewals.png" alt="Loan Renewals" width="95%">
</p>

Extend existing loans while preserving complete renewal history.

---

<p align="center">
  <img src="docs/screenshots/reports.png" alt="Reports" width="95%">
</p>

Generate business insights through profit reports, maturity reports, overdue loans, and closed loan summaries.

---

| Technology | Purpose |
| :--------- | :------ |
| React 19 | User Interface Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| React Router | Client-side Routing |
| Axios | API Communication |
| CSS | User Interface Styling |

---

| Technology | Purpose |
| :--------- | :------ |
| Python 3.12 | Programming Language |
| FastAPI | REST API Framework |
| SQLAlchemy | ORM |
| PostgreSQL | Relational Database |
| Alembic | Database Migrations |
| Pydantic | Request & Response Validation |
| JWT | Authentication |
| Passlib + BCrypt | Password Hashing |

---

| Technology | Purpose |
| :--------- | :------ |
| PostgreSQL | Primary Database |
| SQLAlchemy ORM | Object Relational Mapping |
| Alembic | Schema Versioning |

---

| Technology | Purpose |
| :--------- | :------ |
| Git | Version Control |
| GitHub | Source Code Hosting |
| GitHub Actions | CI/CD |
| Render | Backend Deployment |
| Vercel | Frontend Deployment |
| Swagger UI | Interactive API Documentation |

---

The application follows a modern three-tier architecture where the React frontend communicates securely with the FastAPI backend through REST APIs, while SQLAlchemy manages database interactions with PostgreSQL.

```text
                               Client Browser
                                      │
                                      │
                                      ▼
                  ┌───────────────────────────────────────┐
                  │           React Frontend              │
                  │───────────────────────────────────────│
                  │ • React 19                            │
                  │ • TypeScript                          │
                  │ • Vite                                │
                  │ • React Router                        │
                  │ • Axios                               │
                  └───────────────────┬───────────────────┘
                                      │
                             HTTPS / REST APIs
                             JWT Authentication
                                      │
                                      ▼
                  ┌───────────────────────────────────────┐
                  │           FastAPI Backend             │
                  │───────────────────────────────────────│
                  │ • Authentication                      │
                  │ • Customer Management                 │
                  │ • Loan Management                     │
                  │ • Payment Management                  │
                  │ • Loan Renewals                       │
                  │ • Finance Settings                    │
                  │ • Dashboard & Reports                 │
                  └───────────────────┬───────────────────┘
                                      │
                               SQLAlchemy ORM
                                      │
                                      ▼
                  ┌───────────────────────────────────────┐
                  │          PostgreSQL Database          │
                  │───────────────────────────────────────│
                  │ • Customers                           │
                  │ • Loans                               │
                  │ • Payments                            │
                  │ • Loan Renewals                       │
                  │ • Finance Owners                      │
                  └───────────────────────────────────────┘
```

---

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
│   │   ├── components
│   │   ├── pages
│   │   ├── services
│   │   ├── router
│   │   ├── types
│   │   ├── assets
│   │   └── App.tsx
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

FINNECT Finance OS is organized into modular business components that separate responsibilities while sharing a common authentication and database layer.

| Module | Description |
| :------ | :---------- |
| Authentication | Finance Owner Registration, Login, JWT Authentication |
| Customer Management | Customer Registration, Search, Update, History |
| Loan Management | Loan Creation, Search, Statements, Settlement |
| Payment Management | Payment Recording and Interest Allocation |
| Loan Renewals | Loan Extension and Renewal Tracking |
| Dashboard | Business Overview and Analytics |
| Reports | Profit Summary, Maturity Reports, Overdue Loans |
| Finance Settings | Business Configuration and Interest Settings |

---

FINNECT Finance OS uses PostgreSQL as the primary relational database with SQLAlchemy ORM for data access and relationship management.

```text
                    ┌──────────────────────┐
                    │    Finance Owner     │
                    └──────────┬───────────┘
                               │
                         One-to-Many
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Customer        │
                    └──────────┬───────────┘
                               │
                         One-to-Many
                               │
                               ▼
                    ┌──────────────────────┐
                    │        Loan          │
                    └───────┬───────┬──────┘
                            │       │
                   One-to-Many   One-to-Many
                            │       │
                            ▼       ▼
                  ┌────────────┐ ┌───────────────┐
                  │  Payment   │ │ Loan Renewal  │
                  └────────────┘ └───────────────┘
```

---

Responsible for:

- Secure Authentication
- Business Ownership
- Finance Settings
- Dashboard Access

---

Stores borrower information including:

- Name
- Mobile Number
- Address
- Identification Details
- Customer Notes

A single customer can own multiple loans.

---

Maintains complete loan lifecycle information including:

- Principal Amount
- Interest Rate
- Interest Method
- Issue Date
- Due Date
- Loan Status
- Remaining Principal
- Total Interest Paid
- Total Principal Paid

---

Tracks every payment made against a loan.

Each payment records:

- Total Amount
- Interest Paid
- Principal Paid
- Payment Date
- Payment Mode
- Remarks

---

Maintains historical renewal records including:

- Previous Due Date
- New Due Date
- Updated Interest Rate
- Updated Interest Method
- Renewal Remarks

---

# 🔄 Business Workflow

FINNECT Finance OS follows a structured business workflow that mirrors the day-to-day operations of a finance business. Each module is designed to ensure accurate loan management, maintain financial integrity, and provide complete visibility into business operations.

```text
                                  FINANCE OWNER
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │   Secure Authentication     │
                         │       (JWT Login)           │
                         └─────────────┬───────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────────┐
                         │      Dashboard Overview     │
                         └─────────────┬───────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────────┐
                         │      Register Customer      │
                         └─────────────┬───────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────────┐
                         │        Create Loan          │
                         └─────────────┬───────────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
              ┌────────────────────┐      ┌────────────────────┐
              │ Record Payments    │      │ Loan Renewals      │
              └──────────┬─────────┘      └──────────┬─────────┘
                         │                           │
                         └─────────────┬─────────────┘
                                       ▼
                         ┌─────────────────────────────┐
                         │      Loan Settlement        │
                         └─────────────┬───────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────────┐
                         │   Dashboard & Reports       │
                         └─────────────────────────────┘
```

---

# 🔐 Authentication Flow

Authentication is implemented using JSON Web Tokens (JWT). Every protected endpoint requires a valid access token issued after successful login.

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
       Validate Credentials (BCrypt)
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
    Authentication      Authentication
        Failed             Successful
          │                   │
          ▼                   ▼
   Return HTTP Error      Generate JWT
                              │
                              ▼
                       Return Access Token
                              │
                              ▼
                Store Token in Frontend Session
                              │
                              ▼
              Include Authorization Header in APIs

Authorization: Bearer <JWT_TOKEN>
```

---

# 🧩 API Modules

The backend is organized into independent modules, each responsible for a specific business capability.

| Module | Responsibility |
| :----- | :------------- |
| Authentication | Finance Owner Registration and Login |
| Customers | Customer Registration, Update, Search and Details |
| Loans | Loan Creation, Search, Statements and Settlement |
| Payments | Payment Recording and Payment History |
| Loan Renewals | Extend Existing Loans |
| Dashboard | Business Statistics and Collections |
| Reports | Profit, Overdue Loans and Maturity Reports |
| Finance Settings | Business Configuration |

---

# 🌐 REST API Overview

| HTTP Method | Endpoint | Description |
| :---------- | :------- | :---------- |
| POST | `/finance-owners/register` | Register a Finance Owner |
| POST | `/finance-owners/login` | Authenticate Finance Owner |
| GET | `/dashboard` | Dashboard Summary |
| POST | `/customers` | Register Customer |
| GET | `/customers` | Retrieve Customers |
| GET | `/customers/{customer_id}` | Customer Details |
| PUT | `/customers/{customer_id}` | Update Customer |
| POST | `/loans` | Create Loan |
| GET | `/loans` | Retrieve Loans |
| GET | `/loans/{loan_id}` | Loan Details |
| GET | `/loans/search` | Search Loans |
| GET | `/loans/{loan_id}/statement` | Loan Statement |
| POST | `/payments` | Record Payment |
| GET | `/payments` | Payment History |
| POST | `/loan-renewals` | Renew Loan |
| GET | `/finance-settings` | Retrieve Finance Settings |
| PUT | `/finance-settings` | Update Finance Settings |

---

# 💹 Interest Calculation

FINNECT Finance OS supports two configurable interest calculation methods, allowing finance businesses to operate according to their preferred lending model.

| Method | Description |
| :----- | :---------- |
| Percentage | Monthly interest calculated using a percentage rate. |
| Rupees per ₹100 | Monthly interest calculated as a fixed amount per ₹100 of principal. |

### Percentage Method

```text
Monthly Interest

=
Principal × Interest Rate (%)
──────────────────────────────
            100
```

---

### Rupees per ₹100 Method

```text
Monthly Interest

=
Principal
────────── × Interest per ₹100
   100
```

---

# 💳 Payment Allocation Logic

Payments are allocated automatically according to finance business rules.

```text
      Customer Payment
            │
            ▼
  Outstanding Interest Exists?
            │
      ┌────┴────┐
      │         │
      YES        NO
      │         │
      ▼         ▼
Pay Interest Pay Principal
      │         │
      └────┬────┘
           ▼
    Update Loan Balance
           │
           ▼
    Store Payment Record
```

This approach ensures that outstanding interest is always cleared before reducing the principal balance.

---

# 📜 Business Rules

The system enforces several business rules to maintain financial accuracy and data consistency.

| Rule | Description |
| :--- | :---------- |
| Authentication Required | All protected APIs require a valid JWT access token. |
| Customer Before Loan | A loan cannot be created without an existing customer. |
| Interest First | Interest is always collected before principal. |
| Principal Protection | Principal cannot be reduced while unpaid interest exists. |
| Latest Payment Deletion | Only the most recent payment can be deleted. |
| Loan Renewal | Only active loans are eligible for renewal. |
| Loan Settlement | A loan can be settled only after all dues are cleared. |
| Data Validation | All requests are validated using Pydantic schemas. |
| Password Security | Passwords are securely hashed using BCrypt. |
| Database Integrity | SQLAlchemy relationships maintain referential integrity. |

---

# 🛡️ Data Validation & Error Handling

Every API request passes through multiple validation layers before any database operation is performed.

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
Database Transaction
        │
        ▼
Successful Response
```

If validation fails at any stage, the API returns an appropriate HTTP status code along with a descriptive error message.

---

# 🚀 Getting Started

Follow the steps below to set up FINNECT Finance OS on your local machine for development and testing.

---

# 📋 Prerequisites

Ensure the following software is installed before running the project.

| Software | Recommended Version |
| :-------- | :-----------------: |
| Python | 3.12+ |
| Node.js | 20+ |
| npm | Latest |
| PostgreSQL | 16+ |
| Git | Latest |

---

# 📦 Clone the Repository

```bash
git clone https://github.com/sakethreddymamidigari/FINNECT-Finance-OS.git

cd FINNECT-Finance-OS
```

---

# ⚙️ Backend Setup

Navigate to the backend directory.

```bash
cd backend
```

---

## Create Virtual Environment

### Windows

```bash
python -m venv .venv
```

Activate the virtual environment.

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

Create a `.env` file inside the **backend** directory.

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

## Run Backend Server

```bash
python -m uvicorn backend.app.main:app --reload
```

Backend will be available at

```text
http://127.0.0.1:8000
```

Swagger API Documentation

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

---

```bash
npm install
```

---

Create a `.env` file inside the frontend directory.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## Start Development Server

```bash
npm run dev
```

Frontend will be available at

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

Register a Finance Owner.

Login using your credentials.

Begin managing customers, loans, payments, and reports.

---

# 🌍 Production Deployment

| Platform | URL |
| :------- | :-- |
| Vercel | https://finnect-finance-os.vercel.app |

---

| Platform | URL |
| :------- | :-- |
| Render | https://finnect-backend-hrq8.onrender.com |

---

## API Documentation

| Documentation | URL |
| :------------ | :-- |
| Swagger UI | https://finnect-backend-hrq8.onrender.com/docs |

---

# 🔄 CI/CD Pipeline

FINNECT Finance OS follows an automated deployment workflow using GitHub, Render, and Vercel.

```text
                   Developer
                       │
                       ▼
               Local Development
                       │
                Git Commit & Push
                       │
                       ▼
        ┌─────────────────────────────┐
        │        GitHub Repository     │
        └──────────────┬──────────────┘
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
     Render Deployment     Vercel Deployment
     (FastAPI Backend)     (React Frontend)
             │                   │
             └─────────┬─────────┘
                       ▼
              Production Environment
```

Every push to the configured branch automatically triggers deployment, ensuring that the latest application version is published with minimal manual intervention.

---

# 📚 API Documentation

Interactive API documentation is automatically generated by FastAPI using the OpenAPI specification.

| Feature | Availability |
| :------ | :----------- |
| Interactive Swagger UI | ✅ |
| OpenAPI Specification | ✅ |
| Request Validation | ✅ |
| Response Schemas | ✅ |
| Authentication Testing | ✅ |

Swagger URL

```text
https://finnect-backend-hrq8.onrender.com/docs
```

---

# 🔐 Security Features

FINNECT Finance OS incorporates industry-standard security practices to protect user accounts and financial data.

| Feature | Description |
| :------ | :---------- |
| JWT Authentication | Secure stateless authentication |
| BCrypt Password Hashing | Passwords are never stored in plain text |
| Protected API Routes | Authentication required for secured endpoints |
| Request Validation | Pydantic schema validation |
| SQLAlchemy ORM | Prevents SQL injection through parameterized queries |
| Environment Variables | Sensitive configuration stored outside source code |
| CORS Configuration | Controlled cross-origin access |
| HTTP Exception Handling | Standardized error responses |

---

# ⚡ Performance Highlights

The project is designed with a modular architecture that promotes scalability, maintainability, and efficient request processing.

Key architectural strengths include:

- Layered backend architecture
- Modular service-based business logic
- SQLAlchemy ORM relationship management
- Reusable Pydantic schemas
- Stateless JWT authentication
- Efficient PostgreSQL queries
- RESTful API design
- Frontend and backend separation
- Production-ready deployment
- Maintainable project structure

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
| Dashboard | ✅ |
| Reports | ✅ |
| Finance Settings | ✅ |
| JWT Authentication | ✅ |
| Swagger Documentation | ✅ |
| Production Deployment | ✅ |

---

# 🚀 Future Enhancements

FINNECT Finance OS has been designed with a modular architecture, allowing additional features to be integrated without major architectural changes.

The following enhancements are planned for future releases.

| Feature | Description | Status |
| :------ | :---------- | :----: |
| WhatsApp Payment Reminders | Automatically notify customers about upcoming due dates and overdue payments. | 🔄 Planned |
| SMS Notifications | Send payment confirmations and loan reminders. | 🔄 Planned |
| Receipt Generation | Generate printable PDF payment receipts. | 🔄 Planned |
| Export Reports | Export reports in Excel and PDF formats. | 🔄 Planned |
| Advanced Analytics | Business trends, growth metrics, and revenue insights. | 🔄 Planned |
| Multi-Branch Support | Manage multiple finance offices from a single platform. | 🔄 Planned |
| Employee Management | Role-based access for staff members. | 🔄 Planned |
| Audit Logs | Maintain complete activity history. | 🔄 Planned |
| Email Notifications | Automated finance-related notifications. | 🔄 Planned |
| Cloud File Storage | Secure document storage for customer records. | 🔄 Planned |

---

# 🤝 Contributing

Contributions are welcome and greatly appreciated.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push the branch to GitHub.
5. Open a Pull Request.

```bash
git checkout -b feature/your-feature-name

git add .

git commit -m "Add new feature"

git push origin feature/your-feature-name
```

Please ensure that all code follows the project's coding standards and is properly tested before submitting a pull request.

---

# 📝 Coding Standards

The project follows a clean and maintainable architecture.

### Backend

- Follow PEP 8 coding conventions.
- Use descriptive function and variable names.
- Keep business logic inside service modules.
- Validate all requests using Pydantic.
- Handle exceptions using FastAPI HTTPException.
- Keep database access inside SQLAlchemy models and services.

---

### Frontend

- Use TypeScript for type safety.
- Create reusable React components.
- Keep API calls inside dedicated service files.
- Organize pages by feature.
- Maintain responsive layouts.

---

# 📈 Project Highlights

## Business Features

- Finance Owner Authentication
- Customer Management
- Loan Management
- Loan Statements
- Payment Management
- Loan Renewals
- Loan Settlement
- Dashboard Analytics
- Reports
- Finance Settings

---

## Technical Highlights

- Full-Stack Web Application
- RESTful API Architecture
- React + TypeScript Frontend
- FastAPI Backend
- SQLAlchemy ORM
- PostgreSQL Database
- JWT Authentication
- BCrypt Password Hashing
- Alembic Database Migrations
- Production Deployment
- Modular Service Architecture
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
| Deployment | Vercel + Render |
| Version Control | Git + GitHub |

---

# 🏆 Learning Outcomes

The development of FINNECT Finance OS involved practical implementation of modern software engineering concepts, including:

- REST API Development
- Authentication & Authorization
- Database Design
- ORM Relationships
- Backend Architecture
- Frontend Development
- State Management
- Production Deployment
- Environment Configuration
- API Documentation
- Database Migrations
- Version Control
- Full-Stack Integration

---

# 📄 License

This project is licensed under the **MIT License**.

You are free to:

- Use
- Modify
- Distribute
- Fork

in accordance with the terms of the MIT License.

---

# 👨‍💻 Author

<div align="center">

## Saketh Reddy Mamidigari

**Backend Python Developer**

GitHub

https://github.com/sakethreddymamidigari

LinkedIn

https://www.linkedin.com/in/mamidigari-saketh-reddy

Email

sakethreddymamidigari@gmail.com

</div>

---

# 🙏 Acknowledgements

Special thanks to the open-source community and the creators of the technologies that made this project possible.

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

## ⭐ If you found this project helpful, please consider giving it a Star on GitHub!

**FINNECT Finance OS** was developed to demonstrate real-world full-stack software engineering practices, scalable backend architecture, and modern web application development using React, FastAPI, and PostgreSQL.

</div>