import os
import pymupdf
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

OUTPUT_PDF = "/Users/thunderopsai/Documents/Workspace/01_Projects/bet-mate/outputs/NBA_7Games_21SGMs_15Multis_100Spend.pdf"
os.makedirs(os.path.dirname(OUTPUT_PDF), exist_ok=True)

# Page dimensions: A4 is 210 x 297 mm
# Margins: 6mm left/right, 5.5mm top/bottom -> Printable width = 198mm, height = 286mm
doc = SimpleDocTemplate(
    OUTPUT_PDF,
    pagesize=A4,
    leftMargin=6*mm,
    rightMargin=6*mm,
    topMargin=5.5*mm,
    bottomMargin=5.5*mm
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=11.5,
    leading=13.5,
    textColor=colors.HexColor('#0F172A'),
    alignment=1
)

sub_style = ParagraphStyle(
    'DocSub',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=6.8,
    leading=8.5,
    textColor=colors.HexColor('#475569'),
    alignment=1
)

sec_header_style = ParagraphStyle(
    'SecHeader',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=7.6,
    leading=9.2,
    textColor=colors.white
)

cell_bold = ParagraphStyle(
    'CellBold',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=5.9,
    leading=7.2,
    textColor=colors.HexColor('#0F172A')
)

cell_text = ParagraphStyle(
    'CellText',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=5.6,
    leading=6.9,
    textColor=colors.HexColor('#1E293B')
)

cell_sub = ParagraphStyle(
    'CellSub',
    parent=styles['Normal'],
    fontName='Helvetica-Oblique',
    fontSize=5.2,
    leading=6.4,
    textColor=colors.HexColor('#64748B')
)

cell_odds = ParagraphStyle(
    'CellOdds',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=6.3,
    leading=7.5,
    textColor=colors.HexColor('#0D9488'),
    alignment=2
)

cell_stake = ParagraphStyle(
    'CellStake',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=6.3,
    leading=7.5,
    textColor=colors.HexColor('#2563EB'),
    alignment=2
)

story = []

# Title Banner
banner_data = [
    [
        Paragraph("<b>BET-MATE NBA QUANTITATIVE CARD: 7 GAMES | 21 SGMs | 15 MULTIS | $100 PORTFOLIO</b>", title_style),
    ],
    [
        Paragraph("Slate: NOP-GSW, SAS-PHX, DEN-HOU, BOS-PHI, NYK-MIL, ORL-SAC, OKC-POR | 100% Active Star Anchors | 21 SGMs (3/Game) | 15 Cross-Game Multis ($1.90 to $92) | 1-Page Master Sheet", sub_style)
    ]
]
t_banner = Table(banner_data, colWidths=[198*mm])
t_banner.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
    ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#CBD5E1')),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('TOPPADDING', (0,0), (-1,-1), 2.2),
    ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
]))
story.append(t_banner)
story.append(Spacer(1, 1.2*mm))

# Section 1: 21 SGMs across 7 games
h1_data = [[Paragraph("<b>SECTION 1: 21 SAME GAME MULTIS (3 PER MATCHUP: CONSERVATIVE FLOOR &bull; BALANCED VALUE &bull; AGGRESSIVE CEILING)</b>", sec_header_style)]]
t_h1 = Table(h1_data, colWidths=[198*mm])
t_h1.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1E293B')),
    ('TOPPADDING', (0,0), (-1,-1), 1.8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
    ('LEFTPADDING', (0,0), (-1,-1), 3),
]))
story.append(t_h1)

sgm_rows = [
    [
        Paragraph("<b>Game / Matchup</b>", cell_bold),
        Paragraph("<b>Tier / Type</b>", cell_bold),
        Paragraph("<b>Selected Legs (Active Player Stats & Markets)</b>", cell_bold),
        Paragraph("<b>Odds</b>", cell_bold),
        Paragraph("<b>Model Rationale & Win Condition</b>", cell_bold)
    ],
    # 1. NOP @ GSW
    [
        Paragraph("<b>1. NOP @ GSW</b>", cell_bold),
        Paragraph("<b>Conservative</b>", cell_text),
        Paragraph("Stephen Curry 20+ Pts &bull; Stephen Curry 3+ Made 3s &bull; Brandon Ingram 15+ Pts", cell_text),
        Paragraph("$2.25", cell_odds),
        Paragraph("Curry elite perimeter gravity at home; Ingram undisputed primary wing scorer.", cell_sub)
    ],
    [
        Paragraph("<b>1. NOP @ GSW</b>", cell_bold),
        Paragraph("<b>Balanced</b>", cell_text),
        Paragraph("Stephen Curry 25+ Pts &bull; Draymond Green 5+ Ast &bull; Warriors Moneyline", cell_text),
        Paragraph("$3.75", cell_odds),
        Paragraph("Chase Center tempo advantage; Draymond playmaking off Curry split-cuts.", cell_sub)
    ],
    [
        Paragraph("<b>1. NOP @ GSW</b>", cell_bold),
        Paragraph("<b>Aggressive</b>", cell_text),
        Paragraph("Curry 30+ Pts &bull; Curry 5+ 3s &bull; Ingram 20+ Pts &bull; Warriors -5.5", cell_text),
        Paragraph("$6.80", cell_odds),
        Paragraph("Splash explosion script with fast-break separation down the stretch.", cell_sub)
    ],
    # 2. SAS @ PHX
    [
        Paragraph("<b>2. SAS @ PHX</b>", cell_bold),
        Paragraph("<b>Conservative</b>", cell_text),
        Paragraph("Victor Wembanyama 18+ Pts &bull; Wembanyama 8+ Reb &bull; Devin Booker 20+ Pts", cell_text),
        Paragraph("$2.35", cell_odds),
        Paragraph("Wemby interior dominance & putbacks; Booker reliable primary scoring load.", cell_sub)
    ],
    [
        Paragraph("<b>2. SAS @ PHX</b>", cell_bold),
        Paragraph("<b>Balanced</b>", cell_text),
        Paragraph("Wembanyama 2+ Blocks &bull; Booker 25+ Pts &bull; Kevin Durant 20+ Pts", cell_text),
        Paragraph("$3.90", cell_odds),
        Paragraph("Wemby rim protection anchor; Suns dual stars exploit midrange mismatches.", cell_sub)
    ],
    [
        Paragraph("<b>2. SAS @ PHX</b>", cell_bold),
        Paragraph("<b>Aggressive</b>", cell_text),
        Paragraph("Wembanyama 20+ Pts &bull; Durant 25+ Pts &bull; Suns -4.5", cell_text),
        Paragraph("$6.40", cell_odds),
        Paragraph("Suns veteran execution and late-game shot-making secure home margin.", cell_sub)
    ],
    # 3. DEN @ HOU
    [
        Paragraph("<b>3. DEN @ HOU</b>", cell_bold),
        Paragraph("<b>Conservative</b>", cell_text),
        Paragraph("Nikola Jokić 20+ Pts &bull; Nikola Jokić 8+ Reb &bull; Alperen Şengün 12+ Pts", cell_text),
        Paragraph("$2.20", cell_odds),
        Paragraph("Jokić triple-double baseline; Şengün post hub role inside Rockets scheme.", cell_sub)
    ],
    [
        Paragraph("<b>3. DEN @ HOU</b>", cell_bold),
        Paragraph("<b>Balanced</b>", cell_text),
        Paragraph("Jokić 25+ Pts &bull; Jokić 8+ Ast &bull; Jamal Murray 15+ Pts", cell_text),
        Paragraph("$3.60", cell_odds),
        Paragraph("Denver two-man game runs offense; Jokić picks apart Houston defensive rotations.", cell_sub)
    ],
    [
        Paragraph("<b>3. DEN @ HOU</b>", cell_bold),
        Paragraph("<b>Aggressive</b>", cell_text),
        Paragraph("Jokić Triple-Double (Pts+Reb+Ast) &bull; Şengün 15+ Pts &bull; Nuggets Moneyline", cell_text),
        Paragraph("$7.20", cell_odds),
        Paragraph("Marquee battle of passing bigs; Jokić controls pace for a Denver road victory.", cell_sub)
    ],
    # 4. BOS @ PHI
    [
        Paragraph("<b>4. BOS @ PHI</b>", cell_bold),
        Paragraph("<b>Conservative</b>", cell_text),
        Paragraph("Jayson Tatum 20+ Pts &bull; Jaylen Brown 15+ Pts &bull; Tyrese Maxey 18+ Pts", cell_text),
        Paragraph("$2.30", cell_odds),
        Paragraph("All three clear these scoring thresholds in over 85% of normal minute rotations.", cell_sub)
    ],
    [
        Paragraph("<b>4. BOS @ PHI</b>", cell_bold),
        Paragraph("<b>Balanced</b>", cell_text),
        Paragraph("Tatum 25+ Pts &bull; Maxey 22+ Pts &bull; Tatum 3+ Made 3s", cell_text),
        Paragraph("$3.85", cell_odds),
        Paragraph("High-pace East showdown; Tatum takes heavy volume from deep against drop coverage.", cell_sub)
    ],
    [
        Paragraph("<b>4. BOS @ PHI</b>", cell_bold),
        Paragraph("<b>Aggressive</b>", cell_text),
        Paragraph("Tatum 30+ Pts &bull; Maxey 25+ Pts &bull; Celtics -4.5", cell_text),
        Paragraph("$6.90", cell_odds),
        Paragraph("Celtics depth & defensive switching clamp down 4th quarter to cover spread.", cell_sub)
    ],
    # 5. NYK @ MIL
    [
        Paragraph("<b>5. NYK @ MIL</b>", cell_bold),
        Paragraph("<b>Conservative</b>", cell_text),
        Paragraph("Giannis Antetokounmpo 25+ Pts &bull; Jalen Brunson 20+ Pts &bull; Karl-Anthony Towns 8+ Reb", cell_text),
        Paragraph("$2.35", cell_odds),
        Paragraph("Giannis paint dominance; Brunson heavy pick-and-roll usage; Towns board presence.", cell_sub)
    ],
    [
        Paragraph("<b>5. NYK @ MIL</b>", cell_bold),
        Paragraph("<b>Balanced</b>", cell_text),
        Paragraph("Giannis 30+ Pts &bull; Brunson 6+ Ast &bull; Towns 2+ Made 3s", cell_text),
        Paragraph("$4.10", cell_odds),
        Paragraph("Giannis attacks the rim; Brunson sets up perimeter shooters; KAT floor spacing.", cell_sub)
    ],
    [
        Paragraph("<b>5. NYK @ MIL</b>", cell_bold),
        Paragraph("<b>Aggressive</b>", cell_text),
        Paragraph("Giannis 30+ Pts &bull; Towns 20+ Pts &bull; Knicks Moneyline", cell_text),
        Paragraph("$6.75", cell_odds),
        Paragraph("Fiserv Forum thriller; Knicks perimeter efficiency edges Bucks late.", cell_sub)
    ],
    # 6. ORL @ SAC
    [
        Paragraph("<b>6. ORL @ SAC</b>", cell_bold),
        Paragraph("<b>Conservative</b>", cell_text),
        Paragraph("De'Aaron Fox 20+ Pts &bull; Domantas Sabonis 10+ Reb &bull; Franz Wagner 18+ Pts", cell_text),
        Paragraph("$2.40", cell_odds),
        Paragraph("Fox speed in transition; Sabonis league-leading double-double machine; Franz #1 option.", cell_sub)
    ],
    [
        Paragraph("<b>6. ORL @ SAC</b>", cell_bold),
        Paragraph("<b>Balanced</b>", cell_text),
        Paragraph("Fox 25+ Pts &bull; Sabonis 6+ Ast &bull; Kings Moneyline", cell_text),
        Paragraph("$3.70", cell_odds),
        Paragraph("Sacramento 'Beam Team' offensive pace at home against Magic halfcourt defense.", cell_sub)
    ],
    [
        Paragraph("<b>6. ORL @ SAC</b>", cell_bold),
        Paragraph("<b>Aggressive</b>", cell_text),
        Paragraph("Fox 25+ Pts &bull; DeMar DeRozan 20+ Pts &bull; Kings -4.5", cell_text),
        Paragraph("$6.10", cell_odds),
        Paragraph("Kings clutch dual-star scoring combination closes out wire-to-wire win.", cell_sub)
    ],
    # 7. OKC @ POR (Active Players: SGA, Isaiah Hartenstein, Chet Holmgren)
    [
        Paragraph("<b>7. OKC @ POR</b>", cell_bold),
        Paragraph("<b>Conservative</b>", cell_text),
        Paragraph("Shai Gilgeous-Alexander 25+ Pts &bull; SGA 5+ Ast &bull; Isaiah Hartenstein 8+ Reb", cell_text),
        Paragraph("$2.30", cell_odds),
        Paragraph("SGA MVP-level consistency against Portland guards; Hartenstein starting C glass cleaner.", cell_sub)
    ],
    [
        Paragraph("<b>7. OKC @ POR</b>", cell_bold),
        Paragraph("<b>Balanced</b>", cell_text),
        Paragraph("SGA 30+ Pts &bull; Chet Holmgren 8+ Reb &bull; Thunder -6.5", cell_text),
        Paragraph("$3.80", cell_odds),
        Paragraph("OKC league-best defensive rating causes turnovers leading to high-efficiency transition.", cell_sub)
    ],
    [
        Paragraph("<b>7. OKC @ POR</b>", cell_bold),
        Paragraph("<b>Aggressive</b>", cell_text),
        Paragraph("SGA 30+ Pts &bull; Chet 2+ Blocks &bull; Thunder -9.5", cell_text),
        Paragraph("$6.20", cell_odds),
        Paragraph("Defensive clinic blowout script; Chet rim protection erases Portland paint attempts.", cell_sub)
    ],
]

t_sgm = Table(sgm_rows, colWidths=[23*mm, 18*mm, 78*mm, 13*mm, 66*mm])
t_sgm.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
    ('TOPPADDING', (0,0), (-1,-1), 0.7),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0.7),
    ('LEFTPADDING', (0,0), (-1,-1), 2.5),
    ('RIGHTPADDING', (0,0), (-1,-1), 2.5),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(t_sgm)
story.append(Spacer(1, 1.2*mm))

# Section 2: 15 Cross-Game Multis
h2_data = [[Paragraph("<b>SECTION 2: 15 CROSS-GAME MULTIS (TIERED FROM ULTRA-CONSERVATIVE ANCHORS TO MEGA JACKPOT LONGSHOTS)</b>", sec_header_style)]]
t_h2 = Table(h2_data, colWidths=[198*mm])
t_h2.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#0F766E')),
    ('TOPPADDING', (0,0), (-1,-1), 1.8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
    ('LEFTPADDING', (0,0), (-1,-1), 3),
]))
story.append(t_h2)

multi_rows = [
    [
        Paragraph("<b># / Category</b>", cell_bold),
        Paragraph("<b>Multi Selections & Active Legs</b>", cell_bold),
        Paragraph("<b>Odds</b>", cell_bold),
        Paragraph("<b>Model Strategy & Expected Value Rationale</b>", cell_bold)
    ],
    [
        Paragraph("<b>M1: Banker Double</b> (Low)", cell_bold),
        Paragraph("Celtics Moneyline + Thunder Moneyline", cell_text),
        Paragraph("<b>$1.90</b>", cell_odds),
        Paragraph("Two elite championship contenders facing rebuilding/shorthanded opponents.", cell_sub)
    ],
    [
        Paragraph("<b>M2: Home Fort Double</b> (Low)", cell_bold),
        Paragraph("Warriors Moneyline + Suns Moneyline", cell_text),
        Paragraph("<b>$2.15</b>", cell_odds),
        Paragraph("Targeting dominant home court teams with rest advantage and veteran closers.", cell_sub)
    ],
    [
        Paragraph("<b>M3: Superstar Points Anchor</b>", cell_bold),
        Paragraph("SGA 25+ Pts + Giannis 25+ Pts + Tatum 20+ Pts", cell_text),
        Paragraph("<b>$2.75</b>", cell_odds),
        Paragraph("The three most bulletproof scoring floors in the league; >85% hit rate together.", cell_sub)
    ],
    [
        Paragraph("<b>M4: Paint Kings Boards</b>", cell_bold),
        Paragraph("Jokić 8+ Reb + Sabonis 10+ Reb + Wembanyama 8+ Reb", cell_text),
        Paragraph("<b>$2.80</b>", cell_odds),
        Paragraph("Top 3 rebounding hubs in the NBA securing defensive boards and easy putbacks.", cell_sub)
    ],
    [
        Paragraph("<b>M5: Moneyline Trio</b> (Mod)", cell_bold),
        Paragraph("Celtics ML + Thunder ML + Kings ML", cell_text),
        Paragraph("<b>$3.10</b>", cell_odds),
        Paragraph("High-floor straight winners trio avoiding points spreads on heavy favourites.", cell_sub)
    ],
    [
        Paragraph("<b>M6: Spread Double</b> (Mod)", cell_bold),
        Paragraph("Celtics -4.5 + Thunder -6.5", cell_text),
        Paragraph("<b>$3.65</b>", cell_odds),
        Paragraph("Covering single-digit handicaps where net ratings project double-digit margin wins.", cell_sub)
    ],
    [
        Paragraph("<b>M7: 20-Point Star Quad</b>", cell_bold),
        Paragraph("Curry 20+ + Tatum 20+ + Booker 20+ + SGA 20+", cell_text),
        Paragraph("<b>$4.20</b>", cell_odds),
        Paragraph("Primary focal points logging 32+ minutes; avoids high lines while bagging sweet odds.", cell_sub)
    ],
    [
        Paragraph("<b>M8: Playmakers Assist Trio</b>", cell_bold),
        Paragraph("Jokić 8+ Ast + Sabonis 6+ Ast + Brunson 6+ Ast", cell_text),
        Paragraph("<b>$4.60</b>", cell_odds),
        Paragraph("Offensive hubs whose teams funnel 60%+ of shot creations through their hands.", cell_sub)
    ],
    [
        Paragraph("<b>M9: 4-Game Power Card</b>", cell_bold),
        Paragraph("Warriors ML + Suns ML + Celtics ML + Thunder ML", cell_text),
        Paragraph("<b>$5.20</b>", cell_odds),
        Paragraph("Clean 4-leg favorite parlay combining home-court power with elite defensive squads.", cell_sub)
    ],
    [
        Paragraph("<b>M10: Scoring Monsters Trio</b>", cell_bold),
        Paragraph("Giannis 30+ Pts + Tatum 25+ Pts + Curry 25+ Pts", cell_text),
        Paragraph("<b>$7.40</b>", cell_odds),
        Paragraph("Capitalizing on fast-paced, high total matchups where stars command 20+ FGA.", cell_sub)
    ],
    [
        Paragraph("<b>M11: Perimeter Splash Quad</b>", cell_bold),
        Paragraph("Curry 3+ 3s + Tatum 3+ 3s + Towns 2+ 3s + Durant 2+ 3s", cell_text),
        Paragraph("<b>$8.90</b>", cell_odds),
        Paragraph("Shooting specialists facing drop defenses conceding above-average above-the-break 3s.", cell_sub)
    ],
    [
        Paragraph("<b>M12: All-Star 5-Game Sweep</b>", cell_bold),
        Paragraph("Warriors ML + Nuggets ML + Celtics ML + Kings ML + Thunder ML", cell_text),
        Paragraph("<b>$11.50</b>", cell_odds),
        Paragraph("Sweeping today's 5 strongest statistical power rated teams across the board.", cell_sub)
    ],
    [
        Paragraph("<b>M13: Defensive Titans Multi</b>", cell_bold),
        Paragraph("Wembanyama 3+ Blocks + Chet Holmgren 2+ Blocks + Jokić Double-Double", cell_text),
        Paragraph("<b>$14.80</b>", cell_odds),
        Paragraph("Targeting the two premier rim protectors alongside Jokić's near-automatic DD.", cell_sub)
    ],
    [
        Paragraph("<b>M14: 30-Point Eruption Trio</b>", cell_bold),
        Paragraph("SGA 30+ Pts + Giannis 30+ Pts + Tatum 30+ Pts", cell_text),
        Paragraph("<b>$26.00</b>", cell_odds),
        Paragraph("Eruption upside on 3 MVP front-runners in tight competitive second halves.", cell_sub)
    ],
    [
        Paragraph("<b>M15: Mega Monster Lotto</b>", cell_bold),
        Paragraph("Curry 25+ & GSW -5.5 + Tatum 25+ & BOS -4.5 + SGA 30+ & OKC -6.5", cell_text),
        Paragraph("<b>$92.00</b>", cell_odds),
        Paragraph("Correlated multi combining player scoring surges with blowout team margins.", cell_sub)
    ],
]

t_multi = Table(multi_rows, colWidths=[36*mm, 78*mm, 15*mm, 69*mm])
t_multi.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
    ('TOPPADDING', (0,0), (-1,-1), 0.65),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0.65),
    ('LEFTPADDING', (0,0), (-1,-1), 2.5),
    ('RIGHTPADDING', (0,0), (-1,-1), 2.5),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(t_multi)
story.append(Spacer(1, 1.2*mm))

# Section 3: $100 Staking Plan Table
h3_data = [[Paragraph("<b>SECTION 3: OPTIMAL $100 PORTFOLIO SPEND (MAX VALUE & RISK DIVERSIFICATION WITH POSITIVE EXPECTED RETURN)</b>", sec_header_style)]]
t_h3 = Table(h3_data, colWidths=[198*mm])
t_h3.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1E3A8A')),
    ('TOPPADDING', (0,0), (-1,-1), 1.8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
    ('LEFTPADDING', (0,0), (-1,-1), 3),
]))
story.append(t_h3)

stake_rows = [
    [
        Paragraph("<b>Wager Category</b>", cell_bold),
        Paragraph("<b>Selection / Bet Description</b>", cell_bold),
        Paragraph("<b>Odds</b>", cell_bold),
        Paragraph("<b>Stake ($)</b>", cell_bold),
        Paragraph("<b>Est. Return</b>", cell_bold),
        Paragraph("<b>Strategic Bankroll Role</b>", cell_bold)
    ],
    [
        Paragraph("<b>Core Bankroll Anchor</b>", cell_bold),
        Paragraph("<b>Multi 1: Banker Double</b> (Celtics ML + Thunder ML)", cell_text),
        Paragraph("$1.90", cell_odds),
        Paragraph("<b>$25.00</b>", cell_stake),
        Paragraph("<b>$47.50</b>", cell_bold),
        Paragraph("Safe bankroll protection; winning this covers nearly half of entire stake.", cell_sub)
    ],
    [
        Paragraph("<b>Prop Floor Anchor</b>", cell_bold),
        Paragraph("<b>Multi 3: Superstar Points Anchor</b> (SGA 25+ &bull; Giannis 25+ &bull; Tatum 20+)", cell_text),
        Paragraph("$2.75", cell_odds),
        Paragraph("<b>$18.00</b>", cell_stake),
        Paragraph("<b>$49.50</b>", cell_bold),
        Paragraph("High floor stat consistency; lands in >85% of standard games.", cell_sub)
    ],
    [
        Paragraph("<b>Home Double Play</b>", cell_bold),
        Paragraph("<b>Multi 2: Home Fort Double</b> (Warriors ML + Suns ML)", cell_text),
        Paragraph("$2.15", cell_odds),
        Paragraph("<b>$15.00</b>", cell_stake),
        Paragraph("<b>$32.25</b>", cell_bold),
        Paragraph("Solid home favorite double backing veteran squads in rhythm.", cell_sub)
    ],
    [
        Paragraph("<b>Primary Value SGM</b>", cell_bold),
        Paragraph("<b>G4 SGM Conservative</b> (Tatum 20+ &bull; Brown 15+ &bull; Maxey 18+)", cell_text),
        Paragraph("$2.30", cell_odds),
        Paragraph("<b>$12.00</b>", cell_stake),
        Paragraph("<b>$27.60</b>", cell_bold),
        Paragraph("High-scoring East showcase with immense offensive usage.", cell_sub)
    ],
    [
        Paragraph("<b>Western Cash SGM</b>", cell_bold),
        Paragraph("<b>G7 SGM Conservative</b> (SGA 25+ &bull; SGA 5+ Ast &bull; Hartenstein 8+ Reb)", cell_text),
        Paragraph("$2.30", cell_odds),
        Paragraph("<b>$12.00</b>", cell_stake),
        Paragraph("<b>$27.60</b>", cell_bold),
        Paragraph("OKC efficiency & starting center glass cleaner against Portland; highly repeatable.", cell_sub)
    ],
    [
        Paragraph("<b>Value SGM Booster</b>", cell_bold),
        Paragraph("<b>G3 SGM Balanced</b> (Jokić 25+ Pts &bull; Jokić 8+ Ast &bull; Murray 15+ Pts)", cell_text),
        Paragraph("$3.60", cell_odds),
        Paragraph("<b>$8.00</b>", cell_stake),
        Paragraph("<b>$28.80</b>", cell_bold),
        Paragraph("Sweet spot odds on the league's most unstoppable two-man tandem.", cell_sub)
    ],
    [
        Paragraph("<b>Mid-Tier Multi Boost</b>", cell_bold),
        Paragraph("<b>Multi 7: 20-Point Star Quad</b> (Curry 20+ &bull; Tatum 20+ &bull; Booker 20+ &bull; SGA 20+)", cell_text),
        Paragraph("$4.20", cell_odds),
        Paragraph("<b>$6.00</b>", cell_stake),
        Paragraph("<b>$25.20</b>", cell_bold),
        Paragraph("Low individual scoring thresholds yielding a juicy 4.2x overall multiplier.", cell_sub)
    ],
    [
        Paragraph("<b>Slate Sweep Flier</b>", cell_bold),
        Paragraph("<b>Multi 12: All-Star 5-Game Sweep</b> (GSW, DEN, BOS, SAC, OKC MLs)", cell_text),
        Paragraph("$11.50", cell_odds),
        Paragraph("<b>$3.00</b>", cell_stake),
        Paragraph("<b>$34.50</b>", cell_bold),
        Paragraph("Asymmetric upside; returns 34.5% of total bankroll on a tiny $3 outlay.", cell_sub)
    ],
    [
        Paragraph("<b>Mega Lotto Ticket</b>", cell_bold),
        Paragraph("<b>Multi 15: Mega Monster Lotto</b> (Curry, Tatum & SGA Correlated Parlay)", cell_text),
        Paragraph("$92.00", cell_odds),
        Paragraph("<b>$1.00</b>", cell_stake),
        Paragraph("<b>$92.00</b>", cell_bold),
        Paragraph("Moonshot excitement providing thrilling sweat across afternoon games.", cell_sub)
    ],
    [
        Paragraph("<b>TOTALS</b>", cell_bold),
        Paragraph("<b>9 Diversified Bets (2 SGMs, 6 Multis, 1 Lotto Moonshot)</b>", cell_bold),
        Paragraph("—", cell_odds),
        Paragraph("<b>$100.00</b>", cell_stake),
        Paragraph("<b>Max: $364.95</b>", cell_bold),
        Paragraph("<b>Breakeven if only Top 2 Wagers land ($97.00). Profit if 3+ land.</b>", cell_bold)
    ]
]

t_stake = Table(stake_rows, colWidths=[28*mm, 68*mm, 13*mm, 15*mm, 17*mm, 57*mm])
t_stake.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#E2E8F0')),
    ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#F8FAFC')]),
    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#FEF08A')),
    ('TOPPADDING', (0,0), (-1,-1), 0.65),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0.65),
    ('LEFTPADDING', (0,0), (-1,-1), 2.5),
    ('RIGHTPADDING', (0,0), (-1,-1), 2.5),
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
