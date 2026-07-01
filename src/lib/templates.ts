import type { FieldDef, SectionDef, SectionKind } from "./types";

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const fieldKinds = [
  "text",
  "textarea",
  "date",
  "dateRange",
  "authors",
  "bullets",
  "tags",
  "url",
  "number",
  "select"
] as const;

export const sectionTemplates: Array<{
  label: string;
  kind: SectionKind;
  fields: FieldDef[];
}> = [
  {
    label: "Education",
    kind: "education",
    fields: [
      { id: "institution", label: "Institution", kind: "text" },
      { id: "degree", label: "Degree or Program", kind: "text" },
      { id: "field", label: "Field", kind: "text" },
      { id: "location", label: "Location", kind: "text" },
      { id: "dates", label: "Dates", kind: "dateRange", placeholder: "2024-2025" },
      { id: "gpa", label: "GPA", kind: "text" },
      { id: "details", label: "Details", kind: "bullets" }
    ]
  },
  {
    label: "Postgraduate Education and Training",
    kind: "education",
    fields: [
      { id: "institution", label: "Institution", kind: "text" },
      { id: "program", label: "Program", kind: "text" },
      { id: "specialty", label: "Specialty", kind: "text" },
      { id: "location", label: "Location", kind: "text" },
      { id: "dates", label: "Dates", kind: "dateRange" },
      { id: "gpa", label: "GPA", kind: "text" }
    ]
  },
  {
    label: "Work and Research Experience",
    kind: "experience",
    fields: [
      { id: "organization", label: "Organization", kind: "text" },
      { id: "location", label: "Location", kind: "text" },
      { id: "role", label: "Role", kind: "text" },
      { id: "dates", label: "Dates", kind: "dateRange" },
      { id: "summary", label: "Summary", kind: "textarea" },
      { id: "bullets", label: "Bullets", kind: "bullets" },
      { id: "tags", label: "Skills or Tags", kind: "tags" }
    ]
  },
  {
    label: "Skills",
    kind: "skills",
    fields: [
      { id: "category", label: "Category", kind: "text" },
      { id: "items", label: "Items", kind: "tags" }
    ]
  },
  {
    label: "Certifications",
    kind: "certifications",
    fields: [
      { id: "name", label: "Certification", kind: "text" },
      { id: "issuer", label: "Issuer", kind: "text" },
      { id: "year", label: "Year", kind: "date" }
    ]
  },
  {
    label: "Volunteer Roles",
    kind: "volunteer",
    fields: [
      { id: "organization", label: "Organization", kind: "text" },
      { id: "location", label: "Location", kind: "text" },
      { id: "role", label: "Role", kind: "text" },
      { id: "dates", label: "Dates", kind: "dateRange" },
      { id: "impact", label: "Impact", kind: "textarea" },
      { id: "bullets", label: "Bullets", kind: "bullets" },
      { id: "hours", label: "Hours", kind: "number" }
    ]
  },
  {
    label: "Volunteer Impact",
    kind: "volunteer",
    fields: [
      { id: "area", label: "Impact Area", kind: "text" },
      { id: "organizations", label: "Organizations", kind: "tags" },
      { id: "dates", label: "Dates", kind: "dateRange" },
      { id: "summary", label: "Summary", kind: "textarea" },
      { id: "bullets", label: "Outcomes", kind: "bullets" },
      { id: "hours", label: "Total Hours", kind: "number" }
    ]
  },
  {
    label: "Academic and Professional Appointments",
    kind: "appointments",
    fields: [
      { id: "appointment", label: "Appointment", kind: "text" },
      { id: "affiliation", label: "Affiliation", kind: "text" },
      { id: "role", label: "Role", kind: "text" },
      { id: "dates", label: "Dates", kind: "dateRange" },
      { id: "description", label: "Description", kind: "textarea" }
    ]
  },
  {
    label: "Medical Licensure",
    kind: "licenses",
    fields: [
      { id: "license", label: "License", kind: "text" },
      { id: "state", label: "State", kind: "text" },
      { id: "number", label: "Number", kind: "text" },
      { id: "status", label: "Status", kind: "text" },
      { id: "date", label: "Date", kind: "date" }
    ]
  },
  {
    label: "Professional Society Memberships",
    kind: "memberships",
    fields: [
      { id: "organization", label: "Organization", kind: "text" },
      { id: "role", label: "Role or Membership Type", kind: "text" },
      { id: "dates", label: "Dates", kind: "dateRange" }
    ]
  },
  {
    label: "Honors",
    kind: "awards",
    fields: [
      { id: "award", label: "Honor", kind: "text" },
      { id: "sponsor", label: "Sponsor", kind: "text" },
      { id: "date", label: "Date", kind: "date" },
      { id: "description", label: "Description", kind: "textarea" }
    ]
  },
  {
    label: "Awards",
    kind: "awards",
    fields: [
      { id: "award", label: "Award", kind: "text" },
      { id: "sponsor", label: "Sponsor", kind: "text" },
      { id: "date", label: "Date", kind: "date" },
      { id: "description", label: "Description", kind: "textarea" }
    ]
  },
  {
    label: "Publications",
    kind: "publication",
    fields: [
      { id: "authors", label: "Authors", kind: "authors" },
      { id: "year", label: "Year", kind: "date" },
      { id: "title", label: "Title", kind: "text" },
      { id: "venue", label: "Journal or Venue", kind: "text" },
      { id: "details", label: "Volume, Issue, Pages, Status", kind: "text" },
      { id: "doi", label: "DOI or URL", kind: "url" }
    ]
  },
  {
    label: "Book Chapters",
    kind: "publication",
    fields: [
      { id: "authors", label: "Authors", kind: "authors" },
      { id: "year", label: "Year", kind: "date" },
      { id: "title", label: "Chapter Title", kind: "text" },
      { id: "book", label: "Book", kind: "text" },
      { id: "publisher", label: "Publisher", kind: "text" }
    ]
  },
  {
    label: "Poster Presentations",
    kind: "presentation",
    fields: [
      { id: "authors", label: "Authors", kind: "authors" },
      { id: "year", label: "Year", kind: "date" },
      { id: "title", label: "Title", kind: "text" },
      { id: "meeting", label: "Meeting", kind: "text" },
      { id: "location", label: "Location", kind: "text" },
      { id: "type", label: "Type", kind: "select", options: ["Poster", "Oral", "Podium"] }
    ]
  },
  {
    label: "Abstracts",
    kind: "presentation",
    fields: [
      { id: "authors", label: "Authors", kind: "authors" },
      { id: "year", label: "Year", kind: "date" },
      { id: "title", label: "Title", kind: "text" },
      { id: "meeting", label: "Meeting", kind: "text" },
      { id: "location", label: "Location", kind: "text" }
    ]
  },
  {
    label: "Podium Presentations",
    kind: "presentation",
    fields: [
      { id: "authors", label: "Authors", kind: "authors" },
      { id: "year", label: "Year", kind: "date" },
      { id: "title", label: "Title", kind: "text" },
      { id: "meeting", label: "Meeting", kind: "text" },
      { id: "location", label: "Location", kind: "text" }
    ]
  },
  {
    label: "Custom Section",
    kind: "custom",
    fields: [
      { id: "title", label: "Title", kind: "text" },
      { id: "subtitle", label: "Subtitle", kind: "text" },
      { id: "dates", label: "Dates", kind: "dateRange" },
      { id: "description", label: "Description", kind: "textarea" },
      { id: "bullets", label: "Bullets", kind: "bullets" }
    ]
  }
];

export function createSection(templateLabel: string): SectionDef {
  const template = sectionTemplates.find((item) => item.label === templateLabel) ?? sectionTemplates[sectionTemplates.length - 1];
  const id = uid(template.kind);
  return {
    id,
    title: template.label,
    kind: template.kind,
    hiddenWhenEmpty: true,
    fields: template.fields.map((field) => ({ ...field })),
    items: []
  };
}

export function createItem(section: SectionDef) {
  const values = Object.fromEntries(
    section.fields.map((field) => [field.id, field.kind === "authors" || field.kind === "bullets" || field.kind === "tags" ? [] : ""])
  );
  return { id: uid("item"), values };
}

export function createField(): FieldDef {
  return { id: uid("field"), label: "New Field", kind: "text" };
}
