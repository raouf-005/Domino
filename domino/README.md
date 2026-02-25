## Domino Web (Frontend Only)

This `domino` package is now **frontend-only** (Next.js UI).  
It does not host backend/socket logic anymore.

## Required backend

Run the backend from the sibling project: `domino-server`.

Default backend URL:

- `http://localhost:3001`

## Environment

Create `.env.local` in this folder with:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
