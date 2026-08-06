# Varsity Development Watch

An interactive, community-first view of City of Calgary development permits in Varsity.

**Live site:** https://varsity-development-watch.albert-leung.chatgpt.site

## Purpose

The dashboard makes Calgary's development-permit open data easier for residents and community association members to explore. It brings status, location, timing, decisions and appeal information into one searchable view.

## Features

- Live City of Calgary open-data connection
- Permit status summary
- Approximate geographic activity plot
- Applications-by-year chart
- Search by address, permit number, applicant or description
- Filters by year and status
- Application, decision, release and SDAB appeal details
- Clear data-freshness and official-verification warnings

## Data source

Development Permits — City of Calgary Open Data:
https://data.calgary.ca/Business-and-Economic-Activity/Development-Permits/6933-unw5

The dashboard is an independent public-interest interpretation of municipal open data. It is not an official City notice. For comment periods, appeal deadlines or other time-sensitive decisions, verify the file with the City of Calgary.

## Technology

- React 19
- Next.js-compatible Vinext runtime
- TypeScript
- Tailwind CSS
- Cloudflare-compatible worker deployment

## Local development

Requirements: Node.js 22.13 or newer, Linux, curl, flock and GNU timeout.

```bash
npm ci
npm run dev
```

Production validation:

```bash
npm test
```

## Licence and attribution

Application source is provided in this repository. Municipal data remains subject to the Open Government Licence — City of Calgary.
