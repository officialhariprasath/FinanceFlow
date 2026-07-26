<h1 align="center">
FINNECT Finance OS
</h1>

<p align="center">
A modern Full Stack Loan Management System built for finance businesses using <b>FastAPI</b>, <b>React</b>, <b>TypeScript</b>, <b>PostgreSQL</b>, and <b>SQLAlchemy</b>.
</p>

<p align="center">

![Python](https://img.shields.io/badge/Python-3.12-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116-green?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-ORM-red?style=for-the-badge)
![JWT](https://img.shields.io/badge/JWT-Authentication-black?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

</p>

---

# Table of Contents

- Project Overview
- Business Problem
- Solution
- Key Features
- Screenshots
- Tech Stack
- System Architecture
- Project Structure
- Database Design
- Business Workflow
- Authentication Flow
- API Modules
- Installation
- Environment Variables
- Running the Backend
- Running the Frontend
- API Documentation
- CI/CD Pipeline
- Deployment
- Security
- Future Enhancements
- Contributing
- License
- Author

---

# Project Overview

FINNECT Finance OS is a modern full-stack Loan Management System developed to digitize the day-to-day operations of finance businesses.

The application manages the complete loan lifecycle—from customer registration to loan issuance, payment collection, renewals, settlements, and business reporting.

Unlike a basic CRUD application, FINNECT implements real-world finance business logic such as:

- Multiple interest calculation methods
- Automatic interest-first payment allocation
- Loan renewals
- Loan settlements
- Dashboard analytics
- Business reports
- JWT authentication
- Secure REST APIs

The system is designed for finance companies, lending agencies, and businesses that require efficient loan tracking and customer management.

---

# Business Problem

Many small and medium finance businesses still rely on spreadsheets, notebooks, and manual calculations to manage their lending operations.

This leads to:

- Human calculation errors
- Missing payment records
- Poor customer tracking
- Manual interest calculations
- No centralized reporting
- Difficult loan renewals
- Lack of business insights

---

# Solution

FINNECT Finance OS provides a centralized digital platform that enables finance businesses to:

- Manage customers
- Create loans
- Record payments
- Renew loans
- Settle loans
- Track outstanding balances
- View financial reports
- Monitor business performance in real time

---

# Key Features

## Authentication

- Finance Owner Registration
- Secure Login
- JWT Authentication
- Password Hashing using BCrypt
- Protected REST APIs

---

## Customer Management

- Register Customers
- Edit Customer Information
- Search Customers
- View Customer Details
- Customer Loan History

---

## Loan Management

- Create Loan
- Edit Loan
- Loan Statements
- Loan Search
- Interest Summary
- Settlement Preview
- Loan Settlement
- Loan Renewal

---

## Payment Management

- Record Payments
- Automatic Interest Allocation
- Principal Tracking
- Payment History
- Latest Payment Deletion Validation

---

## Dashboard

Business overview including:

- Total Customers
- Active Loans
- Closed Loans
- Today's Collection
- Principal Disbursed
- Remaining Principal
- Principal Paid
- Interest Collected
- Recent Loans
- Recent Payments

---

## Reports

- Profit Summary
- Maturity Report
- Overdue Loans
- Closed Loans

---

## Finance Settings

- Interest Configuration
- Finance Owner Profile
- Business Settings

---

# Project Screenshots

## Dashboard

![Login page](docs/screenshots/login.png)

---


![Dashboard](docs/screenshots/dashboard.png)

---

## Customers

![Customers](docs/screenshots/customers.png)

---

## Loans

![Loans](docs/screenshots/loans.png)

---

## Payments

![Payments](docs/screenshots/payments.png)

---

## Renewals

![Renewals](docs/screenshots/renewals.png)

---

## Reports

![Reports](docs/screenshots/reports.png)

---

# Tech Stack

## Frontend

| Technology   | Purpose            |
|--------------|--------------------|
| React 19     | Frontend Framework |
| TypeScript   | Type Safety        |
| Vite         | Build Tool         |
| React Router | Routing            |
| Axios        | API Communication  |
| CSS          | User Interface     |

---

## Backend

| Technology       | Purpose              |
|------------------|----------------------|
| Python           | Programming Language |
| FastAPI          | REST API Framework   |
| SQLAlchemy       | ORM                  |
| PostgreSQL       | Database             |
| Alembic          | Database Migration   |
| JWT              | Authentication       |
| Passlib + BCrypt | Password Hashing     |
| Pydantic         | Data Validation      |

---

## Development Tools

| Tool           | Purpose            |
|----------------|--------------------|
| Git            | Version Control    |
| GitHub         | Repository Hosting |
| GitHub Actions | CI/CD              |
| Docker         | Containerization   |
| Swagger UI     | API Documentation  |
| Postman        | API Testing        |
| VS Code        | Development IDE    |

---

# System Architecture

The application follows a modern three-tier architecture.

```text
                    +----------------------+
                    |     React Frontend   |
                    |   (TypeScript + Vite)|
                    +----------+-----------+
                               |
                               |
                     REST APIs (JWT)
                               |
                               |
                    +----------v-----------+
                    |    FastAPI Backend   |
                    | Authentication       |
                    | Loan Services        |
                    | Payment Services     |
                    | Dashboard Services   |
                    +----------+-----------+
                               |
                               |
                      SQLAlchemy ORM
                               |
                               |
                    +----------v-----------+
                    |    PostgreSQL DB     |
                    +----------------------+
```

---

# Project Structure

```text
FINNECT-Finance-OS/
│
├── backend/
│   │
│   ├── app/
│   │   │
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── customers.py
│   │   │   ├── loans.py
│   │   │   ├── payments.py
│   │   │   ├── renewals.py
│   │   │   ├── dashboard.py
│   │   │   └── settings.py
│   │   │
│   │   ├── core/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── dependencies/
│   │   └── main.py
│   │
│   ├── alembic/
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   │
│   ├── public/
│   ├── src/
│   │   │
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │
│   │   │   ├── Dashboard/
│   │   │   ├── Customers/
│   │   │   ├── Loans/
│   │   │   ├── Payments/
│   │   │   ├── Renewals/
│   │   │   └── Settings/
│   │   │
│   │   ├── router/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── types/
│   │   └── App.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   └── screenshots/
│
├── .github/
│   └── workflows/
│
├── LICENSE
├── README.md
└── .gitignore
```

---

# Core Modules

The project consists of the following modules:

- Authentication
- Customer Management
- Loan Management
- Payment Management
- Loan Renewal
- Loan Settlement
- Dashboard
- Reports
- Finance Settings

Each module is independently structured while sharing a common authentication layer.

---

# Database Design

The backend is powered by PostgreSQL using SQLAlchemy ORM.

## Primary Entities

```text
Finance Owner
      │
      │ 1
      │
      │ N
Customer
      │
      │ 1
      │
      │ N
Loan
      │
 ┌────┴───────────┐
 │                │
 │                │
 N                N
Payment      Loan Renewal
```

---

## Finance Owner

Stores authentication and ownership information.

Responsibilities:

- Login
- Registration
- Business ownership
- Dashboard access

---

## Customer

Stores borrower information.

Includes:

- Name
- Phone Number
- Address
- Notes

Each customer can own multiple loans.

---

## Loan

Stores:

- Principal Amount
- Interest Rate
- Interest Method
- Issue Date
- Due Date
- Remaining Principal
- Total Interest Paid
- Total Principal Paid
- Loan Status

---

## Payment

Tracks every payment made against a loan.

Includes:

- Payment Amount
- Interest Component
- Principal Component
- Payment Mode
- Payment Date
- Notes

---

## Loan Renewal

Maintains renewal history.

Includes:

- Previous Due Date
- New Due Date
- Updated Interest Rate
- Updated Interest Method
- Remarks

---

# Business Workflow

```text
Finance Owner

        │

        ▼

Secure Login

        │

        ▼

Customer Registration

        │

        ▼

Loan Creation

        │

        ▼

Interest Calculation

        │

        ▼

Payment Collection

        │

 ┌──────┴─────────┐

 ▼                ▼

Renew Loan   Settle Loan

        │

        ▼

Dashboard Reports

        │

        ▼

Business Analytics
```

---

# Authentication Flow

```text
Finance Owner

      │

Login Request

      │

      ▼

Verify Credentials

      │

      ▼

Generate JWT Token

      │

      ▼

Frontend Stores Token

      │

      ▼

Protected API Requests

      │

      ▼

JWT Validation Middleware

      │

      ▼

Authorized Access
```

---

# API Modules

## Authentication

Responsible for finance owner authentication.

| Method  |      Endpoint              |       Description       |
|---------|----------------------------|-------------------------|
| POST    | `/finance-owners/register` | Register Finance Owner  |
| POST    | `/finance-owners/login`    | Login                   |
| GET     | `/finance-owners/me`       | Current Logged-in Owner |

---

## Customers

Customer lifecycle management.

| Method  | Endpoint            |
|---------|---------------------|
| POST    | `/customers`        |
| GET     | `/customers`        |
| GET     | `/customers/{id}`   |
| PUT     | `/customers/{id}`   |
| DELETE  | `/customers/{id}`   |
| GET     | `/customers/search` |

---

## Loans

Loan lifecycle APIs.

| Method  | Endpoint                       |
|---------|--------------------------------|
| POST    | `/loans`                       |
| GET     | `/loans`                       |
| GET     | `/loans/{id}`                  |
| PUT     | `/loans/{id}`                  |
| DELETE  | `/loans/{id}`                  |
| GET     | `/loans/search`                |
| GET     | `/loans/{id}/statement`        |
| GET     | `/loans/{id}/interest-summary` |

---

## Payments

Payment management.

| Method  | Endpoint         |
|---------|------------------|
| POST    | `/payments`      |
| GET     | `/payments`      |
| PUT     | `/payments/{id}` |
| DELETE  | `/payments/{id}` |

---

## Renewals

Loan renewal APIs.

| Method  | Endpoint                 |
|---------|--------------------------|
| POST    | `/loans/{loan_id}/renew` |
| GET     | `/renewals`              |
| GET     | `/renewals/{id}`         |

---

## Settlement

Loan settlement operations.

| Method  | Endpoint                         |
|---------|----------------------------------|
| GET     | `/loans/{id}/settlement-preview` |
| POST    | `/loans/{id}/settlement`         |

---

## Dashboard

Business analytics endpoints.

| Method  | Endpoint                     |
|---------|------------------------------|
| GET     | `/dashboard`                 |
| GET     | `/dashboard/profit-summary`  |
| GET     | `/dashboard/maturity-report` |
| GET     | `/dashboard/overdue-loans`   |
| GET     | `/dashboard/closed-loans`    |

---

# Interest Calculation

FINNECT supports two interest calculation methods.

## Percentage Method

Interest is calculated monthly based on the outstanding principal.

Example:

```
Principal : ₹100,000

Interest Rate : 2%

Monthly Interest : ₹2,000
```

---

## Rupees per ₹100 Method

Traditional finance calculation.

Example:

```
₹3 per ₹100 per month

Principal : ₹100,000

Monthly Interest : ₹3,000
```

---

# Business Rules

FINNECT implements several real-world finance rules.

- Interest is always collected before principal.
- Principal cannot be reduced while interest is pending.
- Only the latest payment can be deleted.
- Renewals preserve loan history.
- Settlement supports waived amounts.
- Dashboard metrics are calculated directly from the database.
- All APIs are protected using JWT authentication.

# Getting Started

Follow the steps below to run FINNECT Finance OS locally.

---

# Prerequisites

Before running the project, ensure the following software is installed.

| Software   | Version |
|------------|---------|
| Python     | 3.11+   |
| Node.js    | 20+     |
| PostgreSQL | 15+     |
| Git        | Latest  |
| npm        | Latest  |

---

# Clone Repository

```bash
git clone https://github.com/sakethreddymamidigari/FINNECT-Finance-OS.git

cd FINNECT-Finance-OS
```

---

# Backend Setup

## Create Virtual Environment

### Windows

```bash
python -m venv venv

venv\Scripts\activate
```

### Linux/macOS

```bash
python3 -m venv venv

source venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Configure Environment Variables

Create a `.env` file inside the backend directory.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/finnect

SECRET_KEY=your_secret_key

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

## Run Database Migrations

```bash
alembic upgrade head
```

---

## Start Backend Server

```bash
python -m uvicorn backend.app.main:app --reload
```

Backend will run on:

```
http://127.0.0.1:8000
```

---

# Frontend Setup

Navigate to the frontend directory.

```bash
cd frontend
```

---

## Install Packages

```bash
npm install
```

---

## Configure Frontend Environment

Create:

```
frontend/.env
```

Example:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## Start Frontend

```bash
npm run dev
```

Frontend will run on:

```
http://localhost:5173
```

---

# Running the Complete Application

Open two terminals.

Terminal 1

```bash
python -m uvicorn backend.app.main:app --reload
```

Terminal 2

```bash
cd frontend

npm run dev
```

---

# API Documentation

FastAPI automatically generates interactive API documentation.

Swagger UI

```
http://127.0.0.1:8000/docs
```

ReDoc

```
http://127.0.0.1:8000/redoc
```

---

# Environment Variables

Backend

| Variable                    | Description                  |
|-----------------------------|------------------------------|
| DATABASE_URL                | PostgreSQL connection string |
| SECRET_KEY                  | JWT secret                   |
| ALGORITHM                   | JWT algorithm                |
| ACCESS_TOKEN_EXPIRE_MINUTES | Token expiration             |



Frontend

| Variable          | Description     |
|-------------------|-----------------|
| VITE_API_BASE_URL | Backend API URL |

---

# CI/CD Pipeline

The project uses GitHub Actions to automate build and deployment.

Pipeline Overview

```text
Developer

    │

Push to GitHub

    │

GitHub Actions

    │

Install Dependencies

    │

Backend Checks

    │

Frontend Build

    │

Build Successful

    │

Deploy Application

    │

Production
```

Typical CI steps include:

- Checkout repository
- Install backend dependencies
- Install frontend dependencies
- Build frontend
- Validate backend
- Run tests (if configured)
- Deploy after successful build

---

# Deployment

## Frontend

The frontend can be deployed to:

- Vercel
- Netlify

Recommended:

```
Vercel
```

---

## Backend

The backend can be deployed to:

- Render
- Railway
- Azure App Service
- AWS EC2

---

## Database

Recommended production database:

```
PostgreSQL
```

---

# Security Features

FINNECT follows secure backend development practices.

Implemented features include:

- JWT Authentication
- BCrypt Password Hashing
- Protected API Routes
- Request Validation using Pydantic
- SQLAlchemy ORM
- Environment Variable Configuration
- Secure Password Storage
- RESTful API Design
- Input Validation
- Structured Error Handling

---

# Performance Highlights

Designed with scalability and maintainability in mind.

Highlights include:

- Modular Service Layer
- Layered Architecture
- SQLAlchemy ORM
- Efficient Database Queries
- Reusable Schemas
- Dependency Injection
- Clean API Structure
- Frontend Component Reusability

---

# Future Enhancements

Planned improvements include:

- OTP Verification
- Google Account Login
- WhatsApp Payment Reminders
- SMS Notifications
- Email Notifications
- PDF Loan Statements
- Excel Report Export
- Dashboard Charts
- Advanced Business Analytics
- Multi-Branch Finance Support
- Role-Based Access Control
- Audit Logs
- Mobile Application
- Cloud Storage Integration

---

# Contributing

Contributions are welcome.

To contribute:

1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Push your branch.
5. Open a Pull Request.

For major changes, please open an issue before starting development.

---

# License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

# Author

## Saketh Reddy Mamidigari

Backend Python Developer

GitHub

```
https://github.com/sakethreddymamidigari

```

LinkedIn

```
http://www.linkedin.com/in/mamidigari-saketh-reddy

---

# Acknowledgements

This project was developed as a real-world finance management solution to demonstrate full-stack software engineering skills using modern technologies including FastAPI, React, TypeScript, PostgreSQL, SQLAlchemy, JWT Authentication, and RESTful API development.

It showcases practical implementation of authentication, business workflows, loan lifecycle management, reporting, and scalable application architecture.

---

<p align="center">

⭐ If you found this project useful, consider giving it a star on GitHub.

</p>

---

<p align="center">

Made with ❤️ using FastAPI, React, TypeScript and PostgreSQL.

</p>