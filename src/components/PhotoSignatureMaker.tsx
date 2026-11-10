import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CalendarDays, ImagePlus, PenLine, UserRound } from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import { getThemeColor } from "../theme/theme";
import { notifyUserError } from "../lib/userErrors";
import { notifyUserSuccess } from "../lib/userNotifications";

interface LoadedImage {
  file: File;
  url: string;
  image: HTMLImageElement;
}

type CaptionMode = "signature" | "name-date";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const OUTPUT_WIDTH = 1200;
const MAX_OUTPUT_HEIGHT = 16_000;

function loadImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ file, url, image });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to open ${file.name}. The image may be damaged or unsupported.`));
    };
    image.src = url;
  });
}

function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function drawComposition(
  photo: LoadedImage,
  mode: CaptionMode,
  signature: LoadedImage | null,
  name: string,
  date: string,
): HTMLCanvasElement {
  const photoScale = Math.min(
    OUTPUT_WIDTH / photo.image.naturalWidth,
    MAX_OUTPUT_HEIGHT / photo.image.naturalHeight,
  );
  const photoWidth = Math.round(photo.image.naturalWidth * photoScale);
  const photoHeight = Math.round(photo.image.naturalHeight * photoScale);
  const footerHeight = mode === "signature" ? 210 : 190;
  const canvas = document.createElement("canvas");
  canvas.width = photoWidth;
  canvas.height = photoHeight + footerHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.fillStyle = getThemeColor("image-output-background");
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(photo.image, 0, 0, photoWidth, photoHeight);
  context.fillStyle = getThemeColor("ink-strong");
  context.textAlign = "center";
  context.textBaseline = "middle";

  if (mode === "signature") {
    if (!signature) throw new Error("Upload a signature image first.");
    const maxWidth = photoWidth * 0.72;
    const maxHeight = footerHeight * 0.68;
    const scale = Math.min(
      maxWidth / signature.image.naturalWidth,
      maxHeight / signature.image.naturalHeight,
    );
    const signatureWidth = signature.image.naturalWidth * scale;
    const signatureHeight = signature.image.naturalHeight * scale;
    context.drawImage(
      signature.image,
      (photoWidth - signatureWidth) / 2,
      photoHeight + 12,
      signatureWidth,
      signatureHeight,
    );
    context.font = "500 24px sans-serif";
    context.fillText("Signature", photoWidth / 2, photoHeight + footerHeight - 22);
  } else {
    context.font = "600 38px sans-serif";
    context.fillText(`Name: ${name.trim()}`, photoWidth / 2, photoHeight + 64, photoWidth * 0.92);
    context.fillText(`Date: ${formatDate(date)}`, photoWidth / 2, photoHeight + 130, photoWidth * 0.92);
  }

  return canvas;
}

function exportPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The image could not be exported."));
    }, "image/png");
  });
}

const uploadClassName =
  "mt-2 block w-full cursor-pointer rounded-xl border border-ui bg-surface px-3 py-2.5 text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-action-subtle file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-action hover:file:bg-action-soft";

const captionModes: {
  id: CaptionMode;
  title: string;
  description: string;
  Icon: typeof PenLine;
}[] = [
  {
    id: "signature",
    title: "Signature",
    description: "Place a signature image below the photo.",
    Icon: PenLine,
  },
  {
    id: "name-date",
    title: "Name & date",
    description: "Print a name and date below the photo.",
    Icon: UserRound,
  },
];

export default function PhotoSignatureMaker({ onClose }: { onClose: () => void }) {
  const [photo, setPhoto] = useState<LoadedImage | null>(null);
  const [signature, setSignature] = useState<LoadedImage | null>(null);
  const [mode, setMode] = useState<CaptionMode>("signature");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const photoRef = useRef<LoadedImage | null>(null);
  const signatureRef = useRef<LoadedImage | null>(null);
  const photoRequestRef = useRef(0);
  const signatureRequestRef = useRef(0);

  useEffect(() => () => {
    photoRequestRef.current += 1;
    signatureRequestRef.current += 1;
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    if (signatureRef.current) URL.revokeObjectURL(signatureRef.current.url);
  }, []);

  const loadFile = async (file: File | undefined, target: "photo" | "signature") => {
    if (!file) return;
    if (!file.type.startsWith("image/") || !file.size) {
      notifyUserError("Choose a valid image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notifyUserError("Choose an image smaller than 50 MB.");
      return;
    }

    const requestRef = target === "photo" ? photoRequestRef : signatureRequestRef;
    const currentRef = target === "photo" ? photoRef : signatureRef;
    const setImage = target === "photo" ? setPhoto : setSignature;
    const requestId = ++requestRef.current;

    try {
      const loaded = await loadImage(file);
      if (requestId !== requestRef.current) {
        URL.revokeObjectURL(loaded.url);
        return;
      }
      if (loaded.image.naturalWidth * loaded.image.naturalHeight > 100_000_000) {
        URL.revokeObjectURL(loaded.url);
        throw new Error("This image is too large to process safely.");
      }
      if (currentRef.current) URL.revokeObjectURL(currentRef.current.url);
      currentRef.current = loaded;
      setImage(loaded);
    } catch (error) {
      console.error(`Could not load the ${target} image:`, error);
      notifyUserError(error instanceof Error ? error.message : `Couldn't load the ${target} image.`);
    }
  };

  const downloadImage = async () => {
    if (!photo) {
      notifyUserError("Upload a photo before downloading.");
      return;
    }
    if (mode === "signature" && !signature) {
      notifyUserError("Upload a signature image before downloading.");
      return;
    }
    if (mode === "name-date" && (!name.trim() || !date)) {
      notifyUserError("Enter both a name and date before downloading.");
      return;
    }

    setIsExporting(true);
    try {
      const canvas = drawComposition(photo, mode, signature, name, date);
      const blob = await exportPng(canvas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "photo-with-signature.png";
      if (mode === "name-date") link.download = "photo-with-name-and-date.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifyUserSuccess("Photo downloaded.");
    } catch (error) {
      console.error("Could not export the photo composition:", error);
      notifyUserError(error instanceof Error ? error.message : "Couldn't export the photo.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToToolsButton onClick={onClose} toolName="Photo + Signature / Name & Date" />
          <button
            type="button"
            onClick={() => void downloadImage()}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-sm transition hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis disabled:cursor-wait disabled:opacity-60"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            {isExporting ? "Creating image…" : "Download PNG"}
          </button>
        </div>

        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
          <section className="rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-6" aria-label="Photo and caption options">
            <h1 className="text-lg font-bold text-ink-primary">Photo details</h1>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Add a signature image or print a name and date beneath your photo.
            </p>

            <label className="mt-5 block text-sm font-medium text-ink-secondary">
              Photo
              <input
                type="file"
                accept="image/*"
                className={uploadClassName}
                onChange={(event) => {
                  void loadFile(event.currentTarget.files?.[0], "photo");
                  event.currentTarget.value = "";
                }}
              />
            </label>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-ink-secondary">What to add below the photo</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {captionModes.map(({ id, title, description, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    aria-pressed={mode === id}
                    className={`rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${
                      mode === id
                        ? "border-action-border-strong bg-action-subtle"
                        : "border-ui bg-surface hover:border-ui-strong"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                      <Icon className="h-4 w-4 text-action" aria-hidden="true" />
                      {title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-ink-secondary">{description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {mode === "signature" ? (
              <label className="mt-5 block text-sm font-medium text-ink-secondary">
                Signature image
                <input
                  type="file"
                  accept="image/*"
                  className={uploadClassName}
                  onChange={(event) => {
                    void loadFile(event.currentTarget.files?.[0], "signature");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink-secondary">
                  Name
                  <span className="relative mt-2 block">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={100}
                      placeholder="Full name"
                      className="w-full rounded-xl border border-ui bg-surface py-2.5 pl-9 pr-3 text-sm text-ink-primary outline-none placeholder:text-ink-faint focus:border-action focus:ring-4 focus:ring-action-subtle/70"
                    />
                  </span>
                </label>
                <label className="block text-sm font-medium text-ink-secondary">
                  Date
                  <span className="relative mt-2 block">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="w-full rounded-xl border border-ui bg-surface py-2.5 pl-9 pr-3 text-sm text-ink-primary outline-none focus:border-action focus:ring-4 focus:ring-action-subtle/70"
                    />
                  </span>
                </label>
              </div>
            )}
          </section>

          <section className="lg:sticky lg:top-5" aria-label="Photo preview">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-secondary">Preview</h2>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
                PNG
              </span>
            </div>
            <div className="mx-auto flex min-h-72 w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-xl border border-ui bg-surface p-3 shadow-xl sm:p-5">
              {photo ? (
                <>
                  <img src={photo.url} alt="Uploaded photo" className="block h-auto max-h-[60vh] w-full object-contain" />
                  {mode === "signature" ? (
                    signature ? (
                      <div className="flex h-24 w-full flex-col items-center justify-center pt-2">
                        <img src={signature.url} alt="Uploaded signature" className="max-h-16 max-w-[72%] object-contain" />
                        <span className="mt-1 text-xs text-ink-muted">Signature</span>
                      </div>
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center text-sm text-ink-muted">
                        Upload a signature image
                      </div>
                    )
                  ) : (
                    <div className="flex min-h-24 w-full flex-col items-center justify-center gap-2 border-t border-ui pt-3 text-center">
                      <p className="max-w-full break-words text-sm font-semibold text-ink-primary">
                        Name: {name || "Your name"}
                      </p>
                      <p className="text-sm text-ink-secondary">Date: {date ? formatDate(date) : "Choose a date"}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-action-subtle text-action">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium text-ink-secondary">Upload a photo to preview your result.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
