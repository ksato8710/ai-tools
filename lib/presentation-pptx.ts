import pptxgen from "pptxgenjs";
import type {
  PresentationData,
  PresentationTheme,
  Slide,
  TitleBody,
  BulletsBody,
  TwoColumnBody,
  StatsBody,
  QuoteBody,
  ImageTextBody,
  CtaBody,
  ColumnContent,
} from "./presentation-schema";

// Strip "#" from hex colors for pptxgenjs
function c(hex: string): string {
  return hex.replace(/^#/, "");
}

export async function generatePptx(data: PresentationData): Promise<Blob> {
  const pres = new pptxgen();
  const t: PresentationTheme = data.theme || {
    primaryColor: "#1a365d",
    secondaryColor: "#2b6cb0",
    accentColor: "#ed8936",
    backgroundColor: "#ffffff",
    textColor: "#1a202c",
  };

  pres.layout = "LAYOUT_16x9";
  pres.title = data.metadata.title;
  pres.author = data.metadata.author || "";
  pres.subject = data.metadata.purpose;

  for (const slide of data.slides) {
    renderSlide(pres, slide, t);
  }

  return (await pres.write({ outputType: "blob" })) as Blob;
}

function renderSlide(
  pres: pptxgen,
  slide: Slide,
  t: PresentationTheme
) {
  switch (slide.layout) {
    case "title":
      return renderTitle(pres, slide, t);
    case "section-divider":
      return renderSectionDivider(pres, slide, t);
    case "bullets":
      return renderBullets(pres, slide, t);
    case "two-column":
      return renderTwoColumn(pres, slide, t);
    case "stats":
      return renderStats(pres, slide, t);
    case "quote":
      return renderQuote(pres, slide, t);
    case "image-text":
      return renderImageText(pres, slide, t);
    case "cta":
      return renderCta(pres, slide, t);
    default:
      return renderDefault(pres, slide, t);
  }
}

// --- Title ---
function renderTitle(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.primaryColor) };

  const body = slide.body as TitleBody | undefined;

  s.addText(slide.title, {
    x: 0.8,
    y: 1.2,
    w: 8.4,
    h: 1.4,
    fontSize: 44,
    fontFace: "Arial",
    color: "FFFFFF",
    bold: true,
    align: "center",
  });

  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 1,
      y: 2.6,
      w: 8,
      h: 0.6,
      fontSize: 20,
      color: "FFFFFF",
      align: "center",
      transparency: 10,
    });
  }

  if (body?.tagline) {
    s.addText(body.tagline, {
      x: 1.5,
      y: 3.5,
      w: 7,
      h: 0.5,
      fontSize: 12,
      color: "FFFFFF",
      align: "center",
      italic: true,
      transparency: 30,
    });
  }

  if (body?.description) {
    s.addText(body.description, {
      x: 1.5,
      y: 4.1,
      w: 7,
      h: 0.8,
      fontSize: 11,
      color: "FFFFFF",
      align: "center",
      transparency: 40,
      lineSpacingMultiple: 1.3,
    });
  }

  // Accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 4.2,
    y: 5.0,
    w: 1.6,
    h: 0.06,
    fill: { color: c(t.accentColor) },
  });

  addSlideNumber(s, slide, "FFFFFF");
}

// --- Section Divider ---
function renderSectionDivider(
  pres: pptxgen,
  slide: Slide,
  t: PresentationTheme
) {
  const s = pres.addSlide();
  s.background = { fill: c(t.backgroundColor) };

  // Accent bar
  s.addShape(pres.ShapeType.rect, {
    x: 4.2,
    y: 1.8,
    w: 1.6,
    h: 0.06,
    fill: { color: c(t.accentColor) },
  });

  s.addText(slide.title, {
    x: 1,
    y: 2.1,
    w: 8,
    h: 1.2,
    fontSize: 32,
    fontFace: "Arial",
    color: c(t.primaryColor),
    bold: true,
    align: "center",
  });

  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 1.5,
      y: 3.3,
      w: 7,
      h: 0.6,
      fontSize: 14,
      color: c(t.textColor),
      align: "center",
      transparency: 40,
    });
  }

  addSlideNumber(s, slide, c(t.textColor));
}

// --- Bullets ---
function renderBullets(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.backgroundColor) };

  addHeader(pres, s, slide, t);

  const body = slide.body as BulletsBody;
  const textItems: pptxgen.TextProps[] = [];

  for (const item of body.items) {
    textItems.push({
      text: item.text,
      options: {
        bullet: true,
        fontSize: 15,
        color: c(t.textColor),
        bold: true,
        indentLevel: 0,
        paraSpaceBefore: 8,
      },
    });
    if (item.subItems) {
      for (const sub of item.subItems) {
        textItems.push({
          text: sub,
          options: {
            bullet: { characterCode: "2013" }, // em dash
            fontSize: 12,
            color: c(t.textColor),
            transparency: 40,
            indentLevel: 1,
            paraSpaceBefore: 2,
          },
        });
      }
    }
  }

  s.addText(textItems, {
    x: 0.8,
    y: 1.6,
    w: 8.4,
    h: 3.6,
    valign: "top",
    lineSpacingMultiple: 1.2,
  });

  addSlideNumber(s, slide, c(t.textColor));
}

// --- Two Column ---
function renderTwoColumn(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.backgroundColor) };

  addHeader(pres, s, slide, t);

  const body = slide.body as TwoColumnBody;

  renderColumn(s, body.left, 0.8, t, pres);
  renderColumn(s, body.right, 5.2, t, pres);

  addSlideNumber(s, slide, c(t.textColor));
}

function renderColumn(
  s: pptxgen.Slide,
  col: ColumnContent,
  x: number,
  t: PresentationTheme,
  pres: pptxgen
) {
  let yPos = 1.6;

  if (col.heading) {
    s.addText(col.heading, {
      x,
      y: yPos,
      w: 4,
      h: 0.4,
      fontSize: 13,
      fontFace: "Arial",
      color: c(t.primaryColor),
      bold: true,
    });
    // Underline accent
    s.addShape(pres.ShapeType.rect, {
      x,
      y: yPos + 0.42,
      w: 1.2,
      h: 0.03,
      fill: { color: c(t.accentColor) },
    });
    yPos += 0.6;
  }

  if (col.items) {
    const textItems: pptxgen.TextProps[] = col.items.map((item) => ({
      text: item,
      options: {
        bullet: true,
        fontSize: 11,
        color: c(t.textColor),
        indentLevel: 0,
        paraSpaceBefore: 6,
      },
    }));

    s.addText(textItems, {
      x,
      y: yPos,
      w: 4,
      h: 3.2,
      valign: "top",
      lineSpacingMultiple: 1.2,
    });
  }

  if (col.description) {
    s.addText(col.description, {
      x,
      y: yPos,
      w: 4,
      h: 1,
      fontSize: 11,
      color: c(t.textColor),
      transparency: 30,
      lineSpacingMultiple: 1.3,
    });
  }
}

// --- Stats ---
function renderStats(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.backgroundColor) };

  addHeader(pres, s, slide, t);

  const body = slide.body as StatsBody;
  const count = body.stats.length;
  const totalW = 8.4;
  const itemW = totalW / count;

  body.stats.forEach((stat, i) => {
    const x = 0.8 + i * itemW;

    s.addText(stat.value, {
      x,
      y: 2.0,
      w: itemW,
      h: 1.0,
      fontSize: 40,
      fontFace: "Arial",
      color: c(t.primaryColor),
      bold: true,
      align: "center",
    });

    s.addText(stat.label, {
      x,
      y: 3.0,
      w: itemW,
      h: 0.5,
      fontSize: 14,
      color: c(t.accentColor),
      bold: true,
      align: "center",
    });

    if (stat.description) {
      s.addText(stat.description, {
        x: x + 0.2,
        y: 3.5,
        w: itemW - 0.4,
        h: 0.6,
        fontSize: 10,
        color: c(t.textColor),
        align: "center",
        transparency: 50,
      });
    }
  });

  if (body.footnote) {
    s.addText(body.footnote, {
      x: 1,
      y: 4.8,
      w: 8,
      h: 0.4,
      fontSize: 9,
      color: c(t.textColor),
      align: "center",
      transparency: 60,
    });
  }

  addSlideNumber(s, slide, c(t.textColor));
}

// --- Quote ---
function renderQuote(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.backgroundColor) };

  const body = slide.body as QuoteBody;

  s.addText(slide.title, {
    x: 1,
    y: 0.8,
    w: 8,
    h: 0.5,
    fontSize: 11,
    color: c(t.textColor),
    align: "center",
    transparency: 60,
    charSpacing: 4,
  });

  // Large quote mark
  s.addText("\u201C", {
    x: 1,
    y: 1.2,
    w: 8,
    h: 0.8,
    fontSize: 60,
    color: c(t.primaryColor),
    align: "center",
    transparency: 80,
  });

  s.addText(body.quote, {
    x: 1.5,
    y: 1.8,
    w: 7,
    h: 2.0,
    fontSize: 18,
    fontFace: "Arial",
    color: c(t.primaryColor),
    align: "center",
    italic: true,
    lineSpacingMultiple: 1.4,
    valign: "middle",
  });

  if (body.attribution) {
    s.addText(`\u2014 ${body.attribution}`, {
      x: 1.5,
      y: 3.9,
      w: 7,
      h: 0.4,
      fontSize: 12,
      color: c(t.accentColor),
      bold: true,
      align: "center",
    });
  }

  if (body.context) {
    s.addText(body.context, {
      x: 2,
      y: 4.4,
      w: 6,
      h: 0.8,
      fontSize: 10,
      color: c(t.textColor),
      align: "center",
      transparency: 50,
      lineSpacingMultiple: 1.3,
    });
  }

  addSlideNumber(s, slide, c(t.textColor));
}

// --- Image + Text ---
function renderImageText(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.backgroundColor) };

  const body = slide.body as ImageTextBody;
  const imgLeft = body.imagePosition !== "right";

  // Image placeholder area
  const imgX = imgLeft ? 0 : 5;
  s.addShape(pres.ShapeType.rect, {
    x: imgX,
    y: 0,
    w: 5,
    h: 5.625,
    fill: { color: c(t.primaryColor), transparency: 90 },
  });
  s.addText(body.imagePlaceholder || "[Image]", {
    x: imgX,
    y: 2.3,
    w: 5,
    h: 1,
    fontSize: 12,
    color: c(t.textColor),
    align: "center",
    transparency: 60,
  });

  // Text side
  const textX = imgLeft ? 5.5 : 0.5;
  s.addText(slide.title, {
    x: textX,
    y: 1.5,
    w: 4,
    h: 0.8,
    fontSize: 22,
    fontFace: "Arial",
    color: c(t.primaryColor),
    bold: true,
  });
  s.addText(body.text, {
    x: textX,
    y: 2.4,
    w: 4,
    h: 2,
    fontSize: 12,
    color: c(t.textColor),
    transparency: 30,
    lineSpacingMultiple: 1.4,
  });

  addSlideNumber(s, slide, c(t.textColor));
}

// --- CTA ---
function renderCta(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.primaryColor) };

  const body = slide.body as CtaBody;

  s.addText(slide.title, {
    x: 1,
    y: 0.8,
    w: 8,
    h: 0.4,
    fontSize: 11,
    color: "FFFFFF",
    align: "center",
    transparency: 40,
    charSpacing: 4,
  });

  s.addText(body.heading, {
    x: 1,
    y: 1.5,
    w: 8,
    h: 0.8,
    fontSize: 30,
    fontFace: "Arial",
    color: "FFFFFF",
    bold: true,
    align: "center",
  });

  if (body.description) {
    s.addText(body.description, {
      x: 1.5,
      y: 2.4,
      w: 7,
      h: 1.0,
      fontSize: 13,
      color: "FFFFFF",
      align: "center",
      transparency: 20,
      lineSpacingMultiple: 1.4,
    });
  }

  if (body.actions) {
    const actionTexts: pptxgen.TextProps[] = body.actions.map((a) => ({
      text: `\u2192  ${a}`,
      options: {
        fontSize: 13,
        color: "FFFFFF",
        transparency: 10,
        paraSpaceBefore: 6,
      },
    }));
    s.addText(actionTexts, {
      x: 2.5,
      y: 3.4,
      w: 5,
      h: 1.2,
      valign: "top",
      align: "center",
    });
  }

  if (body.contactInfo) {
    s.addText(body.contactInfo, {
      x: 2,
      y: 4.8,
      w: 6,
      h: 0.4,
      fontSize: 10,
      color: "FFFFFF",
      align: "center",
      transparency: 50,
    });
  }

  addSlideNumber(s, slide, "FFFFFF");
}

// --- Default fallback ---
function renderDefault(pres: pptxgen, slide: Slide, t: PresentationTheme) {
  const s = pres.addSlide();
  s.background = { fill: c(t.backgroundColor) };

  s.addText(slide.title, {
    x: 1,
    y: 2,
    w: 8,
    h: 1,
    fontSize: 28,
    fontFace: "Arial",
    color: c(t.primaryColor),
    bold: true,
    align: "center",
  });

  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 1,
      y: 3.2,
      w: 8,
      h: 0.6,
      fontSize: 14,
      color: c(t.textColor),
      align: "center",
      transparency: 40,
    });
  }

  addSlideNumber(s, slide, c(t.textColor));
}

// --- Helpers ---

function addHeader(
  pres: pptxgen,
  s: pptxgen.Slide,
  slide: Slide,
  t: PresentationTheme
) {
  s.addText(slide.title, {
    x: 0.8,
    y: 0.4,
    w: 8.4,
    h: 0.6,
    fontSize: 22,
    fontFace: "Arial",
    color: c(t.primaryColor),
    bold: true,
  });

  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.8,
      y: 1.0,
      w: 8.4,
      h: 0.35,
      fontSize: 12,
      color: c(t.textColor),
      transparency: 50,
    });
  }

  // Accent underline
  s.addShape(pres.ShapeType.rect, {
    x: 0.8,
    y: slide.subtitle ? 1.38 : 1.05,
    w: 1.0,
    h: 0.03,
    fill: { color: c(t.accentColor) },
  });
}

function addSlideNumber(
  s: pptxgen.Slide,
  _slide: Slide,
  color: string
) {
  s.slideNumber = {
    x: 9.2,
    y: 5.2,
    fontSize: 8,
    color,
  };
}
