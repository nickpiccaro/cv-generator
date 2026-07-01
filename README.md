# Academic CV Generator

A GitHub Pages web app for editing academic CV data as JSON, previewing the CV, and exporting local files.

Live app:

https://nickpiccaro.github.io/cv-generator/

## What It Does

- Start from a blank JSON, the John Doe template JSON, or an uploaded JSON file.
- Edit profile details, section entries, section order, and section schemas in the browser.
- Save the CV JSON back to a local file.
- Export generated LaTeX as `.tex`.
- Use the browser print dialog to save the preview as a PDF.

The app is static and client-side only. CV data is not uploaded to a server.

## Run Locally

```bash
npm install
npm run dev
```

The local app runs at `http://localhost:5173/`.

## Build

```bash
npm run build
```

The production build is written to `docs/` with the `/cv-generator/` base path for GitHub Pages.

## GitHub Pages

`.github/workflows/pages.yml` builds the app and deploys `docs/` to GitHub Pages on pushes to `main`.

## Data Model

The CV is a single JSON document. Each section owns:

- `title`
- `kind`
- `hiddenWhenEmpty`
- `fields`
- `items`

Fields can be text, textarea, date, date range, authors, bullets, tags, URL, number, or select. Citation-style sections bold any author variant listed in `profile.ownerNames`.
