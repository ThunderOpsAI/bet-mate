import os
from xml.sax.saxutils import escape
import pymupdf
from PIL import Image as PILImage

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, KeepTogether, ListFlowable, ListItem,
    NextPageTemplate, PageBreak, PageTemplate, Paragraph, Spacer, Table,
    TableStyle
)

OUTPUT_PDF = "/Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/outputs/Sha_Tin_Races_6-11_Betting_Strategy.pdf"

CONFIG = dict(
    title="Sha Tin Race Day Strategy: Races 6 to 11",
    subtitle="Sa Sa Ladies' Purse Day - Full Form, $100 Staking, Multis & Quaddie",
    author="Bet-Mate Quantitative Racing Strategy",
    date="8 November 2026",
    footer_left="Bet-Mate Racing Intelligence | Sha Tin",
    pagesize=A4,
    margin=14 * mm,
    accent="#0F4C81",
    output=OUTPUT_PDF,
)

ACCENT = colors.HexColor(CONFIG["accent"])
ACCENT_LIGHT = colors.HexColor("#2C6CB0")
INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#555E6D")
RULE = colors.HexColor("#CBD5E1")
ZEBRA = colors.HexColor("#F8FAFC")
TINT = colors.HexColor("#EFF6FC")
GREEN_TINT = colors.HexColor("#ECFDF5")
GREEN_BORDER = colors.HexColor("#10B981")

base = "/System/Library/Fonts/Supplemental/"
pdfmetrics.registerFont(TTFont("Body", base + "Arial.ttf"))
pdfmetrics.registerFont(TTFont("Body-Bold", base + "Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("Body-Italic", base + "Arial Italic.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold", italic="Body-Italic")
F, FB, FI = "Body", "Body-Bold", "Body-Italic"

def S(name, **kw):
    base_s = dict(fontName=F, fontSize=8.2, leading=11.2, textColor=INK, spaceAfter=1, alignment=TA_LEFT)
    base_s.update(kw)
    return ParagraphStyle(name, **base_s)

ST = dict(
    body=S("body"),
    doc_title=S("doc_title", fontName=FB, fontSize=16, leading=19, textColor=ACCENT, spaceAfter=2),
    doc_subtitle=S("doc_subtitle", fontName=F, fontSize=9, leading=12, textColor=MUTED, spaceAfter=4),
    h1=S("H1", fontName=FB, fontSize=11, leading=14, textColor=ACCENT, spaceBefore=4, spaceAfter=2, keepWithNext=1),
    race_title=S("race_title", fontName=FB, fontSize=10, leading=12.5, textColor=colors.white, spaceAfter=0),
    race_meta=S("race_meta", fontName=F, fontSize=7.5, leading=9.5, textColor=colors.HexColor("#E2E8F0"), spaceAfter=0),
    th=S("th", fontName=FB, fontSize=7.8, leading=9.8, textColor=colors.white, spaceAfter=0),
    td=S("td", fontSize=7.8, leading=10.2, spaceAfter=0),
    td_bold=S("td_bold", fontName=FB, fontSize=7.8, leading=10.2, spaceAfter=0),
    td_r=S("td_r", fontSize=7.8, leading=10.2, spaceAfter=0, alignment=TA_RIGHT),
    td_r_bold=S("td_r_bold", fontName=FB, fontSize=7.8, leading=10.2, spaceAfter=0, alignment=TA_RIGHT),
    th_r=S("th_r", fontName=FB, fontSize=7.8, leading=9.8, textColor=colors.white, spaceAfter=0, alignment=TA_RIGHT),
    callout=S("callout", fontSize=7.8, leading=10.8, spaceAfter=0),
    card_text=S("card_text", fontSize=7.8, leading=10.5, spaceAfter=0),
    caption=S("caption", fontName=FI, fontSize=7.2, leading=9.2, textColor=MUTED, alignment=TA_CENTER, spaceBefore=1, spaceAfter=2),
)

def usable_width():
    return CONFIG["pagesize"][0] - 2 * CONFIG["margin"]

def callout(text, label=None, tint_color=TINT, bar_color=ACCENT):
    inner = (f"<b>{escape(label)}: </b>" if label else "") + text
    t = Table([[Paragraph(inner, ST["callout"])]], colWidths=[usable_width()])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint_color),
        ("LINEBEFORE", (0, 0), (0, -1), 3, bar_color),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]))
    return [t, Spacer(1, 2.5)]

def data_table(header, rows, col_widths=None, numeric_cols=(), total_row=False, caption=None):
    n = len(header)
    fr = col_widths or [1 / n] * n
    widths = [f * usable_width() for f in fr]
    num = set(numeric_cols)

    data = [[Paragraph(escape(str(h)), ST["th_r" if i in num else "th"]) for i, h in enumerate(header)]]
    for ri, r in enumerate(rows):
        bold = total_row and ri == len(rows) - 1
        row_cells = []
        for i, v in enumerate(r):
            st = ("td_r_bold" if i in num else "td_bold") if bold else ("td_r" if i in num else "td")
            row_cells.append(Paragraph(str(v), ST[st]))
        data.append(row_cells)

    t = Table(data, colWidths=widths, repeatRows=1)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5), ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ZEBRA]),
    ]
    if total_row:
        cmds += [
            ("LINEABOVE", (0, -1), (-1, -1), 0.8, INK),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F1F5F9")),
        ]
    t.setStyle(TableStyle(cmds))
    out = [t]
    if caption:
        out.append(Paragraph(escape(caption), ST["caption"]))
    else:
        out.append(Spacer(1, 2))
    return out

def race_banner(race_no, title, meta):
    t = Table([
        [Paragraph(f"<b>RACE {race_no}: {escape(title).upper()}</b>", ST["race_title"])],
        [Paragraph(escape(meta), ST["race_meta"])]
    ], colWidths=[usable_width()])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0.5),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 2.5),
    ]))
    return t

def race_intel_block(short_winner, long_ew, trifecta, srm):
    col_w = usable_width() * 0.5 - 1.5 * mm
    left_content = (
        f"<b>Short-Odds Winner:</b> {short_winner['horse']} (<b>${short_winner['odds']:.2f}</b>)<br/>"
        f"<i>Jockey/Trainer:</i> {short_winner['jockey']} / {short_winner['trainer']}<br/>"
        f"<i>Form & Edge:</i> {short_winner['note']}<br/><br/>"
        f"<b>Long-Odds Each-Way:</b> {long_ew['horse']} (<b>${long_ew['odds']:.2f}</b> / <b>${long_ew['place']:.2f}</b>)<br/>"
        f"<i>Jockey/Trainer:</i> {long_ew['jockey']} / {long_ew['trainer']}<br/>"
        f"<i>Form & Edge:</i> {long_ew['note']}"
    )
    right_content = (
        f"<b>Boxed Trifecta (4 Runners / 24 Combos):</b><br/>"
        f"{trifecta['runners']}<br/>"
        f"<i>Structure:</i> {trifecta['note']}<br/><br/>"
        f"<b>Same Race Multi ({srm['legs_count']} Legs | Est. ${srm['odds']:.2f}):</b><br/>"
        f"{srm['legs_desc']}"
    )
    t = Table([
        [Paragraph(left_content, ST["card_text"]), Paragraph(right_content, ST["card_text"])]
    ], colWidths=[col_w, col_w])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.35, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t

def make_race_section(race_no, title, meta, short_w, long_ew, trifecta, srm, staking_rows):
    flow = []
    flow.append(race_banner(race_no, title, meta))
    flow.append(Spacer(1, 2))
    flow.append(race_intel_block(short_w, long_ew, trifecta, srm))
    flow.append(Spacer(1, 2))
    flow += data_table(
        ["Bet Type", "Selection Details", "Strategy / Tactical Role", "Stake ($)"],
        staking_rows,
        col_widths=[0.24, 0.36, 0.26, 0.14],
        numeric_cols=(3,),
        total_row=True,
    )
    flow.append(Spacer(1, 3))
    return flow

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for state in self._pages:
            self.__dict__.update(state)
            self._chrome(total)
            super().showPage()
        super().save()

    def _chrome(self, total):
        w, h = CONFIG["pagesize"]
        m = CONFIG["margin"]
        self.setStrokeColor(RULE)
        self.setLineWidth(0.4)
        # Header line
        self.line(m, h - m + 3 * mm, w - m, h - m + 3 * mm)
        self.setFont(F, 7.5)
        self.setFillColor(MUTED)
        self.drawString(m, h - m + 4.5 * mm, CONFIG["title"])
        # Footer line
        self.line(m, m - 4 * mm, w - m, m - 4 * mm)
        self.drawString(m, m - 7.5 * mm, CONFIG["footer_left"])
        self.drawRightString(w - m, m - 7.5 * mm, f"Page {self._pageNumber} of {total}")

def build_story():
    s = []

    # ================= PAGE 1 =================
    s.append(Paragraph(escape(CONFIG["title"]), ST["doc_title"]))
    s.append(Paragraph(
        "Sa Sa Ladies' Purse Day | Sha Tin Turf (C+3 Course) | Australian Wagering Strategy Dossier",
        ST["doc_subtitle"]
    ))
    
    exec_summary = (
        "Comprehensive race-by-race strategy for Sha Tin Races 6 through 11. "
        "Each race allocates an exact <b>$100.00 capital outlay</b> balancing high-probability straight anchors "
        "with disciplined exotic leverage (Trifecta & SRM). Features <b>5 cross-card Multis</b> "
        "and a strict <b>16-combination Quaddie</b> (Races 8-11)."
    )
    s += callout(exec_summary, label="EXECUTIVE BETTING BRIEF", tint_color=TINT, bar_color=ACCENT)
    s.append(Spacer(1, 2))

    # RACE 6
    s += make_race_section(
        race_no=6,
        title="Elizabeth Arden Handicap",
        meta="Class 4 | 1400m | Turf (C+3) | HK$1,170,000",
        short_w={
            "horse": "#4 Beauty Award", "odds": 4.20,
            "jockey": "Andrea Atzeni", "trainer": "John Size",
            "note": "Proven C&D credentials; drops into ideal Class 4 company with explosive late sectionals."
        },
        long_ew={
            "horse": "#2 Call Me Sparkle", "odds": 14.00, "place": 3.80,
            "jockey": "James Orman", "trainer": "K.W. Lui",
            "note": "Sharp trials; Orman will punch forward early to secure an economical on-speed rail trail."
        },
        trifecta={
            "runners": "<b>#1 Lady's Love, #2 Call Me Sparkle, #4 Beauty Award, #5 California Waves</b>",
            "note": "Combines Purton's fancied mount (#1) & Atzeni's standout (#4) with two strong place value runners."
        },
        srm={
            "legs_count": 2, "odds": 2.60,
            "legs_desc": "• Leg 1: #4 Beauty Award – <i>Top 2 Finish</i><br/>• Leg 2: #1 Lady's Love – <i>Top 4 Finish</i>"
        },
        staking_rows=[
            ["Win", "#4 Beauty Award", "High win equity; primary anchor", "$35.00"],
            ["Each-Way ($10W / $15P)", "#2 Call Me Sparkle", "High-upside value hedge", "$25.00"],
            ["Boxed Trifecta", "1, 2, 4, 5 (24 combos)", "104.1% Flexi dividend", "$25.00"],
            ["Same Race Multi", "Beauty Award (Top 2) / Lady's Love (Top 4)", "2-Leg multiplier", "$15.00"],
            ["Total Race 6 Spend", "4 Structured Wagers", "Exact Allocation", "$100.00"]
        ]
    )

    # RACE 7
    s += make_race_section(
        race_no=7,
        title="La Estephe Handicap",
        meta="Class 3 | 1400m | Turf (C+3) | HK$1,860,000",
        short_w={
            "horse": "#13 Zhuang Yuan Glory", "odds": 4.45,
            "jockey": "Matthew Poon", "trainer": "James Cummings",
            "note": "Featherweight in Barrier 2. Sustained speed profile over 1400m ideal for C+3 rail configuration."
        },
        long_ew={
            "horse": "#6 Precision Time", "odds": 15.70, "place": 4.25,
            "jockey": "Matthew Chadwick", "trainer": "Y.S. Tsui",
            "note": "Overlooked in market; ran top 3 closing splits over 1400m last prep and draws well in barrier 8."
        },
        trifecta={
            "runners": "<b>#3 Titan Pegasus, #5 Chiu Chow Spirit, #6 Precision Time, #13 Zhuang Yuan Glory</b>",
            "note": "Takes in Eustace's progressive Titan Pegasus (#3) & Badel's Chiu Chow Spirit (#5) with top picks."
        },
        srm={
            "legs_count": 2, "odds": 2.50,
            "legs_desc": "• Leg 1: #13 Zhuang Yuan Glory – <i>Top 3 Finish</i><br/>• Leg 2: #5 Chiu Chow Spirit – <i>Top 4 Finish</i>"
        },
        staking_rows=[
            ["Win", "#13 Zhuang Yuan Glory", "Primary stake on light weight advantage", "$40.00"],
            ["Each-Way ($5W / $15P)", "#6 Precision Time", "Robust place protection buffer", "$20.00"],
            ["Boxed Trifecta", "3, 5, 6, 13 (24 combos)", "104.1% Flexi dividend", "$25.00"],
            ["Same Race Multi", "Zhuang Yuan Glory (Top 3) / Chiu Chow Spirit (Top 4)", "2-Leg podium banker", "$15.00"],
            ["Total Race 7 Spend", "4 Structured Wagers", "Exact Allocation", "$100.00"]
        ]
    )

    s.append(PageBreak())

    # ================= PAGE 2 =================
    # RACE 8 (FEATURE)
    s += make_race_section(
        race_no=8,
        title="G3 Sa Sa Ladies' Purse Handicap (Feature)",
        meta="Group 3 Handicap | 1800m | Turf (C+3) | HK$4,200,000",
        short_w={
            "horse": "#4 Massive Sovereign", "odds": 3.60,
            "jockey": "Zac Purton", "trainer": "F.C. Lor",
            "note": "HK Derby champion carrying just 123 lb. Primed for 1800m showcase; Purton is 28% strike rate here."
        },
        long_ew={
            "horse": "#1 Beauty Joy", "odds": 9.50, "place": 2.90,
            "jockey": "Brenton Avdulla", "trainer": "Tony Cruz",
            "note": "Top class G1 performer; possesses the most lethal finishing burst in HK if tempo is hot early."
        },
        trifecta={
            "runners": "<b>#1 Beauty Joy, #3 Sky Jewellery, #4 Massive Sovereign, #12 Stunning Peach</b>",
            "note": "Feature quartet covering premier class (#1, #4) and progressive Group-targeted lightweight (#12)."
        },
        srm={
            "legs_count": 3, "odds": 3.80,
            "legs_desc": "• Leg 1: #4 Massive Sovereign – <i>Top 2 Finish</i><br/>• Leg 2: #1 Beauty Joy – <i>Top 4 Finish</i><br/>• Leg 3: #3 Sky Jewellery – <i>Top 4 Finish</i>"
        },
        staking_rows=[
            ["Win", "#4 Massive Sovereign", "Key meeting anchor; maximum conviction", "$45.00"],
            ["Each-Way ($10W / $15P)", "#1 Beauty Joy", "Class runner each-way insurance", "$25.00"],
            ["Boxed Trifecta", "1, 3, 4, 12 (24 combos)", "83.3% Flexi dividend", "$20.00"],
            ["Same Race Multi", "Massive Sovereign (Top 2) / Beauty Joy & Sky Jewellery (Top 4)", "3-Leg feature special", "$10.00"],
            ["Total Race 8 Spend", "4 Structured Wagers", "Exact Allocation", "$100.00"]
        ]
    )

    # RACE 9
    s += make_race_section(
        race_no=9,
        title="Neue Handicap",
        meta="Class 3 | 1400m | Turf (C+3) | HK$1,860,000",
        short_w={
            "horse": "#6 Superb Spirit", "odds": 2.50,
            "jockey": "Vincent Ho", "trainer": "K.W. Lui",
            "note": "Clear benchmark runner; unlucky first-up after severe traffic. Smooth gate 6 and lethal closing split."
        },
        long_ew={
            "horse": "#3 Akashvani", "odds": 9.00, "place": 2.80,
            "jockey": "Brenton Avdulla", "trainer": "David Hayes",
            "note": "Fitted with blinkers; Conghua trials show significant improvement second-up over 1400m."
        },
        trifecta={
            "runners": "<b>#2 Celestial Hero, #3 Akashvani, #5 Fit For Beauty, #6 Superb Spirit</b>",
            "note": "Locks in Purton's mount (#2), Ho's favourite (#6), Size's runner (#5), and value pick (#3)."
        },
        srm={
            "legs_count": 2, "odds": 3.20,
            "legs_desc": "• Leg 1: #6 Superb Spirit – <i>To Win</i><br/>• Leg 2: #2 Celestial Hero – <i>Top 3 Finish</i>"
        },
        staking_rows=[
            ["Win", "#6 Superb Spirit", "Highest-probability winner of the card", "$50.00"],
            ["Each-Way ($5W / $15P)", "#3 Akashvani", "Targeted value play with place cushion", "$20.00"],
            ["Boxed Trifecta", "2, 3, 5, 6 (24 combos)", "83.3% Flexi dividend", "$20.00"],
            ["Same Race Multi", "Superb Spirit (Win) / Celestial Hero (Top 3)", "Direct 1-2 correlation punch", "$10.00"],
            ["Total Race 9 Spend", "4 Structured Wagers", "Exact Allocation", "$100.00"]
        ]
    )

    s.append(PageBreak())

    # ================= PAGE 3 =================
    # RACE 10
    s += make_race_section(
        race_no=10,
        title="Suisse Programme Handicap",
        meta="Class 3 | 1200m | Turf (C+3) | HK$1,860,000",
        short_w={
            "horse": "#4 Majestic Valour", "odds": 3.10,
            "jockey": "Zac Purton", "trainer": "Danny Shum",
            "note": "Draws inside (Barrier 2) with Zac Purton. High cruising speed and proven 1200m winning record."
        },
        long_ew={
            "horse": "#11 Lifeline Express", "odds": 12.00, "place": 3.40,
            "jockey": "Andrea Atzeni", "trainer": "John Size",
            "note": "Lightly weighted from Barrier 3; consistently peaks second-up and maps for an untroubled rail run."
        },
        trifecta={
            "runners": "<b>#1 Grand Eagle, #2 Absolute Heart, #4 Majestic Valour, #11 Lifeline Express</b>",
            "note": "Balances the hat-trick seeker (#2), class top-weight (#1), favourite (#4), and lightweight closer (#11)."
        },
        srm={
            "legs_count": 2, "odds": 2.40,
            "legs_desc": "• Leg 1: #4 Majestic Valour – <i>Top 2 Finish</i><br/>• Leg 2: #2 Absolute Heart – <i>Top 4 Finish</i>"
        },
        staking_rows=[
            ["Win", "#4 Majestic Valour", "Pure sprint anchor from gate 2", "$45.00"],
            ["Each-Way ($5W / $15P)", "#11 Lifeline Express", "High value lightweight place hedge", "$20.00"],
            ["Boxed Trifecta", "1, 2, 4, 11 (24 combos)", "83.3% Flexi dividend", "$20.00"],
            ["Same Race Multi", "Majestic Valour (Top 2) / Absolute Heart (Top 4)", "Conservative 2-leg play", "$15.00"],
            ["Total Race 10 Spend", "4 Structured Wagers", "Exact Allocation", "$100.00"]
        ]
    )

    # RACE 11
    s += make_race_section(
        race_no=11,
        title="Santa Monica Handicap",
        meta="Class 2 | 1400m | Turf (C+3) | HK$2,840,000",
        short_w={
            "horse": "#4 Hot Delight", "odds": 3.50,
            "jockey": "Vincent Ho", "trainer": "K.W. Lui",
            "note": "Elite 4YO Classic Series prospect; boasts unmatched cruising acceleration over Sha Tin 1400m."
        },
        long_ew={
            "horse": "#14 Mr Incredible", "odds": 10.00, "place": 3.10,
            "jockey": "Karis Teetan", "trainer": "Bruce Crawford",
            "note": "Sneaks in on 118 lb minimum weight; lethal turn of foot when saved for one final sprint."
        },
        trifecta={
            "runners": "<b>#2 Storm Rider, #4 Hot Delight, #5 Mugen, #14 Mr Incredible</b>",
            "note": "Combines prominent speed (#2), Group performer (#5), benchmark favourite (#4), and lightweight fly (#14)."
        },
        srm={
            "legs_count": 2, "odds": 2.90,
            "legs_desc": "• Leg 1: #4 Hot Delight – <i>Top 2 Finish</i><br/>• Leg 2: #14 Mr Incredible – <i>Top 4 Finish</i>"
        },
        staking_rows=[
            ["Win", "#4 Hot Delight", "Grand finale meeting anchor", "$40.00"],
            ["Each-Way ($10W / $15P)", "#14 Mr Incredible", "Featherweight place & upset potential", "$25.00"],
            ["Boxed Trifecta", "2, 4, 5, 14 (24 combos)", "83.3% Flexi dividend", "$20.00"],
            ["Same Race Multi", "Hot Delight (Top 2) / Mr Incredible (Top 4)", "2-Leg closing accumulator", "$15.00"],
            ["Total Race 11 Spend", "4 Structured Wagers", "Exact Allocation", "$100.00"]
        ]
    )

    s.append(PageBreak())

    # ================= PAGE 4 =================
    s.append(Paragraph("Cross-Card Multi Portfolio (5 Distinct Strategies)", ST["h1"]))
    s.append(Paragraph(
        "Carefully constructed accumulators spanning conservative yield compounding to aggressive upside returns.",
        ST["caption"]
    ))
    s.append(Spacer(1, 1))

    multi_table_rows = [
        [
            "Multi 1: Bankers Win",
            "3 Legs",
            "R8: Massive Sovereign ($3.60) × R9: Superb Spirit ($2.50) × R10: Majestic Valour ($3.10)",
            "$27.90",
            "$20.00",
            "$558.00"
        ],
        [
            "Multi 2: Safety Place",
            "4 Legs",
            "R6: Beauty Award ($1.65) × R7: Zhuang Yuan ($1.70) × R8: Massive Sov ($1.55) × R9: Superb Spirit ($1.40)",
            "$6.08",
            "$35.00",
            "$212.80"
        ],
        [
            "Multi 3: Roughie Place",
            "3 Legs",
            "R6: Call Me Sparkle ($3.80) × R7: Precision Time ($4.25) × R11: Mr Incredible ($3.10)",
            "$50.06",
            "$10.00",
            "$500.60"
        ],
        [
            "Multi 4: Top-2 Ladder",
            "4 Legs",
            "R7: Zhuang Yuan ($2.30) × R8: Massive Sov ($2.10) × R9: Superb Spirit ($1.65) × R10: Majestic ($1.85)",
            "$14.75",
            "$20.00",
            "$295.00"
        ],
        [
            "Multi 5: Mega Feature",
            "5 Legs",
            "R7: Zhuang Yuan (W) × R8: Massive Sov (T2) × R9: Superb Spirit (W) × R10: Majestic (T2) × R11: Hot Delight (W)",
            "$151.20",
            "$15.00",
            "$2,268.00"
        ],
        [
            "Total Multi Portfolio",
            "5 Multis",
            "Blended risk-adjusted cross-card accumulator portfolio",
            "-",
            "$100.00",
            "Max $3,834"
        ]
    ]
    s += data_table(
        ["Multi Strategy", "Structure", "Leg Breakdown & Conditions", "Est. Odds", "Stake ($)", "Est. Return"],
        multi_table_rows,
        col_widths=[0.21, 0.09, 0.42, 0.09, 0.08, 0.11],
        numeric_cols=(3, 4, 5),
        total_row=True,
        caption="Table 1. Curated Cross-Card Multi-Leg Accumulators"
    )

    s.append(Spacer(1, 3))
    s.append(Paragraph("Sha Tin Quaddie: 16-Combination Blueprint", ST["h1"]))
    s.append(Paragraph(
        "Strictly constrained to <b>16 combinations</b> via <b>2 runners per leg (2 × 2 × 2 × 2 = 16 combinations)</b> across Races 8 to 11.",
        ST["caption"]
    ))
    s.append(Spacer(1, 1))

    quaddie_rows = [
        ["Leg 1 (Race 8)", "G3 Sa Sa Ladies' Purse (1800m)", "#3 Sky Jewellery, #4 Massive Sovereign", "2", "Feature anchor & form runner"],
        ["Leg 2 (Race 9)", "Neue Handicap (1400m)", "#2 Celestial Hero, #6 Superb Spirit", "2", "Class dropper & race favourite"],
        ["Leg 3 (Race 10)", "Suisse Programme Hcp (1200m)", "#2 Absolute Heart, #4 Majestic Valour", "2", "Hat-trick seeker & Purton mount"],
        ["Leg 4 (Race 11)", "Santa Monica Handicap (1400m)", "#4 Hot Delight, #14 Mr Incredible", "2", "Progressive 4YO & lightweight burst"],
        ["Quaddie Total", "Races 8, 9, 10 & 11", "2 × 2 × 2 × 2 = Exactly 16 Combinations", "16 Combos", "$16 Outlay = 100% Flexi"]
    ]
    s += data_table(
        ["Quaddie Leg", "Race Details", "Selected Runners", "Count", "Tactical Role"],
        quaddie_rows,
        col_widths=[0.18, 0.26, 0.28, 0.10, 0.18],
        numeric_cols=(3,),
        total_row=True,
        caption="Table 2. Precision 16-Combination Sha Tin Quaddie Structure"
    )

    quaddie_callout = (
        "<b>Quaddie Flexi Payout Multipliers:</b> "
        "• <b>$16.00 Stake:</b> 100% Flexi | "
        "• <b>$50.00 Stake:</b> 312.5% Flexi | "
        "• <b>$100.00 Stake:</b> 625.0% Flexi (Recommended: 6.25x full dividend)"
    )
    s += callout(quaddie_callout, label="QUADDIE STAKING & FLEXI GUIDE", tint_color=GREEN_TINT, bar_color=GREEN_BORDER)

    s.append(Spacer(1, 3))
    s.append(Paragraph("Total Session Capital Allocation Model", ST["h1"]))

    portfolio_rows = [
        ["Race 6 Spend", "Win, EW, Boxed Trifecta, SRM", "$100.00", "13.9%"],
        ["Race 7 Spend", "Win, EW, Boxed Trifecta, SRM", "$100.00", "13.9%"],
        ["Race 8 Spend (Feature)", "Win, EW, Boxed Trifecta, SRM", "$100.00", "13.9%"],
        ["Race 9 Spend", "Win, EW, Boxed Trifecta, SRM", "$100.00", "13.9%"],
        ["Race 10 Spend", "Win, EW, Boxed Trifecta, SRM", "$100.00", "13.9%"],
        ["Race 11 Spend", "Win, EW, Boxed Trifecta, SRM", "$100.00", "13.9%"],
        ["Multi-Bet Portfolio", "5 Multi Strategies", "$100.00", "13.9%"],
        ["Sha Tin Quaddie", "16 Combinations @ 125% Flexi", "$20.00", "2.8%"],
        ["Total Session Outlay", "Complete Strategic Coverage", "$720.00", "100.0%"]
    ]
    s += data_table(
        ["Segment", "Allocation Breakdown", "Capital Outlay ($)", "% Bankroll"],
        portfolio_rows,
        col_widths=[0.28, 0.40, 0.18, 0.14],
        numeric_cols=(2, 3),
        total_row=True,
        caption="Table 3. Macro Session Capital Breakdown"
    )

    return s

def build_pdf():
    ps, m = CONFIG["pagesize"], CONFIG["margin"]
    os.makedirs(os.path.dirname(CONFIG["output"]), exist_ok=True)
    doc = BaseDocTemplate(
        CONFIG["output"],
        pagesize=ps,
        leftMargin=m,
        rightMargin=m,
        topMargin=m,
        bottomMargin=m,
        title=CONFIG["title"],
        author=CONFIG["author"],
        subject=CONFIG["subtitle"],
    )
    body_frame = Frame(
        m, m, ps[0] - 2 * m, ps[1] - 2 * m,
        id="body",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    doc.addPageTemplates([PageTemplate(id="body", frames=[body_frame])])

    story = build_story()
    doc.multiBuild(story, canvasmaker=NumberedCanvas)
    return CONFIG["output"]

if __name__ == "__main__":
    out = build_pdf()
    print("Generated PDF at:", out)
