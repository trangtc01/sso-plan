# Project Overview

## Product

Local/internal social video scheduler and publishing automation for one operator.

Primary capabilities visible in the current source:
- upload MP4/MOV through a Next.js admin
- save video metadata in PostgreSQL through NestJS API
- select one or multiple platforms
- schedule execution with BullMQ delayed jobs
- TikTok: use Playwright to create a draft
- Facebook: publish through Meta Graph/Reels integration
- YouTube: publish through Playwright/YouTube Studio
- bulk import schedule rows from TXT
- persist per-platform job status and retry state

## Technology

- TypeScript / Node.js
- Next.js admin
- NestJS API
- PostgreSQL + Prisma
- Redis + BullMQ
- Playwright
- Meta Graph API for Facebook
- local file storage

## Operational model

This is not currently designed as a multi-tenant SaaS. Browser automation uses persistent profiles and requires careful session/profile handling.
