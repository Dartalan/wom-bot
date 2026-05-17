# CLAUDE.md

This file provides guidance to Claude Code when working on the wom-bot project.

## Project Overview
Discord bot that automatically creates Wise Old Man (WOM) competitions every Monday and posts end-of-week results reports to Discord on Sunday. Maintained by a non-developer — prioritize readability over cleverness at all times.

## Stack
- Runtime: Node.js
- Discord library: discord.js
- Scheduling: node-cron
- HTTP requests: axios
- Config/secrets: dotenv

## File Structure
- src/wom.js         — All Wise Old Man API calls
- src/bot.js         — Discord bot setup and slash commands
- src/scheduler.js   — All cron/scheduling logic
- src/storage.js     — Reading and writing competition data to disk
- config.js          — Competition definitions (safe for non-devs to edit)
- .env               — Secrets and tokens (never commit this file)

## Code Style Rules
- Every function MUST have a plain-English comment explaining what it does and why
- Use descriptive variable names (competitionTitle not ct, channelId not cid)
- No clever one-liners — if it needs explaining, write it out in full
- Keep each file focused on one job only
- Do not combine files that are currently separate

## What Claude Should NOT Do
- Do not refactor working code unless explicitly asked
- Do not add new dependencies without asking first
- Do not delete or shorten comments
- Do not hardcode any tokens, IDs, or secrets — everything sensitive goes in .env
