# Ydays Backend

This is the backend for the Ydays project. It provides APIs, database management, and core business logic for the application.

## Features
- RESTful API endpoints
- Prisma ORM for database management
- User authentication and authorization
- Reservation system
- Modular service architecture

## Project Structure
```
ydays-backend/
├── casablanca_reservation_db.sql   # Database schema and seed data
├── package.json                   # Node.js dependencies and scripts
├── prisma/                        # Prisma schema and migrations
│   ├── schema.prisma
│   └── migrations/
├── src/                           # Source code
│   ├── index.js                   # Main entry point
│   ├── common/                    # Shared utilities
│   ├── config/                    # Configuration files
│   ├── lib/                       # Core libraries
│   └── services/                  # Business logic and API services
└── README.md                      # Project documentation
```

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- PostgreSQL or compatible database

### Installation
1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd ydays-backend
   ```
2. Install dependencies:
   ```sh
   npm install
   # or
   yarn install
   ```
3. Set up the database:
   - Create a PostgreSQL database.
   - Update the connection string in `prisma/schema.prisma`.
   - Run migrations:
     ```sh
     npx prisma migrate dev
     ```
   - (Optional) Seed the database using `casablanca_reservation_db.sql`.

### Running the Server
```sh
npm start
# or
yarn start
```

## Environment Variables
Create a `.env` file in the root directory and configure your database and other secrets:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ydays_db
JWT_SECRET=your_jwt_secret
```

## Scripts
- `npm start` — Start the server
- `npm run dev` — Start the server in development mode
- `npm run migrate` — Run Prisma migrations

## License
MIT

## Contact
For questions or support, contact the Ydays team.
