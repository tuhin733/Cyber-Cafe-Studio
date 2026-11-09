export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  headerClass: string;
  sectionHeadingClass: string;
  pageClass: string;
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    description: "A traditional, polished layout for any career.",
    headerClass: "border-b-2 border-ink-primary pb-5 text-center",
    sectionHeadingClass: "border-b border-ui pb-1 text-ink-primary",
    pageClass: "font-serif",
  },
  {
    id: "modern",
    name: "Modern",
    description: "A fresh accent header with clear section hierarchy.",
    headerClass: "rounded-xl bg-action-subtle px-5 py-5",
    sectionHeadingClass: "border-l-4 border-action pl-2 text-action",
    pageClass: "font-sans",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "A clean, compact style that keeps focus on your content.",
    headerClass: "border-b border-ui pb-4",
    sectionHeadingClass: "text-ink-secondary",
    pageClass: "font-sans",
  },
];
