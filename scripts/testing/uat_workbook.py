"""Build the Phase 1 UAT spreadsheet testers fill in, from docs/testing/phase1-uat-checklist.md.

    py -3.12 scripts/testing/uat_workbook.py --out My-People-Phase1-UAT.xlsx

The checklist file is the source: change cases there, then build a new spreadsheet. One sheet per
app with a Result dropdown, a defects log, and a summary whose formulas count the results per app
for the Gate G1 record (uat.apps.<app>.total and .passed).
"""

import argparse
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.properties import CalcProperties
from openpyxl.worksheet.datavalidation import DataValidation

CHECKLIST = Path(__file__).resolve().parents[2] / "docs" / "testing" / "phase1-uat-checklist.md"
# Checklist section heading -> sheet name and the Gate G1 evidence key it feeds.
SECTIONS = {
    "Member app": ("Member app", "memberMobile"),
    "Staff app": ("Staff app", "staffMobile"),
    "Dashboard": ("Dashboard", "adminWeb"),
    "Rules that cut across the apps": ("Rules", None),
}
RESULTS = ["Pass", "Fail", "Blocked", "Not tested"]
LAST_ROW = 300  # formulas and dropdowns cover new rows added by testers up to here

FONT = "Arial"
HEADER_FILL = PatternFill("solid", fgColor="1F3A5F")
INPUT_FILL = PatternFill("solid", fgColor="FFF6CC")  # cells testers fill in
THIN = Side(style="thin", color="C9CED6")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")


def read_checklist(path: Path) -> tuple[list[str], dict[str, list[list[str]]]]:
    """The "Before testing" bullets and the case rows of each section."""
    before: list[str] = []
    cases: dict[str, list[list[str]]] = {}
    section = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        if section == "Before testing" and line.startswith("- "):
            before.append(re.sub(r"\*\*(.+?)\*\*", r"\1", line[2:]).replace("`", ""))
        elif section in SECTIONS and line.startswith("| ") and not line.startswith("| ID ") and not line.startswith("|---"):
            cells = [cell.strip().replace("**", "") for cell in line.strip().strip("|").split(" | ")]
            if len(cells) != 5:
                raise SystemExit(f"{section}: expected 5 columns, got {len(cells)}: {line[:80]}")
            cases.setdefault(section, []).append(cells)
    missing = [name for name in SECTIONS if name not in cases]
    if missing:
        raise SystemExit(f"no cases found for: {', '.join(missing)}")
    return before, cases


def style_header(sheet, row: int, columns: int) -> None:
    for column in range(1, columns + 1):
        cell = sheet.cell(row=row, column=column)
        cell.font = Font(name=FONT, bold=True, color="FFFFFF")
        cell.fill = HEADER_FILL
        cell.alignment = WRAP
        cell.border = BORDER


def add_cases_sheet(book: Workbook, title: str, rows: list[list[str]]) -> None:
    sheet = book.create_sheet(title)
    headers = ["ID", "Screen", "Account", "Steps", "Expected result", "Result", "Tester", "Date", "Defect ID", "Notes"]
    widths = [10, 26, 22, 60, 60, 13, 16, 12, 11, 30]
    sheet.append(headers)
    style_header(sheet, 1, len(headers))
    for case in rows:
        sheet.append([*case, None, None, None, None, None])
    for row in sheet.iter_rows(min_row=2, max_row=sheet.max_row):
        for cell in row:
            cell.font = Font(name=FONT, size=10)
            cell.alignment = WRAP
            cell.border = BORDER
            if cell.column >= 6:
                cell.fill = INPUT_FILL
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    results = DataValidation(type="list", formula1='"' + ",".join(RESULTS) + '"', allow_blank=True)
    results.error, results.errorTitle = "Choose Pass, Fail, Blocked or Not tested.", "Result"
    sheet.add_data_validation(results)
    results.add(f"F2:F{LAST_ROW}")
    sheet.freeze_panes = "B2"
    sheet.auto_filter.ref = f"A1:J{sheet.max_row}"


def add_read_me(book: Workbook, before: list[str]) -> None:
    sheet = book.active
    sheet.title = "Read me"
    sheet.column_dimensions["A"].width = 120
    lines = [
        ("My People, Phase 1 user acceptance test (Gate G1)", Font(name=FONT, bold=True, size=14)),
        ("Built from docs/testing/phase1-uat-checklist.md. Test on staging only, never on production.", None),
        ("", None),
        ("Before testing", Font(name=FONT, bold=True, size=11)),
        *[(f"• {item}", None) for item in before],
        ("", None),
        ("How to fill it in", Font(name=FONT, bold=True, size=11)),
        ("• Fill only the shaded columns on each app sheet: Result, Tester, Date, Defect ID and Notes.", None),
        ("• Result is Pass, Fail, Blocked or Not tested. Every Fail needs a row on the Defects sheet and its ID here.", None),
        ("• Blocked means it cannot be tested yet for a reason outside the app (named in the case), not that it failed.", None),
        ("• The Summary sheet counts the results itself; the sign-off block is at its foot.", None),
        ("", None),
        ("Example of a filled-in row (Member app sheet)", Font(name=FONT, bold=True, size=11)),
        ("MEM-18 · H01 Home, active member · member-active · … · Result: Pass · Tester: A. Kumar · Date: 2026-11-12 · Defect ID: (empty) · Notes: Next event shown", None),
        ("MEM-22 · E01 Events list · member-active · … · Result: Fail · Tester: A. Kumar · Date: 2026-11-12 · Defect ID: DEF-001 · Notes: Cancelled event not marked", None),
    ]
    for row, (text, font) in enumerate(lines, start=1):
        cell = sheet.cell(row=row, column=1, value=text)
        cell.font = font or Font(name=FONT, size=10)
        cell.alignment = Alignment(wrap_text=True, vertical="top")


def add_defects(book: Workbook) -> None:
    sheet = book.create_sheet("Defects")
    headers = ["Defect ID", "Case ID", "Found on (date)", "What happened", "Severity", "Status", "Fixed in (PR or commit)", "Retested by", "Retest date"]
    widths = [11, 10, 14, 60, 11, 13, 22, 16, 12]
    sheet.append(headers)
    style_header(sheet, 1, len(headers))
    for row in range(2, 102):
        for column in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=column)
            cell.font = Font(name=FONT, size=10)
            cell.fill = INPUT_FILL
            cell.alignment = WRAP
            cell.border = BORDER
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    severity = DataValidation(type="list", formula1='"Critical,High,Medium,Low"', allow_blank=True)
    status = DataValidation(type="list", formula1='"Open,Fixed,Retested: pass,Retested: fail,Will not fix"', allow_blank=True)
    for validation, column in ((severity, "E"), (status, "F")):
        sheet.add_data_validation(validation)
        validation.add(f"{column}2:{column}{LAST_ROW}")
    sheet.freeze_panes = "A2"


def add_summary(book: Workbook) -> None:
    sheet = book.create_sheet("Summary")
    headers = ["Area", "Gate G1 evidence key", "Cases", "Pass", "Fail", "Blocked", "Not tested yet", "Share passed"]
    sheet.append(headers)
    style_header(sheet, 1, len(headers))
    for row, (sheet_name, key) in enumerate(SECTIONS.values(), start=2):
        ref = f"'{sheet_name}'!"
        values = [
            sheet_name,
            f"uat.apps.{key}" if key else "(rules: count towards every app)",
            f"=COUNTA({ref}A2:A{LAST_ROW})",
            f'=COUNTIF({ref}F2:F{LAST_ROW},"Pass")',
            f'=COUNTIF({ref}F2:F{LAST_ROW},"Fail")',
            f'=COUNTIF({ref}F2:F{LAST_ROW},"Blocked")',
            f"=C{row}-D{row}-E{row}-F{row}",
            f"=IF(C{row}=0,0,D{row}/C{row})",
        ]
        for column, value in enumerate(values, start=1):
            cell = sheet.cell(row=row, column=column, value=value)
            cell.font = Font(name=FONT, size=10)
            cell.border = BORDER
        sheet.cell(row=row, column=8).number_format = "0.0%"
    total = len(SECTIONS) + 2
    sheet.cell(row=total, column=1, value="All").font = Font(name=FONT, bold=True)
    for column in range(3, 8):
        letter = get_column_letter(column)
        cell = sheet.cell(row=total, column=column, value=f"=SUM({letter}2:{letter}{total - 1})")
        cell.font = Font(name=FONT, bold=True)
    share = sheet.cell(row=total, column=8, value=f"=IF(C{total}=0,0,D{total}/C{total})")
    share.font, share.number_format = Font(name=FONT, bold=True), "0.0%"
    note = sheet.cell(row=total + 1, column=1, value="Gate G1 needs every case passed, apart from Blocked cases the product owner accepts in writing.")
    note.font = Font(name=FONT, italic=True, size=9)

    start = total + 3
    sheet.cell(row=start, column=1, value="Sign-off").font = Font(name=FONT, bold=True, size=11)
    sign_headers = ["Role", "Name", "Signature", "Date"]
    for column, text in enumerate(sign_headers, start=1):
        sheet.cell(row=start + 1, column=column, value=text)
    style_header(sheet, start + 1, len(sign_headers))
    for offset, role in enumerate(["UAT lead (tester)", "Product owner", "Sponsor"], start=2):
        sheet.cell(row=start + offset, column=1, value=role).font = Font(name=FONT, size=10)
        for column in range(1, 5):
            cell = sheet.cell(row=start + offset, column=column)
            cell.border = BORDER
            if column > 1:
                cell.fill = INPUT_FILL
    for index, width in enumerate([28, 34, 10, 10, 10, 10, 15, 13], start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    before, cases = read_checklist(CHECKLIST)
    book = Workbook()
    add_read_me(book, before)
    for section, (sheet_name, _) in SECTIONS.items():
        add_cases_sheet(book, sheet_name, cases[section])
    add_defects(book)
    add_summary(book)
    # openpyxl stores no computed values, so the counts are worked out when the file is opened.
    book.calculation = CalcProperties(fullCalcOnLoad=True)
    book.save(args.out)
    counts = ", ".join(f"{name}: {len(cases[section])}" for section, (name, _) in SECTIONS.items())
    print(f"wrote {args.out} ({counts})")


if __name__ == "__main__":
    main()
