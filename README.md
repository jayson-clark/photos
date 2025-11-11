# Google Photos Clone

A full-stack photo management application built with Node.js, Express, React, and TypeScript.

## Features

-   🔐 User authentication (register, login, logout)
-   📸 Photo upload with metadata extraction
-   📁 Album management
-   🗑️ Photo deletion
-   🔍 Photo metadata viewer
-   📱 Responsive design with TailwindCSS
-   🎨 Modern UI with Lucide icons

## Project Structure

```
photos-clone/
├── apps/
│   ├── backend/          # Express API server
│   └── frontend/         # React frontend
├── packages/
│   └── shared/           # Shared TypeScript types
└── package.json          # Monorepo root
```

## Getting Started

### Prerequisites

-   Node.js 18+
-   npm (v7+ to support workspaces)
-   Git

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

**Backend (.env in apps/backend/):**

```
PORT=3001
JWT_SECRET=your-secret-key-change-this
DATABASE_PATH=./database.sqlite
UPLOAD_DIR=./uploads
# Admin user email - this user will have full admin access
ADMIN_EMAIL=admin@example.com
```

**Frontend (.env in apps/frontend/):**

```
VITE_API_URL=http://localhost:3001
```

4. Start the development servers:

```bash
npm run dev
```

This will start:

-   Backend API on http://localhost:3001
-   Frontend on http://localhost:5173

## Development

-   `npm run dev` - Start both backend and frontend in development mode
-   `npm run build` - Build all packages
-   `npm run clean` - Clean all node_modules and build artifacts

## Tech Stack

### Backend

-   Node.js + Express
-   TypeScript
-   SQLite with better-sqlite3
-   JWT authentication
-   Multer for file uploads
-   Sharp for image processing

### Frontend

-   React 18
-   TypeScript
-   Vite
-   TailwindCSS
-   Lucide React icons
-   Axios for API calls

### Shared

-   TypeScript types shared between frontend and backend

### API Endpoints

### Auth

-   `POST /api/auth/register` - Register new user
-   `POST /api/auth/login` - Login user
-   `GET /api/auth/me` - Get current user from token

Note: there is no server-side "logout" endpoint; logging out is handled client-side by removing the stored JWT.

### Admin

-   All admin endpoints require an authenticated user with the admin role. The server enforces this with `authMiddleware` and `requireAdmin`.
-   `GET /api/admin/users` - Get all users with their whitelist status. Response: array of users with fields `id`, `email`, `username`, `isWhitelisted` (boolean), `createdAt`.
-   `PATCH /api/admin/users/:id/whitelist` - Update a user's whitelist status. Request body: `{ "isWhitelisted": true|false }`. Note: the admin cannot remove whitelist from their own account (the server will return 400 in that case). Returns the updated user object.

### Photos

-   `GET /api/photos` - Get all photos
-   `POST /api/photos` - Upload photo(s)
-   `GET /api/photos/:id` - Get photo by ID
-   `DELETE /api/photos/:id` - Delete photo
-   `GET /api/photos/:id/metadata` - Get photo metadata

### Albums

-   `GET /api/albums` - Get all albums
-   `POST /api/albums` - Create album
-   `GET /api/albums/:id` - Get album by ID
-   `PUT /api/albums/:id` - Update album
-   `DELETE /api/albums/:id` - Delete album
-   `POST /api/albums/:id/photos` - Add photos to album
-   `DELETE /api/albums/:id/photos/:photoId` - Remove photo from album

## License

MIT
