export const DOCUMENT_MAKER_SHAPE_TYPES = [
  "rectangle",
  "roundedRectangle",
  "ellipse",
  "line",
  "arrow",
  "triangle",
  "callout",
  "textBox",
] as const;

export type DocumentMakerShapeType = (typeof DOCUMENT_MAKER_SHAPE_TYPES)[number];

export interface DocumentMakerShapeAttributes {
  shapeType: DocumentMakerShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  dashed: boolean;
  shadow: boolean;
  text: string;
}

export const DEFAULT_DOCUMENT_MAKER_SHAPE: Omit<
  DocumentMakerShapeAttributes,
  "shapeType" | "x" | "y" | "width" | "height"
> = {
  fill: "#DBEAFE",
  stroke: "#2563EB",
  strokeWidth: 2,
  opacity: 1,
  rotation: 0,
  dashed: false,
  shadow: false,
  text: "",
};

export function isDocumentMakerShapeType(value: unknown): value is DocumentMakerShapeType {
  return typeof value === "string" &&
    DOCUMENT_MAKER_SHAPE_TYPES.includes(value as DocumentMakerShapeType);
}

export function getDocumentMakerShapeColor(value: unknown, fallback: string) {
  return value === "none" || (typeof value === "string" && /^#[\da-f]{6}$/i.test(value))
    ? value
    : fallback;
}

type ShapeMarkup =
  | ["ellipse", { cx: string; cy: string; rx: string; ry: string }]
  | ["line", { x1: string; y1: string; x2: string; y2: string }]
  | ["path", { d: string }]
  | ["rect", { x: string; y: string; width: string; height: string; rx?: string }];

export function getDocumentMakerShapeLabel(shapeType: DocumentMakerShapeType) {
  return {
    rectangle: "Rectangle",
    roundedRectangle: "Rounded rectangle",
    ellipse: "Ellipse",
    line: "Line",
    arrow: "Arrow",
    triangle: "Triangle",
    callout: "Callout",
    textBox: "Text box",
  }[shapeType];
}

export function getDocumentMakerShapeMarkup(shapeType: DocumentMakerShapeType): ShapeMarkup {
  switch (shapeType) {
    case "ellipse":
      return ["ellipse", { cx: "50", cy: "50", rx: "48", ry: "48" }];
    case "line":
      return ["line", { x1: "2", y1: "2", x2: "98", y2: "98" }];
    case "arrow":
      return ["path", { d: "M0 36H62V10L100 50 62 90V64H0Z" }];
    case "triangle":
      return ["path", { d: "M50 2 98 96H2Z" }];
    case "callout":
      return ["path", { d: "M4 4H96V74H48L28 96V74H4Z" }];
    case "roundedRectangle":
      return ["rect", { x: "2", y: "2", width: "96", height: "96", rx: "12" }];
    case "rectangle":
    case "textBox":
      return ["rect", { x: "2", y: "2", width: "96", height: "96" }];
  }
}
