export const PERSON_SECTIONS = [
  "experience",
  "education",
  "interests",
  "honors",
  "languages",
  "contact_info",
] as const;

export const COMPANY_SECTIONS = ["posts", "jobs"] as const;

export type PersonSection = (typeof PERSON_SECTIONS)[number];
export type CompanySection = (typeof COMPANY_SECTIONS)[number];

export function parsePersonSections(sections: string | null | undefined): {
  fields: Set<PersonSection>;
  unknown: string[];
} {
  const fields = new Set<PersonSection>();
  const unknown: string[] = [];
  if (!sections) return { fields, unknown };
  for (const name of sections.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    if (PERSON_SECTIONS.includes(name as PersonSection)) {
      fields.add(name as PersonSection);
    } else {
      unknown.push(name);
    }
  }
  return { fields, unknown };
}

export function parseCompanySections(sections: string | null | undefined): {
  fields: Set<CompanySection>;
  unknown: string[];
} {
  const fields = new Set<CompanySection>();
  const unknown: string[] = [];
  if (!sections) return { fields, unknown };
  for (const name of sections.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    if (COMPANY_SECTIONS.includes(name as CompanySection)) {
      fields.add(name as CompanySection);
    } else {
      unknown.push(name);
    }
  }
  return { fields, unknown };
}
