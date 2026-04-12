# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Thoughtful.day is a journaling web application deployed at https://www.thoughtful.day/. Users create journal entries using templates (freeform, gratitude, accomplishment), track streaks, and search/filter past entries.

## Tech Stack

- **Backend:** Node.js, Express.js, EJS templating
- **Database:** PostgreSQL with Sequelize ORM
- **Frontend:** Bootstrap 5, vanilla JS
- **Deployment:** Heroku (see `Procfile`)

## Development Commands

```bash
# Start dev server (uses nodemon for auto-reload)
nodemon

# Start production server
node .

# Database setup
npx sequelize db:create        # Create "thoughtful_day" database
npx sequelize db:migrate       # Run migrations
npx sequelize db:seed:all      # Seed tags

# No test suite configured
```

## Required Environment Variables (.env)

- `PORT` — Server port (default 8000)
- `ENC_KEY` — AES encryption key for user session cookies
- `DATABASE_URL` — PostgreSQL connection string (production only)

## Architecture

**MVC pattern** with Express routing:

- `index.js` — App entry point, middleware setup, auth middleware, and route mounting
- `controllers/` — Route handlers (`users.js` for auth/profile, `entry.js` for CRUD entries)
- `models/` — Sequelize models with associations (user hasMany entries, entries belongsToMany tags)
- `views/` — EJS templates organized by feature (`entries/`, `users/`, `partials/`)
- `public/` — Static assets (CSS, images, videos)
- `config/config.json` — Sequelize DB config (dev uses local `thoughtful_day` DB, prod uses `DATABASE_URL`)

## Authentication Flow

Passwords are hashed with bcrypt (12 rounds). On login, the user ID is AES-encrypted with `crypto-js` using `ENC_KEY` and stored in a `userId` cookie. Middleware on every request decrypts the cookie and loads the user into `res.locals.user`.

## Database Schema

- **users** — Profile data, `template` (JSONB for selected templates), `commitment` (JSONB), streak tracking, timezone
- **entries** — `content` (JSONB with fields content1-content6), `type` (template name), belongs to user
- **tags** — Pre-seeded set of 28 emotion/theme tags
- **entry_tag** — Join table for many-to-many entries↔tags

## Entry Templates

Three template types with different prompt fields stored in `content` JSONB:
- **Freeform** — Open-ended journaling
- **Gratitude** — Structured gratitude prompts
- **Accomplishment** — Achievement-focused prompts

Each has separate EJS files for create (`views/entries/templates/`), edit (`templates/edit/`), and display (`templates/display/`).

## External APIs

- **Stoic Quote API** (`https://api.themotivate365.com/stoic-quote`) — Daily quotes shown on entry pages
- **Uploadcare** — Profile image uploads via widget
