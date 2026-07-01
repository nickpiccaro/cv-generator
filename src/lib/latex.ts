import type { CVDocument, FieldDef, SectionDef, SectionItem } from "./types";
import { listValue, profileLinks } from "./document";

const latexSpecials: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  "$": "\\$",
  "#": "\\#",
  "_": "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}"
};

export function escapeLatex(value: string): string {
  return value.replace(/[\\&%$#_{}~^]/g, (match) => latexSpecials[match]);
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value ?? "").trim();
}

function boldOwnerNames(raw: string, ownerNames: string[]) {
  let value = escapeLatex(raw);
  for (const owner of ownerNames.filter(Boolean).sort((a, b) => b.length - a.length)) {
    const escapedOwner = escapeLatex(owner.trim());
    value = value.replaceAll(escapedOwner, `\\textbf{${escapedOwner}}`);
  }
  return value;
}

function itemHasContent(item: SectionItem) {
  return Object.values(item.values).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim())));
}

export function visibleSections(doc: CVDocument) {
  const byId = new Map(doc.sections.map((section) => [section.id, section]));
  const ordered = doc.settings.sectionOrder.map((id) => byId.get(id)).filter(Boolean) as SectionDef[];
  const extras = doc.sections.filter((section) => !doc.settings.sectionOrder.includes(section.id));
  return [...ordered, ...extras].filter((section) => !section.hiddenWhenEmpty || section.items.some(itemHasContent));
}

function fieldValue(item: SectionItem, id: string) {
  return item.values[id];
}

function firstText(item: SectionItem, ids: string[]) {
  for (const id of ids) {
    const value = text(fieldValue(item, id));
    if (value) return value;
  }
  return "";
}

function formatDateForSort(value: string) {
  const match = value.match(/\b(19|20)\d{2}\b/g);
  return match ? Number(match[match.length - 1]) : 0;
}

function renderBullets(items: string[]) {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  return ["\\begin{itemize}", ...clean.map((item) => `  \\item ${escapeLatex(item)}`), "\\end{itemize}"].join("\n");
}

function entryRow(left: string, right: string) {
  if (!left && !right) return "";
  return `\\entryrow{${left}}{${right}}`;
}

function detailsFromFields(section: SectionDef, item: SectionItem, excludedIds: string[]) {
  return section.fields
    .filter((field) => !excludedIds.includes(field.id))
    .map((field) => renderFieldDetail(field, item))
    .filter(Boolean);
}

function renderEducation(section: SectionDef, item: SectionItem) {
  const institution = escapeLatex(firstText(item, ["institution", "school", "program"]));
  const location = escapeLatex(text(fieldValue(item, "location")));
  const degree = firstText(item, ["degree", "program"]);
  const field = firstText(item, ["field", "specialty", "concentration"]);
  const degreeText = [degree, field].filter(Boolean).join(degree && field ? " in " : "");
  const gpa = text(fieldValue(item, "gpa"));
  const degreeWithGpa = [
    escapeLatex(degreeText),
    gpa ? `(GPA: \\textbf{${escapeLatex(gpa)}})` : ""
  ].filter(Boolean).join(" ");
  const dates = escapeLatex(text(fieldValue(item, "dates")));
  const details = detailsFromFields(section, item, ["institution", "school", "program", "degree", "field", "specialty", "concentration", "location", "dates", "gpa"]);

  return [
    entryRow(institution ? `\\textbf{${institution}}` : "", location),
    entryRow(degreeWithGpa ? `\\textit{${degreeWithGpa}}` : "", dates ? `\\textit{${dates}}` : ""),
    ...details
  ].filter(Boolean).join("\n");
}

function renderExperience(section: SectionDef, item: SectionItem) {
  const organization = escapeLatex(firstText(item, ["organization", "company", "institution"]));
  const location = escapeLatex(text(fieldValue(item, "location")));
  const role = escapeLatex(firstText(item, ["role", "title", "position"]));
  const dates = escapeLatex(text(fieldValue(item, "dates")));
  const summary = escapeLatex(firstText(item, ["summary", "description", "impact"]));
  const bullets = renderBullets(listValue(fieldValue(item, "bullets"), true));

  return [
    entryRow(organization ? `\\textbf{${organization}}` : "", location),
    entryRow(role ? `\\textit{${role}}` : "", dates ? `\\textit{${dates}}` : ""),
    summary,
    bullets
  ].filter(Boolean).join("\n");
}

function renderAppointment(section: SectionDef, item: SectionItem) {
  const appointment = escapeLatex(firstText(item, ["appointment", "name", "project"]));
  const affiliation = escapeLatex(firstText(item, ["affiliation", "organization", "institution"]));
  const role = escapeLatex(firstText(item, ["role", "title", "position"]));
  const dates = escapeLatex(text(fieldValue(item, "dates")));
  const description = escapeLatex(firstText(item, ["description", "summary"]));
  const extra = detailsFromFields(section, item, ["appointment", "name", "project", "affiliation", "organization", "institution", "role", "title", "position", "dates", "description", "summary"]);

  return [
    entryRow(appointment ? `\\textbf{${appointment}}` : "", affiliation ? `\\textbf{${affiliation}}` : ""),
    entryRow(role ? `\\textit{${role}}` : "", dates ? `\\textit{${dates}}` : ""),
    description,
    ...extra
  ].filter(Boolean).join("\n");
}

function renderVolunteer(section: SectionDef, item: SectionItem) {
  const organization = escapeLatex(firstText(item, ["organization", "area"]));
  const location = escapeLatex(firstText(item, ["location", "organizations"]));
  const role = escapeLatex(firstText(item, ["role", "title"]));
  const dates = escapeLatex(text(fieldValue(item, "dates")));
  const summary = escapeLatex(firstText(item, ["impact", "summary", "description"]));
  const bullets = renderBullets(listValue(fieldValue(item, "bullets"), true));
  const hours = escapeLatex(text(fieldValue(item, "hours")));

  return [
    entryRow(organization ? `\\textbf{${organization}}` : "", location ? `\\textbf{${location}}` : ""),
    entryRow(role ? `\\textit{${role}}` : "", dates ? `\\textit{${dates}}` : ""),
    summary,
    bullets,
    hours ? `\\emph{${hours} hours}` : ""
  ].filter(Boolean).join("\n");
}

function sentenceJoin(pieces: string[]) {
  const clean = pieces
    .map((piece) => piece.trim().replace(/\.+$/, ""))
    .filter(Boolean);
  return clean.length ? `${clean.join(". ")}.` : "";
}

function sectionText(section: SectionDef) {
  return `${section.id} ${section.title}`.toLowerCase();
}

function isCitationSection(section: SectionDef) {
  const value = sectionText(section);
  return section.kind === "publication" ||
    section.kind === "presentation" ||
    /\b(publication|poster|podium|abstract)s?\b/.test(value);
}

function presentationType(section: SectionDef, item: SectionItem) {
  const explicitType = text(fieldValue(item, "type")).toLowerCase();
  const value = `${sectionText(section)} ${explicitType}`;
  if (value.includes("poster")) return "Poster";
  if (value.includes("podium")) return "Podium";
  if (value.includes("abstract")) return "Abstract";
  if (value.includes("oral")) return "Oral presentation";
  return "Presentation";
}

function renderCitation(section: SectionDef, item: SectionItem, ownerNames: string[]) {
  const authors = listValue(fieldValue(item, "authors"));
  const isPresentation = section.kind === "presentation" || /\b(poster|podium|abstract|presentation)s?\b/.test(sectionText(section));
  const meeting = text(fieldValue(item, "meeting") || fieldValue(item, "conference") || fieldValue(item, "venue"));
  const venue = isPresentation
    ? meeting ? `${presentationType(section, item)} presented at ${meeting}` : ""
    : text(fieldValue(item, "venue") || fieldValue(item, "book") || fieldValue(item, "meeting"));
  const pieces = [
    authors.length ? boldOwnerNames(authors.join(", "), ownerNames) : "",
    text(fieldValue(item, "year")) ? `(${escapeLatex(text(fieldValue(item, "year")))})` : "",
    text(fieldValue(item, "title")) ? `\\textit{${escapeLatex(text(fieldValue(item, "title")))}}` : "",
    escapeLatex(venue),
    isPresentation ? escapeLatex(text(fieldValue(item, "location"))) : "",
    escapeLatex(text(fieldValue(item, "details") || fieldValue(item, "publisher"))),
    escapeLatex(text(fieldValue(item, "doi")))
  ].filter(Boolean);
  const citation = sentenceJoin(pieces);
  return citation ? `\\item ${citation}` : "";
}

function renderSkills(item: SectionItem) {
  const category = escapeLatex(text(fieldValue(item, "category")));
  const items = listValue(fieldValue(item, "items"), true);
  if (!category && items.length === 0) return "";
  return `\\item \\textbf{${category || "Skills"}}: ${escapeLatex(items.join(", "))}`;
}

function renderCertification(item: SectionItem) {
  const name = escapeLatex(text(fieldValue(item, "name")));
  const issuer = escapeLatex(text(fieldValue(item, "issuer")));
  const year = escapeLatex(text(fieldValue(item, "year") || fieldValue(item, "date")));
  if (!name && !issuer && !year) return "";
  const main = name ? `\\textbf{${name}}` : issuer;
  const detail = [name ? issuer : "", year].filter(Boolean).join(", ");
  return `\\item ${main}${detail ? ` (${detail})` : ""}`;
}

function renderCompact(section: SectionDef, item: SectionItem) {
  const primaryField = section.fields[0];
  const secondaryField = section.fields[1];
  const dateField = section.fields.find((field) => field.kind === "dateRange" || field.id === "date" || field.id === "year");
  const locationField = section.fields.find((field) => field.id === "location" || field.id === "state");
  const primary = escapeLatex(text(fieldValue(item, primaryField?.id)));
  const secondary = escapeLatex(text(fieldValue(item, secondaryField?.id)));
  const dates = escapeLatex(text(dateField ? fieldValue(item, dateField.id) : ""));
  const location = escapeLatex(text(locationField ? fieldValue(item, locationField.id) : ""));
  const details = section.fields
    .filter((field) => ![primaryField?.id, secondaryField?.id, dateField?.id, locationField?.id].includes(field.id))
    .map((field) => renderFieldDetail(field, item))
    .filter(Boolean);

  const right = [location, dates].filter(Boolean).join(", ");
  return [
    entryRow(primary ? `\\textbf{${primary}}` : "", right),
    secondary ? `\\textit{${secondary}}` : "",
    ...details
  ].filter(Boolean).join("\n");
}

function renderFieldDetail(field: FieldDef, item: SectionItem) {
  const value = fieldValue(item, field.id);
  if (field.kind === "bullets") return renderBullets(listValue(value, true));
  if (field.kind === "tags") {
    const tags = listValue(value, true);
    return tags.length ? `\\emph{${escapeLatex(tags.join(", "))}}` : "";
  }
  const rendered = escapeLatex(text(value));
  return rendered ? rendered : "";
}

function renderSection(section: SectionDef, ownerNames: string[]) {
  const items = section.items.filter(itemHasContent);
  if (items.length === 0) return "";

  if (isCitationSection(section)) {
    const lines = items.map((item) => renderCitation(section, item, ownerNames)).filter(Boolean);
    return [`\\cvsection{${escapeLatex(section.title)}}`, "\\begin{enumerate}", ...lines, "\\end{enumerate}"].join("\n");
  }

  if (section.kind === "skills") {
    const lines = items.map(renderSkills).filter(Boolean);
    return [`\\cvsection{${escapeLatex(section.title)}}`, "\\begin{itemize}", ...lines, "\\end{itemize}"].join("\n");
  }

  if (section.kind === "certifications") {
    const lines = [...items]
      .sort((a, b) => formatDateForSort(text(fieldValue(b, "year") || fieldValue(b, "date"))) - formatDateForSort(text(fieldValue(a, "year") || fieldValue(a, "date"))))
      .map(renderCertification)
      .filter(Boolean);
    return [`\\cvsection{${escapeLatex(section.title)}}`, "\\begin{multicols}{2}", "\\begin{itemize}", ...lines, "\\end{itemize}", "\\end{multicols}"].join("\n");
  }

  const renderItem = (item: SectionItem) => {
    if (section.kind === "education") return renderEducation(section, item);
    if (section.kind === "experience") return renderExperience(section, item);
    if (section.kind === "appointments") return renderAppointment(section, item);
    if (section.kind === "volunteer") return renderVolunteer(section, item);
    return renderCompact(section, item);
  };
  const blocks = items.map(renderItem).filter(Boolean);
  return [`\\cvsection{${escapeLatex(section.title)}}`, ...blocks.map((block) => `${block}\\par\\vspace{4pt}`)].join("\n");
}

function link(label: string, rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return "";
  return `\\cvlink{${escapeLatex(url)}}{${escapeLatex(label)}}`;
}

function header(doc: CVDocument) {
  const profile = doc.profile;
  const address = profile.address || profile.location || "";
  const email = profile.email ? `\\cvlink{mailto:${escapeLatex(profile.email)}}{${escapeLatex(profile.email)}}` : "";
  const phone = profile.phone ? escapeLatex(profile.phone) : "";
  const contact = [email, phone].filter(Boolean).join(" $\\cdot$ ");
  const links = profileLinks(profile).map((profileLink) => link(profileLink.label, profileLink.url)).filter(Boolean).join(" $\\cdot$ ");

  return [
    "\\begin{center}",
    `{\\Large\\bfseries ${escapeLatex(profile.name)}${profile.credentials ? `, ${escapeLatex(profile.credentials)}` : ""}}\\\\`,
    profile.title ? `${escapeLatex(profile.title)}\\\\` : "",
    profile.affiliation ? `${escapeLatex(profile.affiliation)}\\\\` : "",
    address ? `${escapeLatex(address)}\\\\` : "",
    contact ? `${contact}\\\\` : "",
    links,
    "\\end{center}"
  ].filter(Boolean).join("\n");
}

export function generateLatex(doc: CVDocument) {
  const paper = doc.settings.paperSize === "a4" ? "a4paper" : "letterpaper";
  const margin = doc.settings.marginInches || 0.75;
  const sections = visibleSections(doc).map((section) => renderSection(section, doc.profile.ownerNames)).filter(Boolean);
  return String.raw`\documentclass[12pt,${paper}]{article}
\usepackage[margin=${margin}in]{geometry}
\usepackage{fontspec}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{hyperref}
\usepackage{multicol}
\IfFontExistsTF{Times New Roman}{\setmainfont{Times New Roman}}{\setmainfont{TeX Gyre Termes}}
\hypersetup{colorlinks=true,urlcolor=blue,linkcolor=blue}
\setlength{\parindent}{0pt}
\setlength{\columnsep}{1.25cm}
\setlist[itemize]{leftmargin=1.2em,itemsep=2pt,topsep=2pt,parsep=0pt}
\setlist[enumerate]{leftmargin=1.8em,itemsep=2pt,topsep=2pt,parsep=0pt}
\titleformat{\section}{\large\bfseries\scshape}{}{0pt}{}[\titlerule]
\newcommand{\cvsection}[1]{\section*{#1}}
\newcommand{\cvlink}[2]{\href{#1}{\textcolor{blue}{\underline{#2}}}}
\newcommand{\entryrow}[2]{\noindent\begin{tabular*}{\textwidth}{@{}p{0.72\textwidth}@{\extracolsep{\fill}}r@{}}#1 & #2\end{tabular*}\par}
\begin{document}
${header(doc)}

${sections.join("\n\n")}
\end{document}
`;
}

export function generatePlainPreview(doc: CVDocument) {
  return visibleSections(doc)
    .map((section) => `${section.title}\n${section.items.filter(itemHasContent).length} item(s)`)
    .join("\n\n");
}
