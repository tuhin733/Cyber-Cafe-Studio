import { useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  FileStack,
  Image,
  ImageMinus,
  PenTool,
  Rocket,
  Search,
  SquareUserRound,
} from "lucide-react";

interface Props {
  onOpenDocumentEditor: () => void;
  onOpenDocumentMaker: () => void;
  onOpenApplicationMaker: () => void;
  onOpenResumeMaker: () => void;
  onOpenPassportPhotoMaker: () => void;
  onOpenBackgroundRemover: () => void;
  onOpenImageTools: () => void;
  onOpenPdfTools: () => void;
  onOpenDesignStudio: () => void;
}

const tools = [
  {
    id: "documents",
    title: "Doc Stitch",
    description: "Arrange, resize, and print documents on A4 pages.",
    action: "Open editor",
    Icon: FileText,
  },
  {
    id: "document-maker",
    title: "Document Maker",
    description: "Write and format documents in English, Bangla, and Hindi.",
    action: "Start writing",
    Icon: FileText,
  },
  {
    id: "application-maker",
    title: "Application Maker",
    description: "Create school, workplace, bank, government, and personal applications in English, Bangla, or Hindi.",
    action: "Create an application",
    Icon: ClipboardList,
  },
  {
    id: "resume-maker",
    title: "Resume Maker",
    description: "Build a polished resume with classic, modern, or minimal templates.",
    action: "Create a resume",
    Icon: FileText,
  },
  {
    id: "passport",
    title: "Passport Photo Maker",
    description: "Create correctly sized passport and ID photo sheets.",
    action: "Make passport photos",
    Icon: SquareUserRound,
  },
  {
    id: "image-tools",
    title: "Image Tools",
    description: "Resize photos and signatures, compress files, and convert image formats.",
    action: "Open image tools",
    Icon: Image,
  },
  {
    id: "pdf-tools",
    title: "PDF Tools",
    description: "Merge, split, compress, convert, and organize PDF files.",
    action: "Open PDF tools",
    Icon: FileStack,
  },
  {
    id: "design-studio",
    title: "Design Studio",
    description: "Create social graphics, posters, and custom designs on a flexible canvas.",
    action: "Start designing",
    Icon: PenTool,
  },
  {
    id: "background",
    title: "Background Remover",
    description: "Remove or replace the background in a portrait.",
    action: "Remove background",
    Icon: ImageMinus,
  },
] as const;

export default function ToolHome({
  onOpenDocumentEditor,
  onOpenDocumentMaker,
  onOpenApplicationMaker,
  onOpenResumeMaker,
  onOpenPassportPhotoMaker,
  onOpenBackgroundRemover,
  onOpenImageTools,
  onOpenPdfTools,
  onOpenDesignStudio,
}: Props) {
  const [query, setQuery] = useState("");
  const visibleTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return tools;
    return tools.filter((tool) =>
      `${tool.title} ${tool.description}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  const openTool = (toolId: (typeof tools)[number]["id"]) => {
    if (toolId === "documents") onOpenDocumentEditor();
    if (toolId === "document-maker") onOpenDocumentMaker();
    if (toolId === "application-maker") onOpenApplicationMaker();
    if (toolId === "resume-maker") onOpenResumeMaker();
    if (toolId === "passport") onOpenPassportPhotoMaker();
    if (toolId === "background") onOpenBackgroundRemover();
    if (toolId === "image-tools") onOpenImageTools();
    if (toolId === "pdf-tools") onOpenPdfTools();
    if (toolId === "design-studio") onOpenDesignStudio();
  };

  return (
    <main className="app-home-background scrollbar-hidden relative min-h-0 flex-1 overflow-y-auto bg-fixed">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-5 py-8 sm:px-8 sm:py-10">
        <header className="mx-auto mb-2 flex items-center justify-center gap-3 sm:mb-3">
          <img
            src="./cyber_cafe_studio_teal.svg"
            alt=""
            className="h-14 w-14 shrink-0"
            aria-hidden="true"
          />
          <div className="text-left">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
                Cyber Cafe Studio
              </span>
            </div>
            <span className="mt-0.5 block text-sm text-ink-secondary sm:text-base">
              Made for cyber cafe owners
            </span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink-primary sm:text-5xl">
            Everything your cyber cafe needs.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-secondary sm:text-base sm:leading-7">
            Prepare documents, create passport and ID photos, and edit images and PDFs—all in one easy-to-use workspace.
          </p>

        </div>

        <label className="sticky top-4 z-10 mx-auto mt-7 flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-ui bg-surface px-5 py-4 text-left shadow-sm transition duration-200 focus-within:border-action focus-within:shadow-md focus-within:shadow-action/10 focus-within:ring-4 focus-within:ring-action-subtle/70">
          <Search className="h-5 w-5 shrink-0 text-action" aria-hidden="true" />
          <span className="sr-only">Search tools</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents, photos, image tools, and PDFs..."
            className="w-full bg-transparent text-sm text-ink-primary outline-none placeholder:text-ink-muted sm:text-base"
          />
        </label>

        <section
          className="mx-auto mt-10 w-full max-w-6xl sm:mt-12"
          aria-label="Available tools"
        >
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-ink-primary">
              Explore your tools
            </h2>
            <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary">
              {visibleTools.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTools.map(({ id, title, description, action, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => openTool(id)}
                className="group flex min-h-56 flex-col items-start rounded-2xl border border-ui bg-surface p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-action-border-strong hover:shadow-lg hover:shadow-ink-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-action-subtle text-action">
                  <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="mt-4 text-base font-semibold tracking-tight text-ink-primary">
                  {title}
                </span>
                <span className="mt-2 text-sm leading-6 text-ink-secondary">
                  {description}
                </span>
                <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-action">
                  {action}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </button>
            ))}
            {visibleTools.length === 0 && (
              <p className="col-span-full rounded-2xl border border-dashed border-ui-strong bg-surface px-6 py-10 text-center text-sm text-ink-muted">
                No tools found. Try a different search.
              </p>
            )}
          </div>
        </section>

        <footer className="mx-auto mt-8 flex items-center justify-center gap-2 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <Rocket className="h-4 w-4 text-action-emphasis" aria-hidden="true" />
            More tools coming soon
          </span>
        </footer>
      </div>
    </main>
  );
}
