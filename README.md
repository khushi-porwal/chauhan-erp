# Chauhan ERP

A cloud-based, multi-company ERP system for Retail, Trading, Wholesale, Distribution, and Service businesses — built with enterprise architecture principles similar to SAP Business One, Oracle NetSuite, and Microsoft Dynamics.

## Monorepo Structure

```
chauhan-erp/
├── backend/         # Node.js + Express + Prisma REST API
├── frontend/         # React.js SPA
├── docs/             # Architecture docs, ERDs, API specs
├── .editorconfig
├── .gitignore
├── .nvmrc
├── package.json      # Root workspace orchestration
└── README.md
```

## Tech Stack

| Layer          | Technology                                  |
|----------------|----------------------------------------------|
| Frontend       | React.js, React Router, Axios, Redux Toolkit, Tailwind CSS |
| Backend        | Node.js, Express.js                          |
| Database       | PostgreSQL                                   |
| ORM            | Prisma                                       |
| Auth           | JWT (Access + Refresh Tokens), bcrypt        |
| Validation     | express-validator                            |
| Logging        | Winston                                      |
| Docs           | Swagger / OpenAPI                            |
| Cloud          | AWS / DigitalOcean                           |

## Development Phases

This project is built module-by-module. See `docs/ROADMAP.md` for the full phase breakdown.

**Current Phase:** Phase 1 — Authentication & Security

## Getting Started

Prerequisites: Node.js 20.x (see `.nvmrc`), PostgreSQL 15+, Git.

```bash
git clone <repo-url>
cd chauhan-erp
nvm use
npm install
```

Backend and frontend setup instructions live in their respective folders (`backend/README.md`, `frontend/README.md`) — these will be added in upcoming steps.

## License

Proprietary — All rights reserved.
