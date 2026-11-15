import type { DocCategory, DocCategoryId, LayoutSettings } from "./types";
import { A4 } from "./types";

export const DOC_CATEGORIES: Record<DocCategoryId, DocCategory> = {
  document: {
    id: "document",
    label: "Document",
    cardW: 210,
    cardH: 297,
    accent: "var(--theme-category-document)",
    icon: "FileText",
  },
  aadhar: {
    id: "aadhar",
    label: "Aadhar Card",
    cardW: 85.6,
    cardH: 53.98,
    accent: "var(--theme-category-aadhar)",
    icon: "CreditCard",
  },
  voter: {
    id: "voter",
    label: "Voter ID",
    cardW: 85.6,
    cardH: 53.98,
    accent: "var(--theme-category-voter)",
    icon: "Vote",
  },
  pan: {
    id: "pan",
    label: "PAN Card",
    cardW: 85.6,
    cardH: 53.98,
    accent: "var(--theme-category-pan)",
    icon: "IdCard",
  },
  passport: {
    id: "passport",
    label: "Passport",
    cardW: 88,
    cardH: 125,
    accent: "var(--theme-category-passport)",
    icon: "BookUser",
  },
  driving: {
    id: "driving",
    label: "Driving Licence",
    cardW: 85.6,
    cardH: 53.98,
    accent: "var(--theme-category-driving)",
    icon: "Car",
  },
  ration: {
    id: "ration",
    label: "Ration Card",
    cardW: 85.6,
    cardH: 53.98,
    accent: "var(--theme-category-ration)",
    icon: "ReceiptText",
  },
  custom: {
    id: "custom",
    label: "Custom",
    cardW: 85.6,
    cardH: 53.98,
    accent: "var(--theme-category-custom)",
    icon: "Shapes",
  },
};

export const DEFAULT_LAYOUT: LayoutSettings = {
  margin: 10,
  gap: 4,
  cardW: 85.6,
  verticalAlign: "center",
  cols: 0,
  rows: 0,
};

export const A4_SIZE = A4;
