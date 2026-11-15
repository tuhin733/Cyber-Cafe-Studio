import { useEffect } from "react";
import { X } from "lucide-react";
import DialogFrame from "./DialogFrame";

interface Props {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <DialogFrame
      labelledBy="about-title"
      describedBy="about-description"
      panelClassName="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 text-center shadow-2xl ring-1 ring-ink-primary/10"
      onBackdropDismiss={onClose}
    >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close about dialog"
          className="absolute right-3 top-3 rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-subtle hover:text-ink-strong"
        >
          <X className="h-4 w-4" />
        </button>
        <img
          src="./cyber_cafe_studio_teal.svg"
          alt=""
          aria-hidden="true"
          className="mx-auto mb-3 h-10 w-10"
        />
        <h2
          id="about-title"
          className="text-lg font-bold tracking-tight text-ink-primary"
        >
          Cyber Cafe Studio
        </h2>
        <p className="mt-1 text-xs font-medium text-ink-faint">
          Version {__APP_VERSION__}
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <section className="rounded-xl border border-ui-subtle bg-surface-muted/70 p-4">
            <h3 className="text-sm font-bold text-ink-primary">
              About Cyber Cafe Studio
            </h3>
            <p
              id="about-description"
              className="mt-2 text-sm leading-relaxed text-ink-secondary"
            >
              Cyber Cafe Studio is a Windows application designed to simplify document
              image arrangement and printing. It helps online service center
              operators combine the front and back sides of documents, such as
              Aadhaar cards and voter IDs, onto a single A4 page.
              Built to solve everyday problems faced by shopkeepers, Cyber Cafe Studio
              makes preparing documents for government portal uploads and
              customer photocopies faster, easier, and more convenient.
            </p>
          </section>
          <section className="rounded-xl border border-ui-subtle bg-surface-muted/70 p-4">
            <h3 className="text-sm font-bold text-ink-primary">About Me</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              I&apos;m Naim Sarkar, a 22-year-old Web and Android Developer
              passionate about creating modern, user-friendly applications. I
              enjoy building practical software solutions, designing clean
              interfaces, and exploring new technologies. My goal is to develop
              useful applications that simplify everyday tasks and deliver a
              smooth user experience.
            </p>
          </section>
        </div>
    </DialogFrame>
  );
}
