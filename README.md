# BillBoy

Compare **two bills**: last month and this month. Each can be a PDF or a screenshot, so PDF + PDF and PDF + image both work. BillBoy uses NVIDIA Nemotron 3 Ultra's free OpenRouter endpoint to extract printed totals, usage, and charges from bill text. OpenRouter's free Cloudflare PDF parser supplies text from PDFs; NVIDIA Nemotron 3 Nano Omni's free vision endpoint transcribes screenshots first. Ordinary JavaScript calculates the difference and writes a readable `report.md` and a structured `report.json` **in this folder**. Your source files stay here. There is no Google Drive, Sheet, database, deployment, or scheduled background process.

## Run it on Windows

1. Install Node.js 18 or newer if `node --version` does not work.
2. Put both bills in `C:\Users\anubh\Desktop\billBoy`. Use PDF, PNG, JPEG, or WebP; each file must be 6 MB or less. Make sure the payable total and charge breakdown are readable. For PDFs, use short bills; more pages use more model tokens.
3. Create an API key in your [OpenRouter account](https://openrouter.ai/settings/keys). In **PowerShell**, run:

   ```powershell
   Set-Location -LiteralPath 'C:\Users\anubh\Desktop\billBoy'
   .\run.ps1 'last-month.pdf' 'this-month.pdf'
   ```

   Replace the filenames with your actual files. On the first run, enter the OpenRouter key when prompted. Later runs reuse a Windows-encrypted copy in `.openrouter-key.dpapi`. Mixed formats work, for example `.\run.ps1 'last-month.pdf' 'this-month.png'`. Open `report.md` to read the result. `report.json` contains the extracted fields and token counts.

The key is not stored in source code or plaintext. The encrypted key file is tied to your Windows account and ignored by Git. To replace a key, delete `.openrouter-key.dpapi` and run the script again. You can also set `OPENROUTER_API_KEY` yourself and run `node compare.js` directly. Running the same pair again reuses `report.json` without another OpenRouter request. A different pair replaces `report.md` and `report.json`; keep a copy of an earlier report in this folder if you want a history.

## How it decides what changed

One OpenRouter request to `nvidia/nemotron-3-ultra-550b-a55b:free` contains both months, with the free PDF parser converting PDF content to text. For each screenshot, one earlier request to `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` transcribes its visible text. Nemotron 3 Ultra is asked for JSON, but its free endpoint does not enforce the format; BillBoy checks the returned fields and fails cleanly if the response is unusable. BillBoy refuses to compare when either payable total is unreadable, currencies differ, or the provider names clearly differ. It calculates amount and percentage change using JavaScript, compares usage only when both units match, and describes up to three printed charges that changed. If the charge breakdown is cut off or not readable, it says that the specific cause is unclear. It does not infer a missing charge or decide that the provider made a billing error.

No bill is paid, no account is changed, and no message is sent. The original bills remain the source of truth.

## Cost and privacy

BillBoy calls OpenRouter **only when you run it with a new pair**. `report.json` records the model and reported token counts across all calls. Both bills or their transcriptions are sent through OpenRouter, even though the source files and report stay local. [Nemotron 3 Ultra free](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free), [Nemotron 3 Nano Omni free](https://openrouter.ai/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free), and OpenRouter's `cloudflare-ai` PDF parser are free at the currently listed rates, with free-tier limits. The code pins both models to their `:free` endpoints; it does not fall back to paid endpoints. Image-only or scanned PDFs may be less reliable with the free parser, so use screenshots for those. NVIDIA's free endpoint asks users not to upload confidential information or personal data. Use synthetic bills for a demo.

For the internship assignment, do not claim Nemotron 3 Ultra was released in the last few weeks: OpenRouter lists its release as June 4, 2026. This model choice alone may not satisfy that assignment check.

## Demo and checks

Two fictional consolidated company-cost invoices are included: `sample-company-july-2026.pdf` and `sample-company-august-2026.pdf`. They cover payroll, rent, utilities, software, marketing, travel, supplies, telecom, professional services, and equipment repairs. To compare them, run `.\run.ps1 'sample-company-july-2026.pdf' 'sample-company-august-2026.pdf'`. The printed total rises from USD 98,500 to USD 106,700, an increase of USD 8,200. Run the command again to demonstrate that no second model call is made.

Run `node smoke.test.js` for local tests. They mock OpenRouter and check PDF/image requests, arithmetic, incomplete breakdowns, and mismatch handling. The tool has not been live-tested with your API key yet.
