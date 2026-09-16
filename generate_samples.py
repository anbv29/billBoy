"""Create two fictional, internally consistent company invoices for BillBoy."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
NAVY = colors.HexColor("#14263F")
BLUE = colors.HexColor("#2863AD")
PALE = colors.HexColor("#EFF5FC")
GRAY = colors.HexColor("#5A6778")
LINE = colors.HexColor("#DDE5EF")


def money(amount):
    return f"USD {amount:,.2f}"


def draw_bill(filename, period, invoice, issue_date, due_date, charges):
    total = sum(amount for _, amount in charges)
    output = ROOT / filename
    if output.exists():
        raise FileExistsError(f"Will not replace an existing file: {output}")

    page = canvas.Canvas(str(output), pagesize=letter)
    page.setTitle(f"Synthetic consolidated company invoice - {period}")
    page.setAuthor("BillBoy demo")
    width, height = letter
    left, right = 54, width - 54

    page.setFillColor(NAVY)
    page.rect(0, height - 105, width, 105, fill=1, stroke=0)
    page.setFillColor(colors.white)
    page.setFont("Helvetica-Bold", 18)
    page.drawString(left, height - 53, "NORTHSTAR BUSINESS SERVICES")
    page.setFont("Helvetica", 10)
    page.drawString(left, height - 74, "Fictional consolidated operating-cost invoice")
    page.setFont("Helvetica-Bold", 10)
    page.drawRightString(right, height - 74, invoice)

    page.setFillColor(BLUE)
    page.setFont("Helvetica-Bold", 12)
    page.drawString(left, height - 133, "SYNTHETIC SAMPLE - NOT A REAL BILL")
    page.setStrokeColor(LINE)
    page.line(left, height - 144, right, height - 144)

    page.setFillColor(GRAY)
    page.setFont("Helvetica-Bold", 9)
    page.drawString(left, height - 170, "BILLED TO")
    page.drawString(340, height - 170, "BILL DETAILS")
    page.setFillColor(NAVY)
    page.setFont("Helvetica", 10)
    page.drawString(left, height - 189, "Harborfield Services LLC")
    page.drawString(left, height - 204, "Fictional 120-person company")
    page.drawString(340, height - 189, f"Period: {period}")
    page.drawString(340, height - 204, f"Issued: {issue_date}")
    page.drawString(340, height - 219, f"Due: {due_date}")

    page.setFillColor(PALE)
    page.roundRect(left, height - 280, right - left, 43, 8, fill=1, stroke=0)
    page.setFillColor(GRAY)
    page.setFont("Helvetica-Bold", 9)
    page.drawString(left + 16, height - 254, "CONSOLIDATED AMOUNT DUE")
    page.setFillColor(NAVY)
    page.setFont("Helvetica-Bold", 16)
    page.drawRightString(right - 15, height - 265, money(total))

    page.setFillColor(NAVY)
    page.setFont("Helvetica-Bold", 12)
    page.drawString(left, height - 312, "Company cost breakdown")
    page.setFillColor(GRAY)
    page.setFont("Helvetica-Bold", 9)
    page.drawString(left, height - 335, "CATEGORY")
    page.drawRightString(right, height - 335, "AMOUNT")
    page.setStrokeColor(LINE)
    page.line(left, height - 341, right, height - 341)

    y = height - 363
    for label, amount in charges:
        page.setFillColor(NAVY)
        page.setFont("Helvetica", 10)
        page.drawString(left, y, label)
        page.drawRightString(right, y, money(amount))
        y -= 26
        page.setStrokeColor(LINE)
        page.line(left, y + 10, right, y + 10)

    y -= 10
    page.setFont("Helvetica-Bold", 12)
    page.drawString(left, y, "Total payable")
    page.drawRightString(right, y, money(total))

    page.setFillColor(GRAY)
    page.setFont("Helvetica", 8)
    page.drawString(left, 84, "Northstar administers the listed cost categories for this fictional client.")
    page.drawString(left, 70, "This document is entirely fictional; it contains no real account or payment details.")
    page.setStrokeColor(LINE)
    page.line(left, 55, right, 55)
    page.drawString(left, 40, "Northstar Business Services - sample document")
    page.drawRightString(right, 40, "Page 1 of 1")
    page.save()
    return output, total


def main():
    samples = [
        (
            "sample-company-july-2026.pdf", "July 1-31, 2026", "SAMPLE-OPS-2026-07",
            "August 1, 2026", "August 15, 2026",
            [
                ("Payroll and benefits", 58000),
                ("Office rent and facilities", 14500),
                ("Utilities", 2450),
                ("Software subscriptions", 6200),
                ("Marketing campaigns", 8000),
                ("Travel and meals", 2100),
                ("Shipping and office supplies", 1650),
                ("Telecom and internet", 1100),
                ("Professional services", 4500),
            ],
        ),
        (
            "sample-company-august-2026.pdf", "August 1-31, 2026", "SAMPLE-OPS-2026-08",
            "September 1, 2026", "September 15, 2026",
            [
                ("Payroll and benefits", 58000),
                ("Office rent and facilities", 14500),
                ("Utilities", 2700),
                ("Software subscriptions", 6400),
                ("Marketing campaigns", 12600),
                ("Travel and meals", 3100),
                ("Shipping and office supplies", 2000),
                ("Telecom and internet", 1100),
                ("Professional services", 4500),
                ("Equipment repairs", 1800),
            ],
        ),
    ]
    for sample in samples:
        output, total = draw_bill(*sample)
        print(f"Created {output.name}: {money(total)}")


if __name__ == "__main__":
    main()
