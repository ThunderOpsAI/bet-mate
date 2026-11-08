import os
from xml.sax.saxutils import escape
import pymupdf

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, KeepTogether, ListFlowable, ListItem,
    NextPageTemplate, PageBreak, PageTemplate, Paragraph, Spacer, Table,
    TableStyle
)

OUTPUT_PDF = "/Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/outputs/test_fit.pdf"

CONFIG = dict(
    title="Sha Tin Race Day Strategy: Races 6 to 11",
    subtitle="Sa Sa Ladies' Purse Day - Full Form, $100 Staking, Multis & Quaddie",
    author="Bet-Mate Quantitative Racing Strategy",
    date="8 November 2026",
    footer_left="Bet-Mate Racing Intelligence | Sha Tin",
    pagesize=A4,
    margin=15 * mm,
    accent="#0F4C81",
    output=OUTPUT_PDF,
)

ACCENT = colors.HexColor(CONFIG["accent"])
ACCENT_LIGHT = colors.HexColor("#2C6CB0")
INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#555E6D")
RULE = colors.HexColor("#D1D5DB")
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
    base_s = dict(fontName=F, fontSize=8.5, leading=11.5, textColor=INK, spaceAfter=2, alignment=TA_LEFT)
    base_s.update(kw)
    return ParagraphStyle(name, **base_s)

ST = dict(
    body=S("body"),
    doc_title=S("doc_title", fontName=FB, fontSize=17, leading=20, textColor=ACCENT, spaceAfter=2),
    doc_subtitle=S("doc_subtitle", fontName=F, fontSize=9.5, leading=13, textColor=MUTED, spaceAfter=4),
    h1=S("H1", fontName=FB, fontSize=12, leading=15, textColor=ACCENT, spaceBefore=4, spaceAfter=2, keepWithNext=1),
    race_title=S("race_title", fontName=FB, fontSize=10.5, leading=13, textColor=colors.white, spaceAfter=0),
    race_meta=S("race_meta", fontName=F, fontSize=7.5, leading=9.5, textColor=colors.HexColor("#E2E8F0"), spaceAfter=0),
    th=S("th", fontName=FB, fontSize=8, leading=10, textColor=colors.white, spaceAfter=0),
    td=S("td", fontSize=8, leading=10.5, spaceAfter=0),
    td_bold=S("td_bold", fontName=FB, fontSize=8, leading=10.5, spaceAfter=0),
    td_r=S("td_r", fontSize=8, leading=10.5, spaceAfter=0, alignment=TA_RIGHT),
    td_r_bold=S("td_r_bold", fontName=FB, fontSize=8, leading=10.5, spaceAfter=0, alignment=TA_RIGHT),
    th_r=S("th_r", fontName=FB, fontSize=8, leading=10, textColor=colors.white, spaceAfter=0, alignment=TA_RIGHT),
    callout=S("callout", fontSize=8, leading=11, spaceAfter=0),
    card_text=S("card_text", fontSize=8, leading=10.8, spaceAfter=0),
    caption=S("caption", fontName=FI, fontSize=7.5, leading=9.5, textColor=MUTED, alignment=TA_CENTER, spaceBefore=1, spaceAfter=3),
)

def usable_width():
    return CONFIG["pagesize"][0] - 2 * CONFIG["margin"]

def callout(text, label=None, tint_color=TINT, bar_color=ACCENT):
    inner = (f"<b>{escape(label)}: </b>" if label else "") + text
    t = Table([[Paragraph(inner, ST["callout"])]], colWidths=[usable_width()])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint_color),
        ("LINEBEFORE", (0, 0), (0, -1), 3, bar_color),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [t, Spacer(1, 3)]

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
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
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
        out.append(Spacer(1, 3))
    return out

def race_banner(race_no, title, meta):
    t = Table([
        [Paragraph(f"<b>RACE {race_no}: {escape(title).upper()}</b>", ST["race_title"])],
        [Paragraph(escape(meta), ST["race_meta"])]
    ], colWidths=[usable_width()])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, 0), 3),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 3),
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
        ("BOX", (0, 0), (-1, -1), 0.4, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
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
    flow.append(Spacer(1, 4))
    return flow
print('Setup complete')
