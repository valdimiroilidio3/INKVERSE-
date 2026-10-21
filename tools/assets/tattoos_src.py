#!/usr/bin/env python3
"""INKVERSE original tattoo library — vector source generator.

Every design in this file is original artwork authored for INKVERSE®
(procedural vector composition). Output: assets/tattoos-src/<id>.svg
Rasterise with `node tools/assets/rasterize.mjs` (npm run assets:tattoos).

The artwork is intentionally black-ink on transparent so it can be composited
onto skin with a multiply blend in the 3D editor.
"""
from __future__ import annotations

import math
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "tattoos-src")
os.makedirs(OUT, exist_ok=True)

S = 1024
CX = CY = S / 2
INK = "#0b0b0b"


# --------------------------------------------------------------------- helpers
def svg(body: str, defs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">'
        f"<defs>{defs}</defs>{body}</svg>"
    )


def hatch_defs(name="hatch", size=10, width=2.6, angle=35, color=INK, opacity=1.0):
    return (
        f'<pattern id="{name}" width="{size}" height="{size}" patternUnits="userSpaceOnUse" '
        f'patternTransform="rotate({angle})"><line x1="0" y1="0" x2="0" y2="{size}" '
        f'stroke="{color}" stroke-width="{width}" opacity="{opacity}"/></pattern>'
    )


def stipple_defs(name="stipple", size=14, r=1.5, color=INK, density=1.0):
    dots = []
    rng = _Rng(7)
    n = max(1, int(6 * density))
    for _ in range(n):
        dots.append(f'<circle cx="{rng.next()*size:.2f}" cy="{rng.next()*size:.2f}" r="{r*0.55:.2f}"/>')
    return (
        f'<pattern id="{name}" width="{size}" height="{size}" patternUnits="userSpaceOnUse">'
        f'<g fill="{color}">{"".join(dots)}</g></pattern>'
    )


def dotring(cx, cy, r, count, dot=3.2, color=INK, jitter=0.0, seed=1, skip=0.0):
    out = []
    rng = _Rng(seed)
    for i in range(count):
        a = (i / count) * math.tau
        if skip and (i / count) < skip:
            continue
        rr = r + (rng.next() - 0.5) * 2 * jitter
        x = cx + math.cos(a) * rr
        y = cy + math.sin(a) * rr
        dr = dot * (0.65 + 0.7 * rng.next())
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{dr/2:.2f}" fill="{color}"/>')
    return "".join(out)


def rotate_about(x, y, cx, cy, angle):
    a = math.radians(angle)
    dx, dy = x - cx, y - cy
    return (cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a))


def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return (cx + math.cos(a) * r, cy + math.sin(a) * r)


def petal_path(cx, cy, r0, r1, half_angle, bulge=1.0, tip_round=0.55):
    """A petal from r0 to r1 around (cx, cy), centred on -90deg, mirrored to be used radially."""
    ax, ay = polar(cx, cy, r0, -90 - half_angle)
    bx, by = polar(cx, cy, r0, -90 + half_angle)
    tx, ty = polar(cx, cy, r1, -90)
    c1x, c1y = polar(cx, cy, (r0 + r1) * 0.55 * bulge, -90 - half_angle * 1.25)
    c2x, c2y = polar(cx, cy, (r0 + r1) * 0.55 * bulge, -90 + half_angle * 1.25)
    c3x, c3y = polar(cx, cy, r1 * 0.96, -90 - half_angle * tip_round)
    c4x, c4y = polar(cx, cy, r1 * 0.96, -90 + half_angle * tip_round)
    return (
        f"M{ax:.1f},{ay:.1f} C{c1x:.1f},{c1y:.1f} {c3x:.1f},{c3y:.1f} {tx:.1f},{ty:.1f} "
        f"C{c4x:.1f},{c4y:.1f} {c2x:.1f},{c2y:.1f} {bx:.1f},{by:.1f} Z"
    )


class _Rng:
    def __init__(self, seed=1):
        self.s = seed

    def next(self):
        self.s = (self.s * 1103515245 + 12345) & 0x7FFFFFFF
        return self.s / 0x7FFFFFFF


# ------------------------------------------------------------------ designs
def crane():
    """Tsuru — origami crane, faceted blackwork."""
    b = [f'<g stroke="{INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">']
    b.append('<path d="M512,470 L742,322 L690,560 Z" fill="#f7f3ea"/>')
    b.append('<path d="M512,470 L470,660 L604,700 L640,540 Z" fill="{INK}"/>')
    b.append('<path d="M512,470 L282,300 L330,560 Z" fill="{INK}"/>')
    b.append('<path d="M512,470 L330,560 L470,660 Z" fill="#f7f3ea"/>')
    b.append('<path d="M512,470 L604,700 L556,806 L500,700 Z" fill="#f7f3ea"/>')
    b.append('<path d="M500,700 L556,806 L430,844 Z" fill="{INK}"/>')
    b.append('<path d="M640,540 L828,612 L700,660 Z" fill="{INK}"/>')
    b.append('<path d="M330,560 L182,640 L300,690 Z" fill="#f7f3ea"/>')
    b.append('<path d="M430,844 L360,884 L438,900 Z" fill="{INK}"/>')
    b.append('</g>')
    b.append(f'<circle cx="512" cy="512" r="430" fill="none" stroke="{INK}" stroke-width="4"/>')
    b.append(dotring(512, 512, 386, 40, dot=4.4, jitter=2, seed=33))
    return svg("".join(b))

def hannya():
    """Hannya mask — Japanese theatre."""
    b = [f'<g fill="{INK}" stroke="{INK}" stroke-width="2">']
    # horns
    b.append('<path d="M358,300 C300,206 246,168 196,176 C238,214 268,268 300,330 Z"/>')
    b.append('<path d="M666,300 C724,206 778,168 828,176 C786,214 756,268 724,330 Z"/>')
    # face plate
    b.append('<path d="M512,196 C352,196 268,318 272,470 C276,626 366,796 512,852 '
             'C658,796 748,626 752,470 C756,318 672,196 512,196 Z"/>')
    b.append('</g>')
    # carved details in paper colour
    W = "#f7f3ea"
    b.append(f'<g fill="none" stroke="{W}" stroke-linecap="round" stroke-linejoin="round">')
    # brows
    b.append(f'<path d="M318,398 C382,362 448,372 486,414" stroke-width="13"/>')
    b.append(f'<path d="M706,398 C642,362 576,372 538,414" stroke-width="13"/>')
    # eyes (angry slits)
    b.append('<path d="M322,470 C384,428 448,440 486,492 C424,514 360,508 322,470 Z" fill="#f7f3ea" stroke="none"/>')
    b.append('<path d="M702,470 C640,428 576,440 538,492 C600,514 664,508 702,470 Z" fill="#f7f3ea" stroke="none"/>')
    b.append('<circle cx="404" cy="474" r="16" fill="#0b0b0b" stroke="none"/>')
    b.append('<circle cx="620" cy="474" r="16" fill="#0b0b0b" stroke="none"/>')
    # nose
    b.append('<path d="M512,470 C498,528 486,562 500,596 C516,614 540,610 552,592" stroke-width="9"/>')
    # mouth: snarling fangs
    b.append('<path d="M356,652 C420,612 468,626 512,646 C556,626 604,612 668,652 '
             'C632,742 570,782 512,782 C454,782 392,742 356,652 Z" fill="#f7f3ea" stroke="none"/>')
    for i in range(6):
        x = 380 + i * 50
        b.append(f'<path d="M{x},652 L{x+18},706 L{x+36},650" fill="#0b0b0b" stroke="none"/>')
    for i in range(5):
        x = 402 + i * 50
        b.append(f'<path d="M{x},742 L{x+16},700 L{x+32},742" fill="#0b0b0b" stroke="none"/>')
    # cheek scrolls
    b.append('<path d="M300,556 C268,600 268,652 296,690" stroke-width="7"/>')
    b.append('<path d="M724,556 C756,600 756,652 728,690" stroke-width="7"/>')
    b.append('</g>')
    return svg("".join(b))


def kiku_wave():
    """Chrysanthemum over an ornamental wave."""
    b = [f'<g stroke="{INK}" fill="none" stroke-linecap="round">']
    b.append('<path d="M92,806 C176,718 268,762 340,736 C412,710 432,624 512,624 '
             'C592,624 612,710 684,736 C756,762 848,718 932,806" stroke-width="9"/>')
    b.append('<path d="M124,852 C202,780 282,816 350,790 C422,762 446,690 512,690 '
             'C578,690 602,762 674,790 C742,816 822,780 900,852" stroke-width="5"/>')
    for x in (206, 326, 440, 584, 698, 818):
        b.append(f'<path d="M{x},768 C{x+20},742 {x+20},714 {x},692" stroke-width="3.4"/>')
    # three airy layers, each petal separated
    for count, half, l0, l1, offset, fill in [
        (14, 20, 432, 342, 0, INK),
        (11, 24, 306, 232, 9, "#f7f3ea"),
        (8, 30, 196, 140, 20, INK),
    ]:
        for i in range(count):
            ang = offset + i * (360.0 / count)
            b.append(f'<g transform="rotate({ang:.2f} {CX} {CY})">')
            b.append(f'<path d="{petal_path(CX, CY, l0, l1, half, 1.0, 0.36)}" fill="{fill}" stroke="{INK}" stroke-width="5"/>')
            b.append('</g>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="88" fill="{INK}" stroke="none"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="60" fill="#f7f3ea" stroke="none"/>')
    b.append(f'<g>{dotring(CX, CY, 38, 9, dot=12, color=INK, jitter=3, seed=3)}</g>')
    b.append('</g>')
    return svg("".join(b))

def dragon():
    """Dragon eye — macro study with scales and smoke."""
    b = [f'<g stroke="{INK}" fill="none" stroke-linecap="round" stroke-linejoin="round">']
    for row in range(6):
        for col in range(7):
            x = 160 + col * 128 + (row % 2) * 64
            y = 180 + row * 104
            dist = math.hypot(x - 512, y - 620)
            if dist < 320:
                continue
            b.append(f'<path d="M{x-56},{y} C{x-56},{y+62} {x+56},{y+62} {x+56},{y} '
                     f'C{x+26},{y-34} {x-26},{y-34} {x-56},{y} Z" stroke-width="4" opacity="0.75"/>')
    # brow
    b.append('<path d="M152,452 C300,296 724,296 872,452 C744,352 280,352 152,452 Z" fill="{INK}"/>')
    b.append('<path d="M176,516 C320,404 704,404 848,516" stroke-width="9"/>')
    b.append('<path d="M204,570 C340,478 684,478 820,570" stroke-width="5"/>')
    # eye
    b.append('<path d="M196,646 C330,500 694,500 828,646 C694,792 330,792 196,646 Z" fill="{INK}"/>')
    b.append('<path d="M232,646 C352,528 672,528 792,646 C672,764 352,764 232,646 Z" fill="#f7f3ea"/>')
    b.append('<circle cx="512" cy="646" r="142" fill="{INK}"/>')
    b.append('<circle cx="512" cy="646" r="118" fill="#f7f3ea"/>')
    b.append('<path d="M512,548 C550,600 554,692 512,744 C470,692 474,600 512,548 Z" fill="{INK}"/>')
    for i in range(30):
        a = i * 12
        x0, y0 = polar(512, 646, 74, a)
        x1, y1 = polar(512, 646, 112, a + 3)
        b.append(f'<path d="M{x0:.1f},{y0:.1f} L{x1:.1f},{y1:.1f}" stroke-width="2.6"/>')
    # smoke wisps
    b.append('<path d="M228,936 C268,864 214,812 262,748" stroke-width="5" opacity="0.8"/>')
    b.append('<path d="M796,936 C756,864 810,812 762,748" stroke-width="5" opacity="0.8"/>')
    b.append('</g>')
    return svg("".join(b))

def rose():
    """Rose noir — line-work rose with tonal hatching."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">']
    # outer petals as outlined shapes
    for i in range(8):
        ang = i * 45 + 4
        b.append(f'<g transform="rotate({ang} {CX} {CY})">')
        b.append(f'<path d="{petal_path(CX, CY, 214, 462, 24, 1.2, 0.42)}" fill="#f7f3ea"/>')
        b.append('</g>')
    # petal interiors: split arcs
    for i in range(8):
        ang = i * 45 + 4
        b.append(f'<g transform="rotate({ang} {CX} {CY})">')
        b.append(f'<path d="{petal_path(CX, CY, 246, 400, 14, 1.0, 0.4)}" stroke-width="3.4"/>')
        px, py = polar(CX, CY, 330, -90)
        b.append(f'<path d="M{CX},{CY} L{px:.1f},{py:.1f}" stroke-width="2" opacity="0.55"/>')
        b.append('</g>')
    # middle whorl
    for i in range(6):
        ang = i * 60 + 30
        b.append(f'<g transform="rotate({ang} {CX} {CY})">')
        b.append(f'<path d="{petal_path(CX, CY, 128, 282, 30, 1.14, 0.46)}" fill="{INK}" stroke="none"/>')
        b.append(f'<path d="{petal_path(CX, CY, 150, 244, 18, 1.0, 0.4)}" stroke="#f7f3ea" stroke-width="3.2"/>')
        b.append('</g>')
    # spiral heart
    b.append(f'<path d="M{CX},{CY-96} C{CX+42},{CY-70} {CX+84},{CY-18} {CX+66},{CY+40} '
             f'C{CX+50},{CY+92} {CX-40},{CY+104} {CX-68},{CY+56} '
             f'C{CX-96},{CY+8} {CX-40},{CY-40} {CX},{CY-22}" fill="{INK}" stroke="none"/>')
    b.append(f'<path d="M{CX},{CY-58} C{CX+26},{CY-36} {CX+40},{CY-4} {CX+26},{CY+30}" stroke="#f7f3ea" stroke-width="3"/>')
    b.append('</g>')
    # stems + calyx
    b.append(f'<g fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round">')
    b.append(f'<path d="M{CX-16},{CY+430} C{CX-60},{CY+520} {CX-40},610 {CX+10},660"/>')
    b.append(f'<path d="M{CX+16},{CY+430} C{CX+70},{CY+510} {CX+52},600 {CX+10},650"/>')
    for sgn in (1, -1):
        b.append(f'<path d="M{CX+sgn*18},{CY+418} L{CX+sgn*96},{CY+502} L{CX+sgn*24},{CY+470} Z" fill="{INK}"/>')
    b.append('</g>')
    # leaves with veins
    def leaf(x, y, rot, sc):
        return (f'<g transform="translate({x} {y}) rotate({rot}) scale({sc})">'
                f'<path d="M0,0 C52,-70 148,-78 204,-14 C148,54 54,60 0,0 Z" fill="#f7f3ea" stroke="{INK}" stroke-width="6"/>'
                f'<path d="M6,0 C68,4 146,2 196,-10" stroke="{INK}" stroke-width="3.2" fill="none"/>'
                f'<path d="M60,-10 L44,-52 M104,-12 L96,-58 M146,-14 L150,-56" stroke="{INK}" stroke-width="2.6"/>'
                f'</g>')
    b.append(leaf(560, 930, 14, 0.95))
    b.append(leaf(330, 980, 208, 0.8))
    b.append(leaf(640, 760, -38, 0.6))
    return svg("".join(b))

def eye_storm():
    """All-seeing eye with radiating rays and dotwork."""
    b = [f'<g stroke="{INK}" fill="none" stroke-linecap="round">']
    b.append(f'<circle cx="{CX}" cy="{CY}" r="436" stroke-width="3"/>')
    for i in range(72):
        a = i * 5
        r0 = 396 if i % 3 else 380
        r1 = 440 if i % 3 else 462
        x0, y0 = polar(CX, CY, r0, a)
        x1, y1 = polar(CX, CY, r1, a)
        b.append(f'<path d="M{x0:.1f},{y0:.1f} L{x1:.1f},{y1:.1f}" stroke-width="{3 if i%3 else 2}"/>')
    # eye outline
    b.append(f'<path d="M164,512 C280,362 744,362 860,512 C744,662 280,662 164,512 Z" fill="{INK}"/>')
    b.append(f'<path d="M186,512 C296,386 728,386 838,512 C728,638 296,638 186,512 Z" fill="#f7f3ea"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="132" fill="{INK}"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="106" fill="#f7f3ea"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="62" fill="{INK}"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="22" fill="#f7f3ea"/>')
    # iris striations
    for i in range(40):
        a = i * 9
        x0, y0 = polar(CX, CY, 66, a)
        x1, y1 = polar(CX, CY, 100, a + 4)
        b.append(f'<path d="M{x0:.1f},{y0:.1f} L{x1:.1f},{y1:.1f}" stroke="#f7f3ea" stroke-width="2.4"/>')
    # lid lines
    b.append(f'<path d="M164,512 C280,342 744,342 860,512" stroke-width="14"/>')
    b.append(f'<path d="M164,512 C280,682 744,682 860,512" stroke-width="10"/>')
    # tear dots
    for i in range(9):
        b.append(f'<circle cx="{CX-72+i*18}" cy="{700+abs(i-4)*7}" r="{4.5-abs(i-4)*0.5}" fill="{INK}" stroke="none"/>')
    b.append('</g>')
    return svg("".join(b), stipple_defs("t1", 16, 1.4))


def skull():
    """Memento skull study with dotwork shading."""
    b = [f'<g fill="{INK}">']
    b.append('<path d="M512,120 C330,120 246,258 252,428 C256,522 302,566 322,612 '
             'C338,650 330,700 356,730 L668,730 C694,700 686,650 702,612 '
             'C722,566 768,522 772,428 C778,258 694,120 512,120 Z"/>')
    # jaw
    b.append('<path d="M362,724 C368,806 424,868 512,868 C600,868 656,806 662,724 Z"/>')
    b.append('</g>')
    W = "#f7f3ea"
    b.append(f'<g fill="{W}">')
    # eye sockets
    b.append('<path d="M312,420 C334,346 448,338 476,414 C494,470 438,520 382,512 C336,506 306,470 312,420 Z"/>')
    b.append('<path d="M712,420 C690,346 576,338 548,414 C530,470 586,520 642,512 C688,506 718,470 712,420 Z"/>')
    # nose cavity
    b.append('<path d="M512,494 C484,540 470,594 500,612 C516,620 532,616 544,602 '
             'C558,586 546,534 512,494 Z"/>')
    b.append('</g>')
    # teeth
    b.append(f'<g stroke="{INK}" stroke-width="6">')
    for i in range(7):
        x = 380 + i * 44
        b.append(f'<path d="M{x},730 L{x},800"/>')
    b.append('</g>')
    b.append(f'<path d="M356,764 L668,764" stroke="{INK}" stroke-width="7"/>')
    # cheek cracks
    b.append(f'<g fill="none" stroke="{W}" stroke-width="5">')
    b.append('<path d="M292,560 C320,586 316,624 300,650"/>')
    b.append('<path d="M732,560 C704,586 708,624 724,650"/>')
    b.append('<path d="M468,206 C492,246 540,252 566,222"/>')
    b.append('</g>')
    # dotwork shading under the cranium
    b.append(f'<g fill="{INK}" opacity="0.9">{dotring(CX, 690, 240, 90, dot=5, jitter=40, seed=9, skip=0.72)}</g>')
    return svg("".join(b), stipple_defs("sk", 13, 1.2))


def orchid():
    """Fine-line orchid, single-weight line work."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">']
    # stem
    b.append('<path d="M512,930 C500,820 520,742 560,676 C596,616 604,548 578,486"/>')
    # leaves
    b.append('<path d="M516,806 C440,782 366,798 312,852 C388,862 462,846 516,806 Z" fill="#f7f3ea"/>')
    b.append('<path d="M536,720 C612,712 674,744 706,806 C632,806 566,778 536,720 Z" fill="#f7f3ea"/>')
    b.append('<path d="M556,648 C520,588 524,520 566,470 C592,528 592,596 556,648 Z" fill="#f7f3ea"/>')
    # petals
    petals = [
        (-90, 250, 330), (-150, 230, 300), (-30, 230, 300),
        (-185, 190, 250), (5, 190, 250),
        (-120, 150, 220), (-60, 150, 220),
    ]
    for deg, r0, r1 in petals:
        cxp, cyp = polar(CX, 486, 0, 0)
        ax, ay = polar(cxp, cyp, r0, deg - 22)
        bx, by = polar(cxp, cyp, r0, deg + 22)
        tx, ty = polar(cxp, cyp, r1, deg)
        c1 = polar(cxp, cyp, r0 + (r1 - r0) * 0.5, deg - 40)
        c2 = polar(cxp, cyp, r0 + (r1 - r0) * 0.5, deg + 40)
        b.append(f'<path d="M{ax:.1f},{ay:.1f} C{c1[0]:.1f},{c1[1]:.1f} {tx:.1f},{ty-10:.1f} {tx:.1f},{ty:.1f} '
                 f'C{tx:.1f},{ty+10:.1f} {c2[0]:.1f},{c2[1]:.1f} {bx:.1f},{by:.1f} Z" fill="#f7f3ea"/>')
        b.append(f'<path d="M{cxp:.1f},{cyp:.1f} L{tx:.1f},{ty:.1f}" stroke-width="2.4" opacity="0.7"/>')
    # labellum
    b.append(f'<path d="M{CX},{486} C{CX-70},{540} {CX-64},{620} {CX},{662} '
             f'C{CX+64},{620} {CX+70},{540} {CX},{486} Z" fill="{INK}"/>')
    b.append(f'<path d="M{CX},{520} C{CX-34},{560} {CX-30},{606} {CX},{628} '
             f'C{CX+30},{606} {CX+34},{560} {CX},{520} Z" fill="#f7f3ea"/>')
    # column
    b.append(f'<ellipse cx="{CX}" cy="474" rx="22" ry="34" fill="{INK}"/>')
    b.append('</g>')
    # dew dots
    b.append(dotring(650, 300, 90, 18, dot=4, jitter=26, seed=12))
    return svg("".join(b))


def moth():
    """Lunar moth — fine line with dotwork moon."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">']
    # moon
    b.append(f'<circle cx="{CX}" cy="330" r="250" stroke-width="3"/>')
    b.append(dotring(CX, 330, 290, 40, dot=4.4, jitter=6, seed=5))
    # wings
    b.append('<path d="M512,560 C420,404 268,382 172,472 C82,556 130,690 236,742 '
             'C344,794 454,700 512,560 Z" fill="#f7f3ea"/>')
    b.append('<path d="M512,560 C604,404 756,382 852,472 C942,556 894,690 788,742 '
             'C680,794 570,700 512,560 Z" fill="#f7f3ea"/>')
    # lower wings
    b.append('<path d="M512,600 C452,674 402,770 436,840 C486,874 534,828 548,754 Z" fill="#f7f3ea"/>')
    b.append('<path d="M512,600 C572,674 622,770 588,840 C538,874 490,828 476,754 Z" fill="#f7f3ea"/>')
    # body
    b.append(f'<path d="M512,470 C540,520 550,640 536,760 C526,830 498,830 488,760 '
             f'C474,640 484,520 512,470 Z" fill="{INK}"/>')
    # antennae
    b.append('<path d="M500,478 C450,404 386,376 336,382"/>')
    b.append('<path d="M524,478 C574,404 638,376 688,382"/>')
    b.append('<path d="M340,378 L330,362 M344,388 L330,392"/>')
    # wing veins + eyespots
    b.append('<path d="M512,560 C430,530 356,540 288,600" stroke-width="3"/>')
    b.append('<path d="M512,560 C594,530 668,540 736,600" stroke-width="3"/>')
    b.append('<path d="M512,566 C462,640 430,706 420,766" stroke-width="3"/>')
    b.append('<path d="M512,566 C562,640 594,706 604,766" stroke-width="3"/>')
    b.append('<circle cx="320" cy="552" r="46" fill="{INK}"/>')
    b.append('<circle cx="320" cy="552" r="24" fill="#f7f3ea"/>')
    b.append('<circle cx="704" cy="552" r="46" fill="{INK}"/>')
    b.append('<circle cx="704" cy="552" r="24" fill="#f7f3ea"/>')
    b.append('</g>')
    b.append(f'<g fill="{INK}">{dotring(CX, 330, 215, 60, dot=4, jitter=0, seed=8)}</g>')
    return svg("".join(b))


def heart():
    """Anatomical heart — fine line with hatching."""
    b = [f'<g fill="#f7f3ea" stroke="{INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">']
    b.append('<path d="M600,318 C676,330 736,392 744,472 C752,556 700,624 654,670 '
             'C606,718 590,782 528,796 C470,810 424,772 400,724 '
             'C376,676 322,652 296,596 C264,524 288,438 348,398 '
             'C404,360 478,372 512,412 C516,354 540,308 600,318 Z"/>')
    # pulmonary trunk
    b.append('<path d="M512,412 C494,332 496,268 540,222 C584,176 656,178 686,224" fill="none" stroke-width="46"/>')
    b.append('<path d="M512,412 C494,332 496,268 540,222 C584,176 656,178 686,224" fill="none" stroke="#f7f3ea" stroke-width="24"/>')
    # aortic arch
    b.append('<path d="M600,318 C632,258 692,236 740,268 C796,304 800,384 756,424" fill="none" stroke-width="38"/>')
    b.append('<path d="M600,318 C632,258 692,236 740,268 C796,304 800,384 756,424" fill="none" stroke="#f7f3ea" stroke-width="18"/>')
    # branches
    b.append('<path d="M548,232 C534,178 550,140 586,120" fill="none" stroke-width="24"/>')
    b.append('<path d="M616,214 C640,168 676,150 712,156" fill="none" stroke-width="18"/>')
    # vena cava
    b.append('<path d="M400,724 C376,786 390,842 436,876" fill="none" stroke-width="30"/>')
    b.append('<path d="M400,724 C376,786 390,842 436,876" fill="none" stroke="#f7f3ea" stroke-width="12"/>')
    # internal chamber lines
    b.append('<path d="M348,470 C404,440 470,452 500,498" fill="none" stroke-width="4"/>')
    b.append('<path d="M424,648 C472,610 540,602 590,638" fill="none" stroke-width="4"/>')
    b.append('<path d="M500,498 C540,540 556,606 528,660" fill="none" stroke-width="4"/>')
    b.append('<path d="M600,556 C640,570 664,602 666,642" fill="none" stroke-width="4"/>')
    b.append('</g>')
    b.append(f'<path d="M424,648 C472,610 540,602 590,638 C556,672 486,684 424,648 Z" fill="url(#h1)" opacity="0.75"/>')
    b.append(f'<path d="M348,470 C404,440 470,452 500,498 C452,516 386,510 348,470 Z" fill="url(#h1)" opacity="0.55"/>')
    return svg("".join(b), hatch_defs("h1", 8, 2.0, 42))

def monolith():
    """Blackwork abstraction — stacked mask forms."""
    b = []
    b.append(f'<g fill="{INK}">')
    b.append('<path d="M250,170 L774,170 L742,392 L282,392 Z"/>')
    b.append('<path d="M196,470 L828,470 L790,668 L234,668 Z"/>')
    b.append('<path d="M300,746 L724,746 L692,900 L332,900 Z"/>')
    b.append('</g>')
    W = "#f7f3ea"
    b.append(f'<g fill="{W}">')
    b.append('<path d="M318,232 L512,232 L512,330 L286,330 Z"/>')
    b.append('<path d="M546,232 L706,232 L738,330 L546,330 Z"/>')
    b.append('<circle cx="512" cy="566" r="64"/>')
    b.append('<path d="M262,614 L470,614 L470,632 L262,632 Z"/>')
    b.append('<path d="M554,614 L762,614 L762,632 L554,632 Z"/>')
    b.append('<path d="M356,806 L668,806 L668,826 L356,826 Z"/>')
    b.append('</g>')
    b.append(f'<g fill="none" stroke="{INK}" stroke-width="6">')
    b.append('<path d="M512,392 C600,440 640,520 640,610"/>')
    b.append('<path d="M512,668 C440,700 400,760 396,820"/>')
    b.append('</g>')
    b.append(dotring(512, 566, 180, 28, dot=5, jitter=30, seed=17))
    return svg("".join(b), stipple_defs("m1", 15, 1.3))


def ivy():
    """Botanical blackwork ivy, spiralling."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round">']
    b.append('<path d="M470,946 C540,830 496,748 556,652 C616,556 706,532 732,442 '
             'C758,352 700,278 626,268 C556,258 506,312 512,372"/>')
    def ivy_leaf(x, y, rot, sc):
        return (f'<g transform="translate({x} {y}) rotate({rot}) scale({sc})">'
                f'<path d="M0,0 C26,-30 34,-74 20,-108 L66,-88 C92,-120 138,-128 170,-104 '
                f'L198,-132 C222,-84 206,-26 158,0 L180,34 C140,58 82,48 52,16 L30,44 '
                f'C6,30 -4,14 0,0 Z" fill="{INK}" stroke="{INK}" stroke-width="3"/>'
                f'<path d="M4,2 C58,18 118,14 172,-8" stroke="#f7f3ea" stroke-width="5"/>'
                f'<path d="M64,-10 L50,-54 M112,-6 L120,-52 M150,-16 L172,-46" stroke="#f7f3ea" stroke-width="3.2"/>'
                f'</g>')
    for x, y, rot, sc in ((556, 762, -42, 0.95), (604, 646, 12, 0.82), (688, 546, -34, 0.9),
                          (726, 424, 48, 0.74), (640, 300, 148, 0.8), (520, 344, 196, 0.66)):
        b.append(ivy_leaf(x, y, rot, sc))
    # tendrils
    b.append('<path d="M566,720 C520,700 486,712 468,742" stroke-width="3.6"/>')
    b.append('<path d="M706,470 C748,486 772,518 776,552" stroke-width="3.6"/>')
    b.append('</g>')
    b.append(dotring(430, 860, 60, 12, dot=4, jitter=26, seed=9))
    return svg("".join(b))

def snake():
    """Serpent coil with dagger."""
    b = [f'<g stroke="{INK}" fill="none" stroke-linecap="round" stroke-linejoin="round">']
    # coil
    b.append('<path d="M512,900 C700,880 800,760 780,620 C760,480 640,430 520,450 '
             'C400,470 330,560 350,650 C370,740 470,770 560,740 C650,710 660,610 600,560" stroke-width="46"/>')
    b.append('<path d="M512,900 C700,880 800,760 780,620 C760,480 640,430 520,450 '
             'C400,470 330,560 350,650 C370,740 470,770 560,740 C650,710 660,610 600,560" stroke="#f7f3ea" stroke-width="22"/>')
    # head
    b.append(f'<path d="M600,560 C640,500 700,470 748,486 C800,502 812,566 776,600 '
             f'C744,630 676,624 640,596 Z" fill="{INK}"/>')
    b.append('<circle cx="722" cy="536" r="12" fill="#f7f3ea"/>')
    b.append('<circle cx="722" cy="536" r="5" fill="#0b0b0b"/>')
    b.append(f'<path d="M786,584 L838,600 M792,566 L846,566" stroke-width="5"/>')
    # tongue
    b.append(f'<path d="M744,606 C760,640 752,676 728,694 M728,694 L710,682 M728,694 L722,716" stroke-width="6"/>')
    # dagger
    b.append(f'<path d="M512,120 L556,206 L540,700 L484,700 L468,206 Z" fill="{INK}"/>')
    b.append(f'<path d="M512,158 L534,208 L524,660 L500,660 L490,208 Z" fill="#f7f3ea"/>')
    b.append(f'<path d="M400,700 L624,700 L604,742 L420,742 Z" fill="{INK}"/>')
    b.append(f'<circle cx="512" cy="820" r="46" fill="none" stroke-width="18"/>')
    b.append(f'<path d="M512,742 L512,774" stroke-width="18"/>')
    b.append('</g>')
    return svg("".join(b))


def polynesian():
    """Polynesian spearhead — symmetrical tribal composition."""
    b = [f'<g fill="{INK}">']
    # central spear
    b.append('<path d="M512,64 L588,236 L544,236 L544,524 L480,524 L480,236 L436,236 Z"/>')
    b.append('<path d="M512,960 L436,790 L480,790 L480,560 L544,560 L544,790 L588,790 Z"/>')
    # brow chevrons
    for i, y in enumerate((268, 348, 428)):
        w = 240 - i * 46
        b.append(f'<path d="M{512-w},{y} L512,{y+56} L{512+w},{y} L{512+w},{y+34} '
                 f'L512,{y+90} L{512-w},{y+34} Z"/>')
    for i, y in enumerate((756, 676, 596)):
        w = 240 - i * 46
        b.append(f'<path d="M{512-w},{y} L512,{y-56} L{512+w},{y} L{512+w},{y-34} '
                 f'L512,{y-90} L{512-w},{y-34} Z"/>')
    # hooks either side
    for sgn in (1, -1):
        b.append(f'<g transform="translate(512 512) scale({sgn} 1) translate(-512 -512)">'
                 '<path d="M512,300 C640,300 740,380 764,500 C790,626 726,744 620,790 '
                 'C654,712 660,620 626,540 C596,470 546,430 512,420 Z"/>'
                 '<path d="M512,724 C624,724 704,652 716,556 C730,452 680,370 616,330 '
                 'C664,398 674,470 650,530 C624,596 566,632 512,640 Z" fill="#f7f3ea"/>'
                 '<path d="M512,640 C566,632 624,596 650,530 C674,470 664,398 616,330 '
                 'C596,386 596,430 610,470 C632,530 600,590 512,610 Z"/>'
                 '</g>')
    b.append('</g>')
    b.append(dotring(512, 512, 60, 10, dot=9, jitter=0, seed=21))
    return svg("".join(b))


def knot():
    """Norse interlace — triquetra knot with over/under breaks."""
    b = [f'<g fill="none" stroke="{INK}" stroke-linecap="round" stroke-linejoin="round">']
    R = 300
    centers = [polar(CX, CY, 96, -90), polar(CX, CY, 96, 30), polar(CX, CY, 96, 150)]
    for i, (cx, cy) in enumerate(centers):
        # each arc is drawn as a full circle minus a gap where it passes under
        b.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{R}" stroke-width="34"/>')
        b.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{R}" stroke="#f7f3ea" stroke-width="14"/>')
    # over-under gaps: mask small paper wedges at the crossings
    for i in range(3):
        a = polar(CX, CY, 96 + R, -90 + i * 120 + 60)
        b.append(f'<circle cx="{a[0]:.1f}" cy="{a[1]:.1f}" r="26" fill="#f7f3ea" stroke="none"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="66" stroke-width="9"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="30" fill="{INK}"/>')
    b.append('</g>')
    b.append(dotring(CX, CY, 430, 48, dot=4.4, jitter=5, seed=88))
    return svg("".join(b))

def mandala():
    """Sacred grid — dotwork mandala."""
    b = [f'<g fill="none" stroke="{INK}" stroke-linecap="round">']
    b.append(f'<circle cx="{CX}" cy="{CY}" r="430" stroke-width="4"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="404" stroke-width="2"/>')
    # outer ring of arches
    for i in range(24):
        a = i * 15
        x, y = polar(CX, CY, 372, a)
        b.append(f'<g transform="rotate({a} {x:.2f} {y:.2f})">'
                 f'<path d="M{x-34:.2f},{y+40} L{x-34:.2f},{y} C{x-34:.2f},{y-34} {x+34:.2f},{y-34} {x+34:.2f},{y} L{x+34:.2f},{y+40} Z" stroke-width="6"/></g>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="300" stroke-width="5"/>')
    # petals
    for i in range(16):
        a = i * 22.5
        b.append(f'<g transform="rotate({a} {CX} {CY})">')
        b.append(f'<path d="{petal_path(CX, CY, 150, 296, 10, 1.06, 0.42)}" fill="{INK}" stroke="none"/>')
        b.append(f'<path d="{petal_path(CX, CY, 158, 246, 5.5, 1.0, 0.4)}" stroke="#f7f3ea" stroke-width="3"/>')
        b.append('</g>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="150" stroke-width="5"/>')
    # inner star
    for i in range(8):
        a = i * 45
        b.append(f'<g transform="rotate({a} {CX} {CY})">'
                 f'<path d="M512,370 L556,466 L512,512 L468,466 Z" fill="{INK}" stroke="none"/></g>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="96" stroke-width="6"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="30" fill="{INK}" stroke="none"/>')
    b.append('</g>')
    b.append(dotring(CX, CY, 340, 48, dot=5, seed=31))
    b.append(dotring(CX, CY, 122, 24, dot=6, seed=32))
    return svg("".join(b))


def orbit():
    """Geometric orbit delta."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="6" stroke-linejoin="round">']
    b.append(f'<circle cx="{CX}" cy="{CY}" r="330"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="196"/>')
    # triangle
    pts = [polar(CX, CY, 330, -90), polar(CX, CY, 330, 30), polar(CX, CY, 330, 150)]
    b.append('<path d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z" fill="%s"/>' % (pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], INK))
    inner = [polar(CX, CY, 196, -90), polar(CX, CY, 196, 30), polar(CX, CY, 196, 150)]
    b.append('<path d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z" fill="#f7f3ea"/>' % (inner[0][0], inner[0][1], inner[1][0], inner[1][1], inner[2][0], inner[2][1]))
    # axes
    for i in range(6):
        a = -90 + i * 60
        x, y = polar(CX, CY, 330, a)
        b.append(f'<path d="M512,512 L{x:.1f},{y:.1f}" stroke-width="3"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="64" fill="{INK}"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="26" fill="#f7f3ea"/>')
    b.append('</g>')
    # orbital satellites
    for r, a, size in ((330, 12, 16), (330, 132, 12), (396, 62, 9), (420, 210, 14)):
        x, y = polar(CX, CY, r, a)
        b.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{size}" fill="{INK}"/>')
    b.append(f'<g fill="{INK}">{dotring(CX, CY, 262, 36, dot=4, seed=44)}</g>')
    return svg("".join(b))


def swallow():
    """Traditional swallow with banner (red accent)."""
    RED = "#c0392b"
    b = []
    b.append(f'<g fill="{INK}" stroke="{INK}" stroke-width="4" stroke-linejoin="round">')
    # wings
    b.append('<path d="M512,470 C420,376 286,352 176,398 C276,428 354,486 402,566 Z"/>')
    b.append('<path d="M512,470 C604,376 738,352 848,398 C748,428 670,486 622,566 Z"/>')
    # body
    b.append('<path d="M512,382 C566,382 604,432 604,494 C604,566 556,626 512,656 '
             'C468,626 420,566 420,494 C420,432 458,382 512,382 Z"/>')
    # head
    b.append('<circle cx="512" cy="378" r="52"/>')
    # tail
    b.append('<path d="M512,656 C470,724 402,780 316,802 C372,738 402,688 416,640 Z"/>')
    b.append('<path d="M512,656 C554,724 622,780 708,802 C652,738 622,688 608,640 Z"/>')
    b.append('</g>')
    W = "#f7f3ea"
    b.append(f'<g fill="{W}">')
    b.append('<path d="M240,412 C330,432 392,478 432,540 L388,552 C350,494 300,448 240,412 Z"/>')
    b.append('<path d="M784,412 C694,432 632,478 592,540 L636,552 C674,494 724,448 784,412 Z"/>')
    b.append('<path d="M474,400 C496,424 528,424 550,400 C534,376 490,376 474,400 Z"/>')
    b.append('<circle cx="512" cy="446" r="10"/>')
    b.append('<path d="M512,486 C532,506 532,540 512,560 C492,540 492,506 512,486 Z"/>')
    b.append('</g>')
    # red banner
    b.append(f'<g><path d="M336,880 C420,846 604,846 688,880 L664,942 C596,914 428,914 360,942 Z" fill="{RED}"/>'
             f'<path d="M336,880 C420,846 604,846 688,880 L664,942 C596,914 428,914 360,942 Z" fill="none" stroke="{INK}" stroke-width="7"/></g>')
    b.append(f'<g fill="{INK}" font-family="DejaVu Serif, serif" font-size="46" text-anchor="middle">'
             f'<text x="512" y="922" letter-spacing="8">COURAGE</text></g>')
    return svg("".join(b))


def anchor():
    """Traditional anchor with rope."""
    b = [f'<g fill="none" stroke="{INK}" stroke-linecap="round" stroke-linejoin="round">']
    b.append('<path d="M512,168 L512,800" stroke-width="26"/>')
    b.append('<circle cx="512" cy="168" r="62" stroke-width="22"/>')
    b.append('<circle cx="512" cy="168" r="20" fill="#0b0b0b" stroke="none"/>')
    b.append('<path d="M362,300 L662,300" stroke-width="24"/>')
    b.append('<path d="M300,560 C300,724 396,828 512,844 C628,828 724,724 724,560" stroke-width="26"/>')
    b.append('<path d="M512,844 L512,884" stroke-width="22"/>')
    # flukes
    b.append('<path d="M300,560 C258,536 220,548 200,578 C246,590 280,584 300,560 Z" fill="#0b0b0b"/>')
    b.append('<path d="M724,560 C766,536 804,548 824,578 C778,590 744,584 724,560 Z" fill="#0b0b0b"/>')
    # rope
    b.append('<path d="M512,196 C420,214 372,286 404,354 C436,422 520,416 542,462 '
             'C564,508 486,540 450,590 C414,640 452,712 512,724" stroke-width="9"/>')
    b.append('<path d="M512,724 C572,712 610,640 574,590 C538,540 460,508 482,462 '
             'C504,416 588,422 620,354 C652,286 604,214 512,196" stroke-width="9"/>')
    b.append('</g>')
    b.append(dotring(512, 300, 200, 30, dot=4, jitter=0, seed=51, skip=0.55))
    return svg("".join(b))


def inkflow():
    """Sumi-e ink flow."""
    b = [f'<g fill="{INK}">']
    b.append('<path d="M164,700 C220,560 320,470 424,430 C360,530 330,650 348,780 '
             'C300,812 232,800 164,700 Z"/>')
    b.append('<path d="M424,430 C540,380 660,406 748,494 C700,494 648,516 612,552 '
             'C560,498 492,452 424,430 Z"/>')
    b.append('<path d="M612,552 C664,612 690,700 676,792 C630,742 590,662 560,600 Z"/>')
    b.append('<path d="M348,780 C440,830 566,842 668,808 C612,878 496,900 404,862 Z"/>')
    b.append('<path d="M424,430 C444,340 512,266 610,238 C574,310 560,372 566,438 Z"/>')
    b.append('</g>')
    # splatter
    rng = _Rng(77)
    for _ in range(40):
        x = 200 + rng.next() * 640
        y = 160 + rng.next() * 700
        r = 2 + rng.next() ** 3 * 26
        b.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{INK}" opacity="{0.35+rng.next()*0.6:.2f}"/>')
    # flow lines
    b.append(f'<g fill="none" stroke="{INK}" stroke-width="3" opacity="0.85">')
    for i in range(7):
        y = 250 + i * 84
        b.append(f'<path d="M120,{y} C300,{y-40} 460,{y+50} 640,{y-10} C760,{y-50} 848,{y+20} 904,{y-4}"/>')
    b.append('</g>')
    return svg("".join(b))


def erosion():
    """Topographic erosion — abstract contour field."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round">']
    rng = _Rng(101)
    for i in range(18):
        y0 = 120 + i * 46
        amp = 90 + 30 * math.sin(i * 0.9)
        d = f"M80,{y0} "
        for k in range(1, 15):
            x = 80 + k * 64
            y = y0 + math.sin(k * 0.7 + i * 0.5) * amp * 0.22 + (rng.next() - 0.5) * 14
            px = x - 32
            py = y0 + math.sin((k - 1) * 0.7 + i * 0.5) * amp * 0.22
            d += f"Q{px},{py} {x},{y:.1f} "
        b.append(f'<path d="{d}" stroke-width="{2.5 + (i % 4)}"/>')
    b.append('</g>')
    for i in range(9):
        r = 60 + i * 42
        b.append(f'<ellipse cx="512" cy="520" rx="{r*1.24:.0f}" ry="{r*0.68:.0f}" fill="none" stroke="{INK}" stroke-width="3"/>')
    b.append(dotring(512, 520, 120, 26, dot=5, jitter=8, seed=61))
    return svg("".join(b))


def memento():
    """Lettering — MEMENTO, serif, fine rule."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="4">'
         f'<path d="M160,742 L864,742"/><path d="M160,764 L864,764" stroke-width="1.6"/></g>']
    b.append(f'<g fill="{INK}" font-family="DejaVu Serif, serif" font-size="140" text-anchor="middle" letter-spacing="6">'
             f'<text x="512" y="546">MEMENTO</text></g>')
    b.append(f'<g fill="{INK}" font-family="DejaVu Serif, serif" font-size="58" text-anchor="middle" letter-spacing="26">'
             f'<text x="512" y="676">MORI</text></g>')
    b.append(dotring(512, 300, 190, 28, dot=4, jitter=4, seed=71, skip=0.5))
    return svg("".join(b))


def vincit():
    """Lettering — VINCIT AMOR in a thin rule frame."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="3">'
         f'<rect x="132" y="238" width="760" height="548"/>'
         f'<rect x="150" y="256" width="724" height="512" stroke-width="1.2"/></g>']
    b.append(f'<g fill="{INK}" font-family="DejaVu Serif, serif" font-size="132" text-anchor="middle" letter-spacing="14">'
             f'<text x="512" y="470">VINCIT</text>'
             f'<text x="512" y="626">AMOR</text></g>')
    b.append(f'<g fill="none" stroke="{INK}" stroke-width="3">'
             f'<path d="M356,520 L668,520"/><circle cx="512" cy="520" r="12" fill="{INK}"/></g>')
    return svg("".join(b))


def sunmoon():
    """Minimal sun / moon composition."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round">']
    b.append(f'<circle cx="380" cy="512" r="176"/>')
    for i in range(12):
        a = i * 30
        x0, y0 = polar(380, 512, 210, a)
        x1, y1 = polar(380, 512, 268 if i % 2 == 0 else 240, a)
        b.append(f'<path d="M{x0:.1f},{y0:.1f} L{x1:.1f},{y1:.1f}"/>')
    # crescent
    b.append('<path d="M700,318 C604,360 560,438 560,520 C560,602 604,680 700,722 '
             'C624,740 552,700 516,628 C480,556 486,470 530,410 C572,352 638,314 700,318 Z" fill="{INK}" stroke="none"/>')
    b.append('</g>')
    b.append(dotring(380, 512, 128, 20, dot=6, jitter=0, seed=81))
    return svg("".join(b))


def dotarc():
    """Minimal dotwork arc."""
    b = []
    cx, cy, r = 512, 700, 360
    for i in range(26):
        a = 180 + i * (180 / 25)
        x, y = polar(cx, cy, r, a)
        rad = 3 + 16 * math.sin((i / 25) * math.pi) ** 2
        b.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad:.1f}" fill="{INK}"/>')
    b.append(f'<path d="M152,700 L872,700" stroke="{INK}" stroke-width="4"/>')
    b.append(f'<g fill="{INK}" font-family="DejaVu Serif, serif" font-size="34" letter-spacing="14" text-anchor="middle">'
             f'<text x="512" y="770">STILL HERE</text></g>')
    b.append(dotring(512, 380, 120, 22, dot=5, jitter=0, seed=91, skip=0.7))
    return svg("".join(b))


def peony():
    """Japanese peony with leaves."""
    b = []
    for x, y, rot, sc in ((252, 812, -34, 0.95), (776, 780, 208, 0.9), (700, 262, -128, 0.62), (318, 250, 52, 0.6)):
        b.append(f'<g transform="translate({x} {y}) rotate({rot}) scale({sc})">'
                 f'<path d="M0,0 C70,-92 200,-100 262,-16 C204,72 78,80 0,0 Z" fill="{INK}"/>'
                 f'<path d="M8,0 C84,-24 176,-30 244,-6" stroke="#f7f3ea" stroke-width="6" fill="none"/>'
                 f'<path d="M96,-32 L78,-94 M154,-34 L160,-102" stroke="#f7f3ea" stroke-width="4" fill="none"/>'
                 f'</g>')
    for i in range(8):
        ang = i * 45 + 10
        b.append(f'<g transform="rotate({ang} 512 512)">'
                 f'<path d="{petal_path(512, 512, 268, 452, 22, 1.16, 0.5)}" fill="{INK}" stroke="{INK}" stroke-width="4"/></g>')
    for i in range(8):
        ang = i * 45 + 32
        b.append(f'<g transform="rotate({ang} 512 512)">'
                 f'<path d="{petal_path(512, 512, 200, 340, 24, 1.1, 0.46)}" fill="#f7f3ea" stroke="{INK}" stroke-width="6"/></g>')
    for i in range(6):
        ang = i * 60 + 6
        b.append(f'<g transform="rotate({ang} 512 512)">'
                 f'<path d="{petal_path(512, 512, 128, 246, 30, 1.12, 0.5)}" fill="{INK}"/></g>')
    for i in range(5):
        ang = i * 72 + 36
        b.append(f'<g transform="rotate({ang} 512 512)">'
                 f'<path d="{petal_path(512, 512, 62, 160, 36, 1.1, 0.5)}" fill="#f7f3ea" stroke="{INK}" stroke-width="5"/></g>')
    b.append(f'<circle cx="512" cy="512" r="34" fill="{INK}"/>')
    b.append(dotring(512, 512, 22, 8, dot=9, seed=55))
    return svg("".join(b))

def compass():
    """Geometric compass rose."""
    b = [f'<g fill="none" stroke="{INK}" stroke-width="5">']
    for r, w in ((430, 4), (392, 2), (300, 3), (196, 3), (86, 4)):
        b.append(f'<circle cx="{CX}" cy="{CY}" r="{r}" stroke-width="{w}"/>')
    # eight points
    for i in range(8):
        a = i * 45
        long = 372 if i % 2 == 0 else 250
        x, y = polar(CX, CY, long, a - 90)
        lx, ly = polar(CX, CY, 62, a - 90 + 82)
        rx, ry = polar(CX, CY, 62, a - 90 - 82)
        b.append(f'<path d="M{x:.1f},{y:.1f} L{lx:.1f},{ly:.1f} L512,512 L{rx:.1f},{ry:.1f} Z" fill="{INK}"/>')
    b.append(f'<circle cx="{CX}" cy="{CY}" r="30" fill="#f7f3ea"/>')
    b.append('</g>')
    # ticks
    for i in range(60):
        a = i * 6
        r0 = 404 if i % 5 == 0 else 412
        x0, y0 = polar(CX, CY, r0, a)
        x1, y1 = polar(CX, CY, 430, a)
        b.append(f'<path d="M{x0:.1f},{y0:.1f} L{x1:.1f},{y1:.1f}" stroke="{INK}" stroke-width="{3 if i%5==0 else 1.6}"/>')
    b.append(dotring(CX, CY, 330, 32, dot=4, seed=66))
    return svg("".join(b))


def lotus():
    """Blackwork lotus, symmetrical."""
    b = [f'<g stroke="{INK}" stroke-linejoin="round" stroke-linecap="round">']
    def petal(base_y, w, h, rot, fill=INK, sw=6):
        return (f'<g transform="rotate({rot} 512 {base_y})">'
                f'<path d="M512,{base_y-h} C{512+w},{base_y-h*0.34} {512+w*0.9},{base_y+h*0.16} 512,{base_y+h*0.3} '
                f'C{512-w*0.9},{base_y+h*0.16} {512-w},{base_y-h*0.34} 512,{base_y-h} Z" '
                f'fill="{fill}" stroke="{INK}" stroke-width="{sw}"/></g>')
    b.append(petal(686, 172, 420, 0, INK))
    for sgn in (1, -1):
        b.append(petal(700, 152, 356, sgn * 28, "#f7f3ea"))
        b.append(petal(714, 150, 292, sgn * 58, INK))
        b.append(petal(736, 140, 224, sgn * 86, "#f7f3ea"))
    b.append(petal(700, 92, 320, 0, "#f7f3ea"))
    b.append(petal(700, 58, 244, 0, INK))
    # base leaves / water
    b.append(f'<path d="M196,742 C296,808 728,808 828,742 C760,846 264,846 196,742 Z" fill="{INK}"/>')
    b.append(f'<path d="M168,808 C286,884 738,884 856,808" fill="none" stroke-width="7"/>')
    b.append(f'<path d="M256,856 C360,908 664,908 768,856" fill="none" stroke-width="4"/>')
    b.append('</g>')
    b.append(dotring(512, 884, 120, 16, dot=5, jitter=0, seed=71, skip=0.62))
    return svg("".join(b))


DESIGNS = {
    "crane-tsuru": crane,
    "hannya-vigil": hannya,
    "kiku-wave": kiku_wave,
    "dragon-serpent": dragon,
    "rose-noir": rose,
    "eye-of-storm": eye_storm,
    "skull-memento": skull,
    "orchid-line": orchid,
    "lunar-moth": moth,
    "heart-anatomy": heart,
    "monolith": monolith,
    "ivy-rite": ivy,
    "serpent-coil": snake,
    "polynesian-spear": polynesian,
    "norse-knot": knot,
    "sacred-grid": mandala,
    "orbit-delta": orbit,
    "swallow-courage": swallow,
    "anchor-tide": anchor,
    "ink-flow": inkflow,
    "erosion": erosion,
    "memento-mori": memento,
    "vincit-amor": vincit,
    "sun-moon": sunmoon,
    "dot-arc": dotarc,
    "peony-veil": peony,
    "compass-rose": compass,
    "lotus-black": lotus,
}


def main():
    for name, fn in DESIGNS.items():
        path = os.path.abspath(os.path.join(OUT, f"{name}.svg"))
        with open(path, "w") as fh:
            fh.write(fn())
        print("wrote", os.path.relpath(path, os.path.abspath(OUT)))
    print(f"{len(DESIGNS)} designs")


if __name__ == "__main__":
    main()
