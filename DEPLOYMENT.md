# Render Deployment Notes

This dashboard is deployed on Render and reads the keyword-search CSV from Google Drive.

## Required environment variables

- `PORT=3000`
- `HOST=0.0.0.0`
- `KEYWORD_CSV_URL=...` or `KEYWORD_CSV_FILE_ID=...`

## Recommended environment variables

- `UPSTAGE_API_KEY=...`
- `GOOGLE_AI_API_KEY=...`
- `AUDIT_PDF_DIR=...`

## Render settings

- `buildCommand`: `npm ci`
- `startCommand`: `npm start`
- `healthCheckPath`: `/healthz`

## Post-deploy checks

1. Open `/healthz` and confirm it returns `200`.
2. Open `/api/keyword-audit-source.csv` and confirm CSV text is returned.
3. Open the dashboard and test keyword search with a title keyword such as `scholarship`.

## Keyword data flow

1. Google Sheets is the source of truth.
2. Apps Script exports the sheet to `keyword-audit-source.csv` on Google Drive.
3. Render reads the Drive file through `KEYWORD_CSV_URL` or `KEYWORD_CSV_FILE_ID`.
4. The dashboard loads the CSV through `/api/keyword-audit-source.csv`.

## Recommended setup

1. Copy the Google Drive share link for the CSV file.
2. Set that link as `KEYWORD_CSV_URL` in Render.
3. If you prefer, you can set `KEYWORD_CSV_FILE_ID` instead.
4. The server normalizes common Drive share links into a direct download URL, so the dashboard can read them without a separate manual export URL.
