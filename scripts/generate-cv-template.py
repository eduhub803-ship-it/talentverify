"""Generate the official TalentVerify ATS-friendly candidate CV template.

Builds public/templates/talentverify-cv-template.docx from scratch so the
document is guaranteed to contain no tables, text boxes, images, headers,
footers, columns or decorative shapes -- only single-column, selectable text.

Usage: python scripts/generate-cv-template.py
"""

import os
import zipfile
from xml.sax.saxutils import escape

OUT = os.path.join("public", "templates", "talentverify-cv-template.docx")

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
</Relationships>"""

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>TalentVerify ATS-Friendly CV Template</dc:title>
<dc:creator>TalentVerify</dc:creator>
<cp:lastModifiedBy>TalentVerify</cp:lastModifiedBy>
<dc:language>en-US</dc:language>
</cp:coreProperties>"""

APP = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>TalentVerify</Application>
<Company>TalentVerify</Company>
</Properties>"""

SETTINGS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:defaultTabStop w:val="720"/>
<w:themeFontLang w:val="en-US"/>
</w:settings>"""

FONT_TABLE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:font w:name="Calibri"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>
<w:font w:name="Arial"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>
</w:fonts>"""

# Single bullet list definition: one plain round bullet, no multi-level scheme.
NUMBERING = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0">
<w:multiLevelType w:val="singleLevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="&#8226;"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:hint="default"/></w:rPr>
</w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
<w:color w:val="000000"/>
<w:sz w:val="22"/><w:szCs w:val="22"/>
<w:lang w:val="en-US"/>
</w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr>
<w:spacing w:after="80" w:line="276" w:lineRule="auto"/>
</w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
<w:name w:val="Normal"/><w:qFormat/>
</w:style>
<w:style w:type="paragraph" w:styleId="Title">
<w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:after="40"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading1">
<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="280" w:after="80"/>
<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>
<w:outlineLvl w:val="0"/></w:pPr>
<w:rPr><w:b/><w:caps/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading2">
<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="160" w:after="0"/><w:outlineLvl w:val="1"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph">
<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:after="0"/><w:ind w:left="360" w:hanging="360"/><w:contextualSpacing/></w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Guidance">
<w:name w:val="Guidance"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:after="0"/><w:ind w:left="360" w:hanging="360"/><w:contextualSpacing/></w:pPr>
<w:rPr><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
</w:style>
</w:styles>"""


def run(text, bold=False, italic=False):
    props = ""
    if bold:
        props += "<w:b/>"
    if italic:
        props += "<w:i/>"
    props = "<w:rPr>" + props + "</w:rPr>" if props else ""
    return props + '<w:t xml:space="preserve">' + escape(text) + "</w:t>"


def para(text="", style=None, bold=False, italic=False, bullet=False, after=None):
    props = ""
    if style:
        props += '<w:pStyle w:val="' + style + '"/>'
    if bullet:
        props += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
    if after is not None:
        props += '<w:spacing w:after="' + str(after) + '"/>'
    props = "<w:pPr>" + props + "</w:pPr>" if props else ""
    body = "<w:r>" + run(text, bold, italic) + "</w:r>" if text else ""
    return "<w:p>" + props + body + "</w:p>"


def guidance_bullet(text):
    return para(text, style="Guidance", italic=True, bullet=True)


def build_body():
    p = []

    # Removable guidance block -- candidates delete it before submitting.
    p.append(
        para(
            "HOW TO USE THIS TEMPLATE (delete this section before submitting)",
            bold=True,
            italic=True,
        )
    )
    for line in [
        "Replace every placeholder in [brackets] with your own details, then delete this section.",
        "Tailor your Professional Summary to the target job.",
        "Use keywords from the job description where they truthfully match your background.",
        "Focus experience bullets on measurable achievements.",
        "Avoid graphics, icons, photos, tables and multi-column layouts.",
        "Keep the final CV to 1-2 pages depending on your experience.",
        "Delete any section you do not need, including Projects / Volunteering.",
        "Save and submit as PDF unless the employer requests DOCX.",
    ]:
        p.append(guidance_bullet(line))
    p.append(
        para(
            "Designed using common ATS-friendly formatting principles.",
            style="Guidance",
            italic=True,
            after=240,
        )
    )

    # Header block
    p.append(para("[FULL NAME]", style="Title"))
    p.append(para("[Professional Title]", after=40))
    p.append(para("[Phone] | [Email] | [City, Country] | [LinkedIn URL]"))

    # Professional summary
    p.append(para("Professional Summary", style="Heading1"))
    p.append(
        para(
            "[Write 3-5 lines summarising your years of experience, your core strengths, "
            "the role you are targeting and the sector you work in. Keep it factual and "
            "written in plain sentences.]"
        )
    )

    # Core skills
    p.append(para("Core Skills", style="Heading1"))
    p.append(
        para(
            "[Skill 1] | [Skill 2] | [Skill 3] | [Skill 4] | [Skill 5] | [Skill 6] | "
            "[Skill 7] | [Skill 8]"
        )
    )
    p.append(
        para(
            "[List the keywords that match the role. Plain text only, no skill bars or ratings.]",
            style="Guidance",
            italic=True,
        )
    )

    # Professional experience
    p.append(para("Professional Experience", style="Heading1"))
    for _ in range(2):
        p.append(para("[Job Title]", style="Heading2"))
        p.append(para("[Company] | [City, Country]", after=0))
        p.append(para("[Month Year] - [Month Year]", after=40))
        for _ in range(3):
            p.append(
                para(
                    "[Start with an action verb. Describe a responsibility or result, "
                    "with a number or outcome where you have one.]",
                    style="ListParagraph",
                    bullet=True,
                )
            )
        p.append(para(after=120))

    # Education
    p.append(para("Education", style="Heading1"))
    p.append(para("[Degree]", style="Heading2"))
    p.append(para("[Institution] | [City, Country]", after=0))
    p.append(para("[Graduation Year]"))

    # Training and certifications
    p.append(para("Training & Certifications", style="Heading1"))
    p.append(para("[Certification / Training]", style="Heading2"))
    p.append(para("[Provider]", after=0))
    p.append(para("[Year]"))

    # Projects / volunteering (optional)
    p.append(para("Projects / Volunteering", style="Heading1"))
    p.append(
        para(
            "[Optional. Delete this section if it does not apply to you.]",
            style="Guidance",
            italic=True,
        )
    )
    p.append(para("[Project or Organisation]", style="Heading2"))
    p.append(para("[Year]", after=40))
    p.append(
        para(
            "[Describe what you did and the outcome in one line.]",
            style="ListParagraph",
            bullet=True,
        )
    )

    # Languages
    p.append(para("Languages", style="Heading1"))
    p.append(para("[Language] - [Native / Fluent / Advanced / Intermediate / Basic]", after=0))
    p.append(para("[Language] - [Native / Fluent / Advanced / Intermediate / Basic]"))

    return "".join(p)


def build_document():
    sect = (
        "<w:sectPr>"
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" '
        'w:header="0" w:footer="0" w:gutter="0"/>'
        '<w:cols w:space="720"/>'
        '<w:docGrid w:linePitch="360"/>'
        "</w:sectPr>"
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>" + build_body() + sect + "</w:body></w:document>"
    )


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    parts = [
        # [Content_Types].xml must be the first entry in an OPC package.
        ("[Content_Types].xml", CONTENT_TYPES),
        ("_rels/.rels", RELS),
        ("docProps/core.xml", CORE),
        ("docProps/app.xml", APP),
        ("word/document.xml", build_document()),
        ("word/_rels/document.xml.rels", DOC_RELS),
        ("word/styles.xml", STYLES),
        ("word/numbering.xml", NUMBERING),
        ("word/settings.xml", SETTINGS),
        ("word/fontTable.xml", FONT_TABLE),
    ]
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in parts:
            archive.writestr(name, data)
    print("wrote " + OUT)


if __name__ == "__main__":
    main()
