#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把拍摄策划 brief（JSON）渲染成排版完整的 Word 策划书。

用法：
    python tools/build_shoot_plan.py briefs/示例-秋冬人像样片.json -o "示例.docx"

设计约定：
  - A4，正文微软雅黑 10.5pt，标题黑色，表头深蓝底白字，边框统一浅灰。
  - 例图位、布光图位都是单元格高度固定的浅色空框，可在 Word 里直接粘贴图片。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_ROW_HEIGHT_RULE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

EA_FONT = "微软雅黑"
LATIN_FONT = "Segoe UI"

BLACK = RGBColor(0x00, 0x00, 0x00)
GRAY = RGBColor(0x59, 0x59, 0x59)
LIGHT_GRAY = RGBColor(0x8C, 0x8C, 0x8C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

BORDER_COLOR = "D9D9D9"
HEADER_FILL = "1F3864"
ZEBRA_FILL = "F2F5FA"
BOX_FILL = "FBFBFC"

CONTENT_WIDTH_CM = 15.8

TBLPR_ORDER = [
    "w:tblStyle", "w:tblpPr", "w:tblOverlap", "w:bidiVisual",
    "w:tblStyleRowBandSize", "w:tblStyleColBandSize", "w:tblW", "w:jc",
    "w:tblCellSpacing", "w:tblInd", "w:tblBorders", "w:shd", "w:tblLayout",
    "w:tblCellMar", "w:tblLook", "w:tblCaption", "w:tblDescription",
]

TCPR_ORDER = [
    "w:cnfStyle", "w:tcW", "w:gridSpan", "w:hMerge", "w:vMerge",
    "w:tcBorders", "w:shd", "w:noWrap", "w:tcMar", "w:textDirection",
    "w:tcFitText", "w:vAlign", "w:hideMark",
]

TRPR_ORDER = [
    "w:cnfStyle", "w:divId", "w:gridBefore", "w:gridAfter", "w:wBefore",
    "w:wAfter", "w:cantSplit", "w:trHeight", "w:tblHeader",
    "w:tblCellSpacing", "w:jc", "w:hidden",
]


# --------------------------------------------------------------------------
# 底层 OOXML 小工具
# --------------------------------------------------------------------------

def _local(element) -> str:
    return element.tag.split("}")[-1]


def insert_ordered(parent, element, order):
    """按 OOXML schema 顺序插入子元素，避免 Word 报错。"""
    key = "w:" + _local(element)
    if key not in order:
        parent.append(element)
        return element
    index = order.index(key)
    for child in parent:
        child_key = "w:" + _local(child)
        if child_key in order and order.index(child_key) > index:
            child.addprevious(element)
            return element
    parent.append(element)
    return element


def set_run_font(run, size=None, bold=None, italic=None, color=None):
    run.font.name = LATIN_FONT
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), LATIN_FONT)
    rfonts.set(qn("w:hAnsi"), LATIN_FONT)
    rfonts.set(qn("w:eastAsia"), EA_FONT)
    rfonts.set(qn("w:cs"), LATIN_FONT)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color
    return run


def add_para(doc, text="", size=10.5, bold=False, italic=False, color=BLACK,
             space_before=0, space_after=6, line=1.35, align=None,
             style=None, keep_with_next=False, keep_together=False):
    paragraph = doc.add_paragraph(style=style)
    if text:
        set_run_font(paragraph.add_run(text), size=size, bold=bold,
                     italic=italic, color=color)
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(space_before)
    fmt.space_after = Pt(space_after)
    fmt.line_spacing = line
    if align is not None:
        fmt.alignment = align
    fmt.keep_with_next = keep_with_next
    fmt.keep_together = keep_together
    return paragraph


def add_heading(doc, text, level):
    """用 Word 内置标题样式，保证导航窗格和后续目录可用，样式统一为黑色。"""
    style_name = {1: "Heading 1", 2: "Heading 2"}[level]
    paragraph = doc.add_paragraph(style=style_name)
    run = paragraph.add_run(text)
    sizes = {1: 15, 2: 11.5}
    set_run_font(run, size=sizes[level], bold=True, color=BLACK)
    fmt = paragraph.paragraph_format
    if level == 1:
        fmt.space_before = Pt(20)
        fmt.space_after = Pt(9)
    else:
        fmt.space_before = Pt(13)
        fmt.space_after = Pt(5)
    fmt.line_spacing = 1.2
    fmt.keep_with_next = True
    return paragraph


def shade_cell(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    insert_ordered(tcpr, shd, TCPR_ORDER)


def set_table_borders(table, color=BORDER_COLOR, size=6):
    tblpr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), str(size))
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)
        borders.append(element)
    insert_ordered(tblpr, borders, TBLPR_ORDER)


def set_cell_margins(table, top=70, start=110, bottom=70, end=110):
    tblpr = table._tbl.tblPr
    margins = OxmlElement("w:tblCellMar")
    for tag, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        element = OxmlElement(f"w:{tag}")
        element.set(qn("w:w"), str(value))
        element.set(qn("w:type"), "dxa")
        margins.append(element)
    insert_ordered(tblpr, margins, TBLPR_ORDER)


def set_fixed_layout(table):
    table.autofit = False
    tblpr = table._tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    insert_ordered(tblpr, layout, TBLPR_ORDER)


def mark_header_row(row):
    trpr = row._tr.get_or_add_trPr()
    insert_ordered(trpr, OxmlElement("w:tblHeader"), TRPR_ORDER)


def mark_cant_split(row):
    trpr = row._tr.get_or_add_trPr()
    insert_ordered(trpr, OxmlElement("w:cantSplit"), TRPR_ORDER)


def style_cell(cell, text, size=9.5, bold=False, color=BLACK,
               align=WD_ALIGN_PARAGRAPH.LEFT, italic=False, line=1.25):
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    paragraph = cell.paragraphs[0]
    paragraph.alignment = align
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(1)
    fmt.space_after = Pt(1)
    fmt.line_spacing = line
    if text:
        set_run_font(paragraph.add_run(text), size=size, bold=bold,
                     color=color, italic=italic)
    return paragraph


def add_rows(cell, lines, size=9.5, bold=False, color=BLACK, align=None,
             italic=False):
    """在一个单元格里写多行（第一行用已有段落）。"""
    first = True
    for line in lines:
        if first:
            paragraph = cell.paragraphs[0]
            first = False
        else:
            paragraph = cell.add_paragraph()
        paragraph.alignment = align if align is not None else WD_ALIGN_PARAGRAPH.LEFT
        fmt = paragraph.paragraph_format
        fmt.space_before = Pt(1)
        fmt.space_after = Pt(1)
        fmt.line_spacing = 1.25
        if line:
            set_run_font(paragraph.add_run(line), size=size, bold=bold,
                         color=color, italic=italic)


# --------------------------------------------------------------------------
# 文档级组件
# --------------------------------------------------------------------------

def setup_document(doc):
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.6)
    section.right_margin = Cm(2.6)

    normal = doc.styles["Normal"]
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = BLACK
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), LATIN_FONT)
    rfonts.set(qn("w:hAnsi"), LATIN_FONT)
    rfonts.set(qn("w:eastAsia"), EA_FONT)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.35

    for style_name, size in (("Title", 23), ("Heading 1", 15), ("Heading 2", 11.5)):
        style = doc.styles[style_name]
        style.font.name = LATIN_FONT
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = BLACK
        srpr = style.element.get_or_add_rPr()
        srfonts = srpr.find(qn("w:rFonts"))
        if srfonts is None:
            srfonts = OxmlElement("w:rFonts")
            srpr.insert(0, srfonts)
        srfonts.set(qn("w:ascii"), LATIN_FONT)
        srfonts.set(qn("w:hAnsi"), LATIN_FONT)
        srfonts.set(qn("w:eastAsia"), EA_FONT)

    # 内置标题样式自带下边框，文档标题下不要横线，这里从段落属性里删掉。
    for style_name in ("Title", "Heading 1", "Heading 2"):
        style = doc.styles[style_name]
        ppr = style.element.get_or_add_pPr()
        borders = ppr.find(qn("w:pBdr"))
        if borders is not None:
            ppr.remove(borders)


def add_data_table(doc, headers, rows, widths, aligns=None, size=9.5,
                   header_size=9.5, row_height_cm=0.9, zebra=True,
                   bold_last_row=False):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    set_fixed_layout(table)
    set_table_borders(table)
    set_cell_margins(table)

    header_row = table.rows[0]
    for index, text in enumerate(headers):
        cell = header_row.cells[index]
        shade_cell(cell, HEADER_FILL)
        style_cell(cell, text, size=header_size, bold=True, color=WHITE,
                   align=WD_ALIGN_PARAGRAPH.CENTER)
        for paragraph in cell.paragraphs:
            paragraph.paragraph_format.keep_with_next = True
    mark_header_row(header_row)
    mark_cant_split(header_row)

    for row_index, values in enumerate(rows):
        is_last = bold_last_row and row_index == len(rows) - 1
        row = table.add_row()
        row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        row.height = Cm(row_height_cm)
        mark_cant_split(row)
        for column_index, value in enumerate(values):
            cell = row.cells[column_index]
            if zebra and row_index % 2 == 1:
                shade_cell(cell, ZEBRA_FILL)
            align = WD_ALIGN_PARAGRAPH.LEFT
            if aligns and aligns[column_index] == "c":
                align = WD_ALIGN_PARAGRAPH.CENTER
            lines = value if isinstance(value, (list, tuple)) else [str(value)]
            style_cell(cell, "", size=size, align=align)
            anchor = cell.paragraphs[0]
            for line_index, line in enumerate(lines):
                paragraph = anchor if line_index == 0 else cell.add_paragraph()
                paragraph.alignment = align
                fmt = paragraph.paragraph_format
                fmt.space_before = Pt(1)
                fmt.space_after = Pt(1)
                fmt.line_spacing = 1.25
                if line:
                    set_run_font(paragraph.add_run(str(line)), size=size,
                                 bold=is_last)

    for row in table.rows:
        for index, width in enumerate(widths):
            row.cells[index].width = Cm(width)
    return table


def add_image_slots(doc, slots, height_cm=4.6):
    """一行若干等宽例图位，可直接在 Word 中点击粘贴图片。"""
    table = doc.add_table(rows=1, cols=len(slots))
    table.style = "Table Grid"
    set_fixed_layout(table)
    set_table_borders(table, color="C9CDD4")
    set_cell_margins(table, top=90, start=90, bottom=90, end=90)

    row = table.rows[0]
    row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    row.height = Cm(height_cm)
    mark_cant_split(row)

    width = (CONTENT_WIDTH_CM - 0.25 * (len(slots) - 1)) / len(slots)
    for index, label in enumerate(slots):
        cell = row.cells[index]
        shade_cell(cell, BOX_FILL)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        style_cell(cell, "", align=WD_ALIGN_PARAGRAPH.CENTER)
        add_rows(cell, label.split("\n"), size=9, color=LIGHT_GRAY,
                 align=WD_ALIGN_PARAGRAPH.CENTER)

    for cell in row.cells:
        cell.width = Cm(width)
    return table


def add_diagram_slot(doc, label, hint, height_cm=7.0):
    table = doc.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    set_fixed_layout(table)
    set_table_borders(table, color="C9CDD4")
    set_cell_margins(table, top=120, start=160, bottom=120, end=160)

    row = table.rows[0]
    row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    row.height = Cm(height_cm)
    mark_cant_split(row)

    cell = row.cells[0]
    shade_cell(cell, BOX_FILL)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    style_cell(cell, "", align=WD_ALIGN_PARAGRAPH.CENTER)
    add_rows(cell, [label, hint], size=9.5, color=LIGHT_GRAY,
             align=WD_ALIGN_PARAGRAPH.CENTER)
    cell.width = Cm(CONTENT_WIDTH_CM)
    return table


def add_caption(doc, text):
    return add_para(doc, text, size=8.5, color=GRAY, space_before=5,
                    space_after=6, line=1.2, keep_together=True)


# --------------------------------------------------------------------------
# 各章节
# --------------------------------------------------------------------------

def render_header_block(doc, brief):
    title = doc.add_paragraph(style="Title")
    set_run_font(title.add_run(brief["title"]), size=23, bold=True, color=BLACK)
    title.paragraph_format.space_after = Pt(6)
    title.paragraph_format.line_spacing = 1.15

    add_para(doc, brief.get("subtitle", ""), size=10.5, color=GRAY,
             space_after=14, line=1.3)


def render_overview(doc, brief):
    add_heading(doc, "1  项目概览", 1)
    pairs = brief["overview"]
    rows = []
    for index in range(0, len(pairs), 2):
        left = pairs[index]
        right = pairs[index + 1] if index + 1 < len(pairs) else ["", ""]
        rows.append([left[0], left[1], right[0], right[1]])
    add_data_table(
        doc,
        ["项目信息", "内容", "项目信息", "内容"],
        rows,
        [3.0, 4.9, 3.0, 4.9],
        aligns=["l", "l", "l", "l"],
        row_height_cm=0.85,
    )
    add_para(doc, brief["statement"], size=10.5, line=1.4, space_before=10,
             space_after=4)


def render_creative(doc, brief):
    creative = brief["creative"]
    add_heading(doc, "2  创意方向", 1)
    add_heading(doc, "2.1  目标人群与投放场景", 2)
    add_para(doc, creative["audience"], line=1.4)
    add_heading(doc, "2.2  画面基调", 2)
    add_para(doc, creative["tone"], line=1.4)
    add_heading(doc, "2.3  视觉参考", 2)
    add_para(doc, creative["reference_note"], line=1.4)
    add_image_slots(doc, creative["reference_slots"])
    add_caption(doc, "图 1  视觉参考图位（R1 / R2 / R3，可直接粘贴图片；拍摄清单的参考列对应此处编号）")


def render_shotlist(doc, brief):
    add_heading(doc, "3  拍摄清单", 1)
    add_para(doc, brief["shotlist"]["note"], line=1.4)
    add_data_table(
        doc,
        ["序号", "画面内容", "景别", "机位与角度", "人物 / 道具", "参考", "张数"],
        brief["shotlist"]["rows"],
        [1.2, 4.0, 1.5, 3.0, 3.0, 1.4, 1.2],
        aligns=["c", "l", "c", "l", "l", "c", "c"],
        row_height_cm=0.95,
    )
    add_caption(doc, "表 1  拍摄清单（按现场执行顺序排列，可据实际进度调整）")


def render_lighting(doc, brief):
    lighting = brief["lighting"]
    add_heading(doc, "4  布光方案", 1)
    add_heading(doc, "4.1  布光思路", 2)
    add_para(doc, lighting["approach"], line=1.4)
    add_heading(doc, "4.2  灯位清单", 2)
    add_data_table(
        doc,
        ["编号", "灯具", "功率", "附件", "位置", "作用"],
        lighting["units"],
        [1.3, 2.6, 1.6, 3.2, 4.1, 3.0],
        aligns=["c", "l", "c", "l", "l", "l"],
        row_height_cm=0.95,
    )
    add_heading(doc, "4.3  布光图", 2)
    add_para(doc, lighting["diagram_note"], line=1.4)
    add_diagram_slot(doc, lighting["diagram_label"], lighting["diagram_hint"])
    add_caption(doc, "图 2  布光图（俯视灯位图，建议宽度 15 cm，可直接粘贴图片）")


def render_locations(doc, brief):
    add_heading(doc, "5  场景与场地", 1)
    add_para(doc, brief["locations"]["note"], line=1.4)
    add_data_table(
        doc,
        ["场景", "位置", "计划时段", "光线条件", "备注"],
        brief["locations"]["rows"],
        [2.2, 3.4, 2.4, 3.4, 4.4],
        aligns=["l", "l", "c", "l", "l"],
        row_height_cm=0.95,
    )


def render_styling(doc, brief):
    add_heading(doc, "6  造型 服装 道具", 1)
    add_data_table(
        doc,
        ["品类", "内容", "数量", "准备人"],
        brief["styling"]["rows"],
        [2.4, 8.0, 2.2, 3.2],
        aligns=["l", "l", "c", "l"],
        row_height_cm=0.9,
    )


def render_schedule(doc, brief):
    add_heading(doc, "7  拍摄流程", 1)
    add_data_table(
        doc,
        ["时间", "环节", "内容", "负责人", "备注"],
        brief["schedule"]["rows"],
        [2.0, 2.4, 6.0, 2.2, 3.2],
        aligns=["c", "l", "l", "l", "l"],
        row_height_cm=0.9,
    )


def render_crew(doc, brief):
    add_heading(doc, "8  人员分工", 1)
    add_data_table(
        doc,
        ["角色", "姓名", "职责", "联系方式"],
        brief["crew"]["rows"],
        [2.6, 2.0, 7.4, 3.8],
        aligns=["l", "c", "l", "l"],
        row_height_cm=0.9,
    )


def render_gear(doc, brief):
    add_heading(doc, "9  器材清单", 1)
    add_data_table(
        doc,
        ["类别", "器材", "数量", "备注"],
        brief["gear"]["rows"],
        [2.4, 7.0, 1.8, 4.6],
        aligns=["l", "l", "c", "l"],
        row_height_cm=0.85,
    )


def render_delivery(doc, brief):
    delivery = brief["delivery"]
    add_heading(doc, "10  交付标准与后期", 1)
    add_para(doc, delivery["note"], line=1.4)
    add_data_table(
        doc,
        ["交付物", "规格", "数量", "交付时间"],
        delivery["rows"],
        [3.2, 5.6, 3.2, 3.8],
        aligns=["l", "l", "c", "c"],
        row_height_cm=0.9,
    )


def render_budget(doc, brief):
    budget = brief["budget"]
    add_heading(doc, "11  预算", 1)
    add_data_table(
        doc,
        ["费用项", "明细", "金额（元）"],
        budget["rows"],
        [4.4, 7.6, 3.8],
        aligns=["l", "l", "c"],
        row_height_cm=0.9,
        bold_last_row=True,
    )
    add_para(doc, budget["note"], size=9.5, color=GRAY, line=1.35)


def render_risks(doc, brief):
    add_heading(doc, "12  风险与预案", 1)
    add_data_table(
        doc,
        ["风险", "影响", "预案", "负责人"],
        brief["risks"]["rows"],
        [3.4, 3.4, 6.6, 2.4],
        aligns=["l", "l", "l", "l"],
        row_height_cm=0.95,
    )


def render_signoff(doc, brief):
    signoff = brief["signoff"]
    add_heading(doc, "13  确认与签署", 1)
    add_para(doc, signoff["note"], line=1.4)
    add_data_table(
        doc,
        ["确认事项", "内容"],
        signoff["rows"],
        [4.0, 11.8],
        aligns=["l", "l"],
        row_height_cm=1.4,
    )


# --------------------------------------------------------------------------
# 入口
# --------------------------------------------------------------------------

def build(brief: dict, output: Path):
    doc = Document()
    setup_document(doc)
    render_header_block(doc, brief)
    render_overview(doc, brief)
    render_creative(doc, brief)
    render_shotlist(doc, brief)
    render_lighting(doc, brief)
    render_locations(doc, brief)
    render_styling(doc, brief)
    render_schedule(doc, brief)
    render_crew(doc, brief)
    render_gear(doc, brief)
    render_delivery(doc, brief)
    render_budget(doc, brief)
    render_risks(doc, brief)
    render_signoff(doc, brief)
    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output))
    return output


def main(argv=None):
    parser = argparse.ArgumentParser(description="由 brief JSON 生成拍摄策划书 DOCX")
    parser.add_argument("brief", help="brief JSON 路径")
    parser.add_argument("-o", "--output", required=True, help="输出 DOCX 路径")
    args = parser.parse_args(argv)

    data = json.loads(Path(args.brief).read_text(encoding="utf-8"))
    path = build(data, Path(args.output))
    print(f"已生成：{path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
