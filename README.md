# AIML Department Faculty Feedback Management System

A full-stack web application for managing faculty feedback in the AIML department.

## Tech Stack

- **Frontend:** React (Vite), Tailwind CSS, Chart.js
- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Database:** MongoDB Atlas

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas Account (or local MongoDB)

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   - Rename `.env.example` (if any) or create `.env`
   - Add your MongoDB Connection String and JWT Secret (see `server.js` or prompted `.env`)

4. Generate Excel Template (Optional helper):
   ```bash
   node scripts/create-template.js
   ```
   This creates `DataTemplate.xlsx` which you can use to upload initial data via Admin Dashboard.

5. Start the server:
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5000`.

### 2. Frontend Setup

1. Open a new terminal and navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   App runs on `http://localhost:5173`.

## Usage Guide

1. **Login:**
   - **Student:** Use Roll ID (e.g., `21AI01`) and password (default `1234`).
   - **HOD:** Use HOD credentials (pre-seeded or created via Admin/DB).
   - **Admin:** Use Admin credentials.

2. **Admin Dashboard:**
   - Upload `DataTemplate.xlsx` (with sheets: Students, Faculty, Subjects).
   - Create Feedback Questions (Theory/Lab).
   - Clear database if needed.

3. **Student Portal:**
   - View Dashboard with subjects.
   - Submit feedback for each subject.

4. **HOD Portal:**
   - View analytics (charts, tables).
   - Export reports (PDF, Excel, Word).

## Folder Structure

- `backend/` - Node.js API
- `frontend/` - React Client
