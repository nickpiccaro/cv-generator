export type FieldKind =
  | "text"
  | "textarea"
  | "date"
  | "dateRange"
  | "authors"
  | "bullets"
  | "tags"
  | "url"
  | "number"
  | "select";

export type SectionKind =
  | "education"
  | "experience"
  | "skills"
  | "certifications"
  | "appointments"
  | "volunteer"
  | "licenses"
  | "memberships"
  | "awards"
  | "publication"
  | "presentation"
  | "custom";

export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: string[];
}

export interface SectionItem {
  id: string;
  values: Record<string, string | string[]>;
}

export interface SectionDef {
  id: string;
  title: string;
  kind: SectionKind;
  hiddenWhenEmpty: boolean;
  fields: FieldDef[];
  items: SectionItem[];
}

export interface ProfileLink {
  id: string;
  label: string;
  url: string;
}

export interface CVDocument {
  version: 1;
  profile: {
    name: string;
    credentials?: string;
    title?: string;
    affiliation?: string;
    address?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    links?: ProfileLink[];
    ownerNames: string[];
  };
  settings: {
    paperSize: "letter" | "a4";
    marginInches: number;
    sectionOrder: string[];
  };
  sections: SectionDef[];
}
