import type { JSONContent } from "@tiptap/core";
import { createDocumentMakerPage, type DocumentMakerPage } from "./documentMaker";
import { DEFAULT_DOCUMENT_MAKER_LAYOUT, type DocumentMakerLayout } from "./documentMaker";

export interface DocumentMakerTemplate {
  id: string;
  title: string;
  description: string;
  pages: DocumentMakerPage[];
  layout: DocumentMakerLayout;
}

const paragraph = (text = ""): JSONContent => ({
  type: "paragraph",
  ...(text ? { content: [{ type: "text", text }] } : {}),
});

const heading = (text: string, level: 1 | 2 = 1): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});

const table = (rows: string[][]): JSONContent => ({
  type: "table",
  content: rows.map((row, rowIndex) => ({
    type: "tableRow",
    content: row.map((text) => ({
      type: rowIndex === 0 ? "tableHeader" : "tableCell",
      content: [paragraph(text)],
    })),
  })),
});

function templatePage(content: JSONContent[]): DocumentMakerPage {
  return createDocumentMakerPage({ type: "doc", content });
}

export const DOCUMENT_MAKER_TEMPLATES: DocumentMakerTemplate[] = [
  {
    id: "formal-letter",
    title: "Formal letter",
    description: "A clean business letter with address and signature placeholders.",
    pages: [
      templatePage([
        paragraph("[Your name]"),
        paragraph("[Your address]"),
        paragraph("[City, postal code]"),
        paragraph("[Date]"),
        paragraph(),
        paragraph("[Recipient name]"),
        paragraph("[Recipient address]"),
        paragraph(),
        paragraph("Subject: [Write the subject]"),
        paragraph(),
        paragraph("Dear [Recipient name],"),
        paragraph("Write your message here."),
        paragraph(),
        paragraph("Sincerely,"),
        paragraph("[Your name]"),
      ]),
    ],
    layout: { ...DEFAULT_DOCUMENT_MAKER_LAYOUT },
  },
  {
    id: "application",
    title: "Application",
    description: "A formal application with a subject, request, and sign-off.",
    pages: [
      templatePage([
        paragraph("[Date]"),
        paragraph(),
        paragraph("To"),
        paragraph("[Recipient / office]"),
        paragraph("[Organization]"),
        paragraph(),
        paragraph("Subject: Application for [purpose]"),
        paragraph(),
        paragraph("Dear Sir/Madam,"),
        paragraph("I am writing to request [describe your application]."),
        paragraph("My details are:"),
        table([
          ["Detail", "Information"],
          ["Full name", "[Your name]"],
          ["Address", "[Your address]"],
          ["Contact", "[Phone or email]"],
        ]),
        paragraph(),
        paragraph("Thank you for your consideration."),
        paragraph("Yours faithfully,"),
        paragraph("[Your name]"),
      ]),
    ],
    layout: { ...DEFAULT_DOCUMENT_MAKER_LAYOUT },
  },
  {
    id: "resume",
    title: "Résumé",
    description: "A one-page résumé outline for contact, experience, and skills.",
    pages: [
      templatePage([
        heading("[Your name]"),
        paragraph("[City] · [Phone] · [Email]"),
        heading("Professional summary", 2),
        paragraph("[A short summary of your experience and strengths.]"),
        heading("Experience", 2),
        paragraph("[Job title] · [Company] · [Dates]"),
        paragraph("• [Achievement or responsibility]"),
        heading("Education", 2),
        paragraph("[Degree or qualification] · [Institution] · [Year]"),
        heading("Skills", 2),
        paragraph("[Skill 1] · [Skill 2] · [Skill 3]"),
        heading("References", 2),
        paragraph("Available on request."),
      ]),
    ],
    layout: { ...DEFAULT_DOCUMENT_MAKER_LAYOUT },
  },
  {
    id: "invoice",
    title: "Invoice",
    description: "An itemized invoice with totals and payment details.",
    pages: [
      templatePage([
        heading("INVOICE"),
        paragraph("[Business name] · [Address] · [Contact]"),
        paragraph("Invoice no.: [Number]                         Date: [Date]"),
        paragraph("Bill to: [Customer name and address]"),
        table([
          ["Description", "Qty", "Unit price", "Amount"],
          ["[Item or service]", "1", "[0.00]", "[0.00]"],
          ["[Item or service]", "1", "[0.00]", "[0.00]"],
        ]),
        paragraph("Subtotal: [0.00]"),
        paragraph("Tax: [0.00]"),
        paragraph("Total due: [0.00]"),
        paragraph("Payment details: [Account / payment instructions]"),
        paragraph("Thank you for your business."),
      ]),
    ],
    layout: { ...DEFAULT_DOCUMENT_MAKER_LAYOUT },
  },
  {
    id: "meeting-notes",
    title: "Meeting notes",
    description: "A structured meeting record with actions and owners.",
    pages: [
      templatePage([
        heading("Meeting notes"),
        paragraph("Date: [Date]    Time: [Time]    Location: [Location]"),
        paragraph("Attendees: [Names]"),
        heading("Agenda", 2),
        paragraph("1. [Topic]"),
        paragraph("2. [Topic]"),
        heading("Discussion and decisions", 2),
        paragraph("[Record key points and decisions.]"),
        heading("Action items", 2),
        table([
          ["Action", "Owner", "Due date", "Status"],
          ["[Action item]", "[Name]", "[Date]", "[Open]"],
        ]),
      ]),
    ],
    layout: { ...DEFAULT_DOCUMENT_MAKER_LAYOUT },
  },
];
