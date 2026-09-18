"""Build the Send2U fix-sweep CEO review as a phone-readable PDF."""

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = "/Users/azfardanish/Documents/GitHub/send2u/TEAM/CEO_REVIEW.pdf"

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=19, leading=23, spaceAfter=4)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=13.5, leading=17, spaceBefore=13, spaceAfter=5)
BODY = ParagraphStyle("BODY", parent=ss["BodyText"], fontName="Helvetica", fontSize=10.5, leading=15, alignment=TA_LEFT, spaceAfter=5)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=9.5, leading=13, textColor=colors.HexColor("#555555"))
MONO = ParagraphStyle("MONO", parent=BODY, fontName="Courier", fontSize=9.5, leading=13)
BULLET = ParagraphStyle("BULLET", parent=BODY, spaceAfter=3)


def bullets(items, style=BULLET):
    return ListFlowable(
        [ListItem(Paragraph(t, style), leftIndent=12) for t in items],
        bulletType="bullet", bulletFontSize=7, leftIndent=12, spaceAfter=6,
    )


def kv_table(rows, widths=(52 * mm, 108 * mm)):
    data = [[Paragraph(f"<b>{k}</b>", BODY), Paragraph(v, BODY)] for k, v in rows]
    t = Table(data, colWidths=list(widths))
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#DDDDDD")),
    ]))
    return t


story = []
A = story.append

A(Paragraph("Send2U Fix Sweep: CEO Review", H1))
A(Paragraph(
    "Four-agent run (Architect &rarr; Coder &rarr; Tester &rarr; Manager) against "
    "<b>~/Documents/GitHub/send2u</b>. Branch <b>main</b>, 5 new commits, nothing pushed, "
    "no database changes.", SMALL))
A(Spacer(1, 3))
A(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#DA0A1B")))
A(Spacer(1, 6))

A(Paragraph("What was built", H2))
A(Paragraph(
    "Five commits that fix <b>nine defects</b> in the money and order-state path, plus the "
    "project's <b>first test suite</b> (43 tests, none existed before). The 2026-09-18 "
    "platform-managed Online/COD migration was verified as already correct and was not re-audited.", BODY))
A(kv_table([
    ("282dae3b", "Commits the three pending ratings-gate fixes from your last session, unchanged."),
    ("8cbd3d16", "Fixes 3 money/status defects; adds the 43-test suite."),
    ("135d3aff", "Closes 4 findings from the adversarial QA pass."),
    ("a496ff07", "Closes 2 findings from the manager review."),
    ("79e5d2f5", "Restores one dropped branch; corrects two false changelog claims."),
]))

A(Paragraph("The nine defects", H2))
A(bullets([
    "<b>Customer would be told the wrong thing about money</b>: an online order that was still "
    "unpaid displayed &ldquo;Cash due on delivery&rdquo;, and elsewhere &ldquo;Paid in Send2U&rdquo;. Both now "
    "follow the real payment state and the payment rail.",
    "<b>A vendor could be charged 100x on a price</b>: typing a comma decimal such as "
    "<font face='Courier'>6,50</font> silently created an RM 650.00 menu item instead of RM 6.50. "
    "It now rejects a misplaced comma instead of misreading the amount.",
    "<b>Status labels rendered as broken English</b>: &ldquo;Ready For Pickup&rdquo;, &ldquo;Out For Delivery&rdquo;. "
    "Now sentence case.",
    "<b>A cancelled order was prompted to pay</b>: &ldquo;Not paid yet, pay now&rdquo; next to its own "
    "&ldquo;Cancelled&rdquo; status. Payment prompts are now suppressed for finished orders.",
    "<b>Each sweep changelog entry was recorded twice</b>, and one entry said something "
    "untrue about the test suite. Both corrected.",
]))

A(Paragraph("How it was verified", H2))
A(kv_table([
    ("TypeScript", "npx tsc --noEmit: clean (exit 0)"),
    ("Tests", "npm test: 43 of 43 pass (was 0 tests before)"),
    ("Lint", "npx expo lint: clean (exit 0)"),
    ("Bundle", "npx expo export -p web: passes, all routes build"),
    ("Mutation check", "Breaking the unread store on purpose makes 5 tests fail, so those tests are real."),
    ("QA pass", "An independent adversarial agent reproduced the fixes and then broke its own 13 mutant checks."),
    ("Review passes", "Two independent manager reviews, run on the work and then on the fixes themselves."),
]))

A(Paragraph("What still needs your decision", H2))
A(bullets([
    "<b>One changelog file, two git paths.</b> <font face='Courier'>CHANGELOG.md</font> and "
    "<font face='Courier'>changelog.md</font> are the <i>same file</i> on your machine (macOS is "
    "case-insensitive), but git tracks both. That is what caused the duplicated entries. "
    "Collapsing to one path is a repo-structure call, so I did not make it.",
    "<b>Were old completed orders backfilled?</b> The new ratings gate accepts "
    "<font face='Courier'>paid</font>/<font face='Courier'>collected</font>. If any completed order still carries the "
    "legacy <font face='Courier'>payment_status='verified'</font>, it is now unrateable. I could not check "
    "without database access.",
]))

A(Paragraph("Known limits, stated plainly", H2))
A(bullets([
    "Nothing was tapped through on a real device. The fixes are proven by tests and by the type, "
    "lint and bundle checks, not by using the app.",
    "No database or RPC change was made, by design.",
    "Disk is at 99% (2.2 GB free). The next heavy native build may run out of space.",
    "The last commit (one restored line plus documentation) did not get a fourth adversarial pass. "
    "It is verified by inspection and all gates pass.",
]))

A(Paragraph("What you should check by hand", H2))
A(bullets([
    "Open a vendor menu item and type <font face='Courier'>6,50</font> into the price field. It must "
    "refuse, not become RM 650.00.",
    "As a requester with an unpaid online order, open the order detail. It must not say paid or "
    "cash due: it should read &ldquo;Not paid yet&rdquo;.",
    "Cancel an unpaid order and re-open it. The order summary must not prompt you to pay.",
    "Check a helper's Deliveries list reads &ldquo;Ready for pickup&rdquo;, not &ldquo;Ready For Pickup&rdquo;.",
]))

A(Spacer(1, 8))
A(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CCCCCC")))
A(Spacer(1, 4))
A(Paragraph(
    "Full detail: TEAM/report.md (what changed), TEAM/test-report.md (adversarial QA), "
    "TEAM/review.md (two manager reviews), TEAM/history.md (iteration log).", SMALL))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
    title="Send2U Fix Sweep - CEO Review", author="Maple",
)
doc.build(story)
print("wrote", OUT)
