# BillBoy

Compare **two bills**: last month and this month. Each can be a PDF or a screenshot, so PDF + PDF and PDF + image both work. BillBoy extracts printed totals, usage, and charges with Gemini. Ordinary JavaScript calculates the difference and writes a readable `report.md` and a structured `report.json` **in this folder**. Your source files stay here. There is no Google Drive, Sheet, database, deployment, or scheduled background process.

## Run it on Windows

1. Install Node.js 18 or newer if `node --version` does not work.
2. Put both bills in `C:\Users\anubh\Desktop\billBoy`. Use PDF, PNG, JPEG, or WebP; each file must be 6 MB or less. Make sure the payable total and charge breakdown are readable. For PDFs, use short bills; more pages use more model tokens.
3. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). In **PowerShell**, set it for the current terminal session:

   ```powershell
   $env:GEMINI_API_KEY = Read-Host 'Gemini API key'
   ```

4. In the same PowerShell window, run:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\anubh\Desktop\billBoy'
   node compare.js 'last-month.pdf' 'this-month.pdf'
   ```

   Replace the filenames with your actual files. Mixed formats work, for example `node compare.js 'last-month.pdf' 'this-month.png'`. Open `report.md` to read the result. `report.json` contains the extracted fields and token counts.

The key is not saved to a project file. It remains in that terminal session's environment. Running the same pair again reuses `report.json` without another Gemini request. A different pair replaces `report.md` and `report.json`; keep a copy of an earlier report in this folder if you want a history.

## How it decides what changed

One Gemini request contains both files with labels identifying the previous and current month. Gemini returns structured fields. BillBoy refuses to compare when either payable total is unreadable, currencies differ, or the provider names clearly differ. It calculates amount and percentage change using JavaScript, compares usage only when both units match, and describes up to three printed charges that changed. If the charge breakdown is cut off or not readable, it says that the specific cause is unclear. It does not infer a missing charge or decide that the provider made a billing error.

No bill is paid, no account is changed, and no message is sent. The original bills remain the source of truth.

## Cost and privacy

BillBoy calls Gemini **only when you run it with a new pair**. `report.json` records the input, output, and thinking token counts returned by the API. Both bills are sent to Google's Gemini API for analysis, even though the source files and report stay local. Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists a free tier, with limits, and says free-tier content may be used to improve its products. Use synthetic, non-confidential bills for a demo and consider those terms before using real bills containing personal information.

## Demo and checks

Two fictional consolidated company-cost invoices are included: `sample-company-july-2026.pdf` and `sample-company-august-2026.pdf`. They cover payroll, rent, utilities, software, marketing, travel, supplies, telecom, professional services, and equipment repairs. To compare them after setting the API key, run `node compare.js 'sample-company-july-2026.pdf' 'sample-company-august-2026.pdf'`. The printed total rises from USD 98,500 to USD 106,700, an increase of USD 8,200. Run the command again to demonstrate that no second model call is made. The earlier telecom-only samples are also available for a narrower example.

Run `node smoke.test.js` for local tests. They mock Gemini and check PDF/image requests, arithmetic, incomplete breakdowns, and mismatch handling. The tool has not been live-tested with your API key or real bill files yet.
# billBoy
