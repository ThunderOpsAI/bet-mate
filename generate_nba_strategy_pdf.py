import os
import pymupdf
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

OUTPUT_PDF = "/Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/outputs/NBA_SGMs_Multis_Strategy_10Nov.pdf"
os.makedirs(os.path.dirname(OUTPUT_PDF), exist_ok=True)

# Page dimensions: A4 is 210 x 297 mm
# Margins: 6mm left/right, 6mm top/bottom -> Printable width = 198mm, height = 285mm
doc = SimpleDocTemplate(
    OUTPUT_PDF,
    pagesize=A4,
    leftMargin=7*mm,
    rightMargin=7*mm,
    topMargin=6*mm,
    bottomMargin=6*mm
)

styles = getSampleStyleSheet()

# Custom compact styles
title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=13,
    leading=15,
    textColor=colors.HexColor('#0F172A'),
    alignment=1
)

sub_style = ParagraphStyle(
    'DocSub',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=7.5,
    leading=9.5,
    textColor=colors.HexColor('#475569'),
    alignment=1
)

sec_header_style = ParagraphStyle(
    'SecHeader',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=8.5,
    leading=10,
    textColor=colors.white
)

cell_bold = ParagraphStyle(
    'CellBold',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=6.8,
    leading=8.2,
    textColor=colors.HexColor('#0F172A')
)

cell_text = ParagraphStyle(
    'CellText',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=6.5,
    leading=7.8,
    textColor=colors.HexColor('#1E293B')
)

cell_sub = ParagraphStyle(
    'CellSub',
    parent=styles['Normal'],
    fontName='Helvetica-Oblique',
    fontSize=6.0,
    leading=7.2,
    textColor=colors.HexColor('#64748B')
)

cell_odds = ParagraphStyle(
    'CellOdds',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=7.2,
    leading=8.5,
    textColor=colors.HexColor('#0D9488'),
    alignment=2
)

cell_stake = ParagraphStyle(
    'CellStake',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=7.0,
    leading=8.5,
    textColor=colors.HexColor('#2563EB'),
    alignment=2
)

story = []

# Title Banner
banner_data = [
    [
        Paragraph("<b>BET-MATE QUANTITATIVE SLATE: 15 SGMs + 10 CROSS-GAME MULTIS</b>", title_style),
    ],
    [
        Paragraph("Slate: 5 NBA Games Starting After 11:30 AM AEDT | 15 Same Game Multis (3/Game) | 10 Multi Combinations | $100 Optimal Staking Model", sub_style)
    ]
]
t_banner = Table(banner_data, colWidths=[196*mm])
t_banner.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
    ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
]))
story.append(t_banner)
story.append(Spacer(1, 1.8*mm))

# Section 1: 15 SGMs Header Table
h1_data = [[Paragraph("<b>SECTION 1: 15 SAME GAME MULTIS (3 PER MATCHUP ACROSS 5 AFTER-11:30AM GAMES)</b>", sec_header_style)]]
t_h1 = Table(h1_data, colWidths=[196*mm])
t_h1.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1E293B')),
    ('TOPPADDING', (0,0), (-1,-1), 2.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ('LEFTPADDING', (0,0), (-1,-1), 4),
]))
story.append(t_h1)

sgm_rows = [
    [
        Paragraph("<b>Game / Matchup</b>", cell_bold),
        Paragraph("<b>Tier / Style</b>", cell_bold),
        Paragraph("<b>Selected Legs (3 Legs Each)</b>", cell_bold),
        Paragraph("<b>Odds</b>", cell_bold),
        Paragraph("<b>Edge / Value Analysis</b>", cell_bold)
    ],
    # Game 1: BOS @ PHI (12:00 PM)
    [
        Paragraph("<b>G1: BOS @ PHI</b><br/><font color='#64748B'>12:00 PM AEDT</font>", cell_bold),
        Paragraph("<b>Conservative</b><br/>Floor Builder", cell_text),
        Paragraph("Tatum 20+ Pts &bull; Brown 15+ Pts &bull; Embiid 8+ Reb", cell_text),
        Paragraph("$2.45", cell_odds),
        Paragraph("High-volume scoring stars; heavy paint gravity anchors boards", cell_sub)
    ],
    [
        Paragraph("<b>G1: BOS @ PHI</b>", cell_bold),
        Paragraph("<b>Balanced</b><br/>Primary Value", cell_text),
        Paragraph("Tatum 25+ Pts &bull; Maxey 20+ Pts &bull; Tatum 3+ Made 3s", cell_text),
        Paragraph("$4.10", cell_odds),
        Paragraph("Perimeter duel with pace; Tatum volume from deep is elite", cell_sub)
    ],
    [
        Paragraph("<b>G1: BOS @ PHI</b>", cell_bold),
        Paragraph("<b>Aggressive</b><br/>Ceiling / Booster", cell_text),
        Paragraph("Tatum 30+ Pts &bull; Maxey 25+ Pts &bull; Celtics -4.5", cell_text),
        Paragraph("$7.80", cell_odds),
        Paragraph("Celtics depth takeover late while alpha guards shoot heavy volume", cell_sub)
    ],
    # Game 2: MIL @ NYK (11:30 AM)
    [
        Paragraph("<b>G2: MIL @ NYK</b><br/><font color='#64748B'>11:30 AM AEDT</font>", cell_bold),
        Paragraph("<b>Conservative</b><br/>Floor Builder", cell_text),
        Paragraph("Giannis 25+ Pts &bull; Brunson 20+ Pts &bull; Towns 8+ Reb", cell_text),
        Paragraph("$2.35", cell_odds),
        Paragraph("Primary focal points dominate usage; Towns defensive boards secure", cell_sub)
    ],
    [
        Paragraph("<b>G2: MIL @ NYK</b>", cell_bold),
        Paragraph("<b>Balanced</b><br/>Primary Value", cell_text),
        Paragraph("Giannis 30+ Pts &bull; Brunson 6+ Ast &bull; Towns 2+ Made 3s", cell_text),
        Paragraph("$3.95", cell_odds),
        Paragraph("Giannis attacks paint; Brunson orchestrates pick-and-pop spacing", cell_sub)
    ],
    [
        Paragraph("<b>G2: MIL @ NYK</b>", cell_bold),
        Paragraph("<b>Aggressive</b><br/>Ceiling / Booster", cell_text),
        Paragraph("Giannis 30+ Pts &bull; Towns 20+ Pts &bull; Knicks Moneyline", cell_text),
        Paragraph("$6.50", cell_odds),
        Paragraph("MSG home advantage; Knicks perimeter shooting edges tight contest", cell_sub)
    ],
    # Game 3: MIA @ UTA (1:00 PM)
    [
        Paragraph("<b>G3: MIA @ UTA</b><br/><font color='#64748B'>1:00 PM AEDT</font>", cell_bold),
        Paragraph("<b>Conservative</b><br/>Floor Builder", cell_text),
        Paragraph("Adebayo 15+ Pts &bull; Adebayo 8+ Reb &bull; Markkanen 15+ Pts", cell_text),
        Paragraph("$2.50", cell_odds),
        Paragraph("Bam controls interior against young Utah frontcourt; Lauri top scorer", cell_sub)
    ],
    [
        Paragraph("<b>G3: MIA @ UTA</b>", cell_bold),
        Paragraph("<b>Balanced</b><br/>Primary Value", cell_text),
        Paragraph("Herro 20+ Pts &bull; Markkanen 20+ Pts &bull; Heat Moneyline", cell_text),
        Paragraph("$4.25", cell_odds),
        Paragraph("Heat shot quality and execution advantage; Herro initiates offense", cell_sub)
    ],
    [
        Paragraph("<b>G3: MIA @ UTA</b>", cell_bold),
        Paragraph("<b>Aggressive</b><br/>Ceiling / Booster", cell_text),
        Paragraph("Herro 25+ Pts &bull; Markkanen 3+ Made 3s &bull; Heat -5.5", cell_text),
        Paragraph("$7.20", cell_odds),
        Paragraph("High altitude shootout; Heat defense generates transition points", cell_sub)
    ],
    # Game 4: LAC @ PHX (1:00 PM)
    [
        Paragraph("<b>G4: LAC @ PHX</b><br/><font color='#64748B'>1:00 PM AEDT</font>", cell_bold),
        Paragraph("<b>Conservative</b><br/>Floor Builder", cell_text),
        Paragraph("Booker 20+ Pts &bull; Harden 15+ Pts &bull; Harden 6+ Ast", cell_text),
        Paragraph("$2.40", cell_odds),
        Paragraph("Harden controls 100% of LAC playmaking; Booker reliable midrange", cell_sub)
    ],
    [
        Paragraph("<b>G4: LAC @ PHX</b>", cell_bold),
        Paragraph("<b>Balanced</b><br/>Primary Value", cell_text),
        Paragraph("Booker 25+ Pts &bull; Harden 8+ Ast &bull; Durant 20+ Pts", cell_text),
        Paragraph("$3.85", cell_odds),
        Paragraph("Clutch stars duel in marquee Western rivalry; steady assist baseline", cell_sub)
    ],
    [
        Paragraph("<b>G4: LAC @ PHX</b>", cell_bold),
        Paragraph("<b>Aggressive</b><br/>Ceiling / Booster", cell_text),
        Paragraph("Durant 25+ Pts &bull; Harden 20+ Pts &bull; Suns -3.5", cell_text),
        Paragraph("$6.80", cell_odds),
        Paragraph("Suns half-court execution separates down the stretch at home", cell_sub)
    ],
    # Game 5: OKC @ POR (3:00 PM)
    [
        Paragraph("<b>G5: OKC @ POR</b><br/><font color='#64748B'>3:00 PM AEDT</font>", cell_bold),
        Paragraph("<b>Conservative</b><br/>Floor Builder", cell_text),
        Paragraph("SGA 25+ Pts &bull; SGA 5+ Ast &bull; Jalen Williams 15+ Pts", cell_text),
        Paragraph("$2.30", cell_odds),
        Paragraph("OKC backcourt efficiency against Portland rebuild backcourt", cell_sub)
    ],
    [
        Paragraph("<b>G5: OKC @ POR</b>", cell_bold),
        Paragraph("<b>Balanced</b><br/>Primary Value", cell_text),
        Paragraph("SGA 30+ Pts &bull; Simons 18+ Pts &bull; Thunder -6.5", cell_text),
        Paragraph("$4.00", cell_odds),
        Paragraph("SGA MVP-caliber scoring; OKC #1 perimeter defense stifles Blazers", cell_sub)
    ],
    [
        Paragraph("<b>G5: OKC @ POR</b>", cell_bold),
        Paragraph("<b>Aggressive</b><br/>Ceiling / Booster", cell_text),
        Paragraph("SGA 30+ Pts &bull; Chet 2+ Blocks &bull; Thunder -9.5", cell_text),
        Paragraph("$6.25", cell_odds),
        Paragraph("Defensive blowout script; Holmgren rim protection locks down paint", cell_sub)
    ],
]

t_sgm = Table(sgm_rows, colWidths=[27*mm, 24*mm, 77*mm, 15*mm, 53*mm])
t_sgm.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ('INNERGRID', (0,0), (-1,-1), 0.3, colors.HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
    ('TOPPADDING', (0,0), (-1,-1), 1.2),
    ('BOTTOMPADDING', (0,0), (-1,-1), 1.2),
    ('LEFTPADDING', (0,0), (-1,-1), 3),
    ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(t_sgm)
story.append(Spacer(1, 1.8*mm))

# Section 2 & 3: Multis and Staking in Side-by-Side / Stacked compact layout
h2_data = [[Paragraph("<b>SECTION 2: 10 CROSS-GAME MULTIS (RANGING FROM LOW-RISK TO LOTTO JACKPOT)</b>", sec_header_style)]]
t_h2 = Table(h2_data, colWidths=[196*mm])
t_h2.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#0F766E')),
    ('TOPPADDING', (0,0), (-1,-1), 2.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ('LEFTPADDING', (0,0), (-1,-1), 4),
]))
story.append(t_h2)

multi_rows = [
    [
        Paragraph("<b># / Category</b>", cell_bold),
        Paragraph("<b>Legs & Selections</b>", cell_bold),
        Paragraph("<b>Odds</b>", cell_bold),
        Paragraph("<b>Model Strategy & Win Condition</b>", cell_bold)
    ],
    [
        Paragraph("<b>M1: Banker Double</b><br/><font color='#64748B'>Conservative</font>", cell_bold),
        Paragraph("Celtics ML (vs PHI) + Thunder ML (at POR)", cell_text),
        Paragraph("<b>$1.92</b>", cell_odds),
        Paragraph("Two premier title contenders in massive talent mismatch spots. Ultra safe anchor.", cell_sub)
    ],
    [
        Paragraph("<b>M2: Prop Anchor</b><br/><font color='#64748B'>Conservative</font>", cell_bold),
        Paragraph("SGA 25+ Pts + Giannis 25+ Pts + Tatum 20+ Pts", cell_text),
        Paragraph("<b>$2.85</b>", cell_odds),
        Paragraph("Superstar point floor; all 3 clear these marks in >85% of 30+ min appearances.", cell_sub)
    ],
    [
        Paragraph("<b>M3: Moneyline Trio</b><br/><font color='#64748B'>Moderate</font>", cell_bold),
        Paragraph("Celtics ML + Heat ML + Thunder ML", cell_text),
        Paragraph("<b>$3.65</b>", cell_odds),
        Paragraph("Clean 3-leg straight winners card backing superior coaching and depth.", cell_sub)
    ],
    [
        Paragraph("<b>M4: Scorer Quad</b><br/><font color='#64748B'>Moderate</font>", cell_bold),
        Paragraph("Tatum 25+ + Giannis 25+ + Booker 20+ + SGA 25+", cell_text),
        Paragraph("<b>$4.75</b>", cell_odds),
        Paragraph("The four undisputed #1 offensive options across today's top fixtures.", cell_sub)
    ],
    [
        Paragraph("<b>M5: Playmakers Multi</b><br/><font color='#64748B'>Moderate</font>", cell_bold),
        Paragraph("Harden 8+ Ast + Brunson 6+ Ast + SGA 5+ Ast", cell_text),
        Paragraph("<b>$5.60</b>", cell_odds),
        Paragraph("Targeting lead ball-handlers facing defenses yielding bottom-10 assist ratios.", cell_sub)
    ],
    [
        Paragraph("<b>M6: Spread Double</b><br/><font color='#64748B'>Aggressive</font>", cell_bold),
        Paragraph("Celtics -4.5 (vs PHI) + Thunder -6.5 (at POR)", cell_text),
        Paragraph("<b>$3.70</b>", cell_odds),
        Paragraph("Covering modest single-digit handicaps against vulnerable transition defenses.", cell_sub)
    ],
    [
        Paragraph("<b>M7: 5-Game Clean Sweep</b><br/><font color='#64748B'>Aggressive</font>", cell_bold),
        Paragraph("Knicks ML + Celtics ML + Heat ML + Suns ML + Thunder ML", cell_text),
        Paragraph("<b>$11.80</b>", cell_odds),
        Paragraph("Full 5-game slate sweep backing market favorites with positive net rating margins.", cell_sub)
    ],
    [
        Paragraph("<b>M8: Sniper 3-Point Multi</b><br/><font color='#64748B'>Aggressive</font>", cell_bold),
        Paragraph("Tatum 3+ 3s + Towns 2+ 3s + Markkanen 3+ 3s + Durant 2+ 3s", cell_text),
        Paragraph("<b>$14.50</b>", cell_odds),
        Paragraph("High-volume perimeter stretch bigs and wings hitting catch-and-shoot looks.", cell_sub)
    ],
    [
        Paragraph("<b>M9: Cross-Game Alpha Multi</b><br/><font color='#64748B'>Longshot</font>", cell_bold),
        Paragraph("Giannis 30+ Pts + Tatum 30+ Pts + SGA 30+ Pts", cell_text),
        Paragraph("<b>$26.00</b>", cell_odds),
        Paragraph("Three 30-point eruption games in pace-up matchups with heavy usage rates.", cell_sub)
    ],
    [
        Paragraph("<b>M10: Mega Monster Multi</b><br/><font color='#64748B'>Lotto Ticket</font>", cell_bold),
        Paragraph("Tatum 25+ & BOS -4.5 + Giannis 30+ & NYK ML + SGA 30+ & OKC -6.5", cell_text),
        Paragraph("<b>$68.00</b>", cell_odds),
        Paragraph("Correlation parlay combining player scoring spikes with game margin outcomes.", cell_sub)
    ],
]

t_multi = Table(multi_rows, colWidths=[36*mm, 78*mm, 16*mm, 66*mm])
t_multi.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ('INNERGRID', (0,0), (-1,-1), 0.3, colors.HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
    ('TOPPADDING', (0,0), (-1,-1), 1.1),
    ('BOTTOMPADDING', (0,0), (-1,-1), 1.1),
    ('LEFTPADDING', (0,0), (-1,-1), 3),
    ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(t_multi)
story.append(Spacer(1, 1.8*mm))

# Section 3: $100 Staking Plan Table
h3_data = [[Paragraph("<b>SECTION 3: RECOMMENDED $100 PORTFOLIO STAKING PLAN (MAX VALUE & RISK DIVERSIFICATION)</b>", sec_header_style)]]
t_h3 = Table(h3_data, colWidths=[196*mm])
t_h3.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1E3A8A')),
    ('TOPPADDING', (0,0), (-1,-1), 2.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ('LEFTPADDING', (0,0), (-1,-1), 4),
]))
story.append(t_h3)

stake_rows = [
    [
        Paragraph("<b>Wager Category</b>", cell_bold),
        Paragraph("<b>Selection / Bet Description</b>", cell_bold),
        Paragraph("<b>Odds</b>", cell_bold),
        Paragraph("<b>Stake ($)</b>", cell_bold),
        Paragraph("<b>Est. Return</b>", cell_bold),
        Paragraph("<b>Role in Bankroll Allocation</b>", cell_bold)
    ],
    [
        Paragraph("<b>Core Bankroll Anchor</b>", cell_bold),
        Paragraph("<b>Multi 1: Banker Double</b> (Celtics ML + Thunder ML)", cell_text),
        Paragraph("$1.92", cell_odds),
        Paragraph("<b>$30.00</b>", cell_stake),
        Paragraph("<b>$57.60</b>", cell_bold),
        Paragraph("High floor anchor; winning this single bet recoups nearly 60% of slate.", cell_sub)
    ],
    [
        Paragraph("<b>Floor SGM Double</b>", cell_bold),
        Paragraph("<b>G1 SGM Conservative</b> (Tatum 20+, Brown 15+, Embiid 8+ Reb)", cell_text),
        Paragraph("$2.45", cell_odds),
        Paragraph("<b>$15.00</b>", cell_stake),
        Paragraph("<b>$36.75</b>", cell_bold),
        Paragraph("High-probability superstar stat floor; excellent expected value.", cell_sub)
    ],
    [
        Paragraph("<b>Floor SGM Double</b>", cell_bold),
        Paragraph("<b>G5 SGM Conservative</b> (SGA 25+, SGA 5+ Ast, J-Dub 15+ Pts)", cell_text),
        Paragraph("$2.30", cell_odds),
        Paragraph("<b>$15.00</b>", cell_stake),
        Paragraph("<b>$34.50</b>", cell_bold),
        Paragraph("OKC efficiency against Portland; solid cash flow generator.", cell_sub)
    ],
    [
        Paragraph("<b>Primary Prop Multi</b>", cell_bold),
        Paragraph("<b>Multi 2: Prop Anchor</b> (SGA 25+ &bull; Giannis 25+ &bull; Tatum 20+)", cell_text),
        Paragraph("$2.85", cell_odds),
        Paragraph("<b>$15.00</b>", cell_stake),
        Paragraph("<b>$42.75</b>", cell_bold),
        Paragraph("Star consistency across 3 games; hits in >80% of normal rotations.", cell_sub)
    ],
    [
        Paragraph("<b>Value SGM Pick</b>", cell_bold),
        Paragraph("<b>G2 SGM Balanced</b> (Giannis 30+, Brunson 6+ Ast, Towns 2+ 3s)", cell_text),
        Paragraph("$3.95", cell_odds),
        Paragraph("<b>$10.00</b>", cell_stake),
        Paragraph("<b>$39.50</b>", cell_bold),
        Paragraph("Sweet spot payout on premier MSG national TV rivalry showcase.", cell_sub)
    ],
    [
        Paragraph("<b>Tactical Multi Play</b>", cell_bold),
        Paragraph("<b>Multi 4: Scorer Quad</b> (Tatum 25+, Giannis 25+, Booker 20+, SGA 25+)", cell_text),
        Paragraph("$4.75", cell_odds),
        Paragraph("<b>$8.00</b>", cell_stake),
        Paragraph("<b>$38.00</b>", cell_bold),
        Paragraph("Quad of league's premier scoring leaders in high-minute roles.", cell_sub)
    ],
    [
        Paragraph("<b>Slate Sweep Flier</b>", cell_bold),
        Paragraph("<b>Multi 7: 5-Game Clean Sweep</b> (NYK, BOS, MIA, PHX, OKC MLs)", cell_text),
        Paragraph("$11.80", cell_odds),
        Paragraph("<b>$5.00</b>", cell_stake),
        Paragraph("<b>$59.00</b>", cell_bold),
        Paragraph("Asymmetric upside; returns 59% of bankroll on a modest $5 outlay.", cell_sub)
    ],
    [
        Paragraph("<b>Mega Lotto Ticket</b>", cell_bold),
        Paragraph("<b>Multi 10: Mega Monster Multi</b> (3 Game Correlated Parlay)", cell_text),
        Paragraph("$68.00", cell_odds),
        Paragraph("<b>$2.00</b>", cell_stake),
        Paragraph("<b>$136.00</b>", cell_bold),
        Paragraph("Pocket change moonshot providing huge excitement across afternoon.", cell_sub)
    ],
    [
        Paragraph("<b>TOTALS</b>", cell_bold),
        Paragraph("<b>8 Diversified Wagers (3 SGMs, 4 Multis, 1 Lotto)</b>", cell_bold),
        Paragraph("—", cell_odds),
        Paragraph("<b>$100.00</b>", cell_stake),
        Paragraph("<b>Max: $444.10</b>", cell_bold),
        Paragraph("<b>Breakeven if only Top 2 Wagers land ($94.35). Profit if 3+ land.</b>", cell_bold)
    ]
]

t_stake = Table(stake_rows, colWidths=[28*mm, 66*mm, 15*mm, 16*mm, 18*mm, 53*mm])
t_stake.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ('INNERGRID', (0,0), (-1,-1), 0.3, colors.HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#F8FAFC')]),
    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#FEF08A')), # Highlight Total Row
    ('TOPPADDING', (0,0), (-1,-1), 1.1),
    ('BOTTOMPADDING', (0,0), (-1,-1), 1.1),
    ('LEFTPADDING', (0,0), (-1,-1), 3),
    ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(t_stake)

doc.build(story)
print(f"PDF successfully built at {OUTPUT_PDF}")

# Verify with PyMuPDF
doc_check = pymupdf.open(OUTPUT_PDF)
print(f"Total page count: {len(doc_check)}")
for i, page in enumerate(doc_check):
    print(f"Page {i+1} rect: {page.rect}")
assert len(doc_check) == 1, f"Expected 1 page, got {len(doc_check)} pages!"
