# BillBoy

Compare **two bills**: last month and this month. Each can be a PDF or a screenshot, so PDF + PDF and PDF + image both work. BillBoy extracts printed totals, usage, and charges with Gemini 3.5 Flash-Lite. Ordinary JavaScript calculates the difference and writes a readable `report.md` and a structured `report.json` **in this folder**. Your source files stay here. There is no Google Drive, Sheet, database, deployment, or scheduled background process.

## Run it on Windows

1. Install Node.js 18 or newer if `node --version` does not work.
2. Put both bills in `C:\Users\anubh\Desktop\billBoy`. Use PDF, PNG, JPEG, or WebP; each file must be 6 MB or less. Make sure the payable total and charge breakdown are readable. For PDFs, use short bills; more pages use more model tokens.
3. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). In **PowerShell**, run:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\anubh\Desktop\billBoy'
   .\run.ps1 'last-month.pdf' 'this-month.pdf'
   ```

   Replace the filenames with your actual files. The script prompts for your Gemini key without displaying it, uses it for this run, and does not save it. Mixed formats work, for example `.\run.ps1 'last-month.pdf' 'this-month.png'`. Open `report.md` to read the result. `report.json` contains the extracted fields and token counts.

If you prefer to set `GEMINI_API_KEY` in your terminal yourself, you can run `node compare.js` directly. Running the same pair again reuses `report.json` without another Gemini request. A different pair replaces `report.md` and `report.json`; keep a copy of an earlier report in this folder if you want a history.

## How it decides what changed

One Gemini request contains both files with labels identifying the previous and current month. Gemini returns structured fields. BillBoy refuses to compare when either payable total is unreadable, currencies differ, or the provider names clearly differ. It calculates amount and percentage change using JavaScript, compares usage only when both units match, and describes up to three printed charges that changed. If the charge breakdown is cut off or not readable, it says that the specific cause is unclear. It does not infer a missing charge or decide that the provider made a billing error.

No bill is paid, no account is changed, and no message is sent. The original bills remain the source of truth.

## Cost and privacy

BillBoy calls Gemini **only when you run it with a new pair**. `report.json` records the model and input, output, and thinking token counts returned by the API. Both bills are sent to Google's Gemini API for analysis, even though the source files and report stay local. Gemini 3.5 Flash-Lite has a free tier subject to rate limits; check Google's [current pricing and limits](https://ai.google.dev/gemini-api/docs/pricing) before running. Use synthetic, non-confidential bills for a demo and consider Google's data terms before using real bills containing personal information.

## Demo and checks

Two fictional consolidated company-cost invoices are included: `julybill.pdf` and `augbill.pdf`. They cover payroll, rent, utilities, software, marketing, travel, supplies, telecom, professional services, and equipment repairs. To compare them, run `.\run.ps1 'julybill.pdf' 'augbill.pdf'`. The printed total rises from USD 98,500 to USD 106,700, an increase of USD 8,200. Run the command again to demonstrate that no second model call is made.

Run `node smoke.test.js` for local tests. They mock Gemini and check PDF/image requests, arithmetic, incomplete breakdowns, and mismatch handling. A successful live comparison still needs to be verified with a Gemini API key. If Gemini returns HTTP 503 (high demand), retry later; no report is written for a failed request.
