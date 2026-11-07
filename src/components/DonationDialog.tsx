import { useEffect, useState } from "react";
import { X } from "lucide-react";
import DialogFrame from "./DialogFrame";

interface Props {
  onClose: () => void;
}

export default function DonationDialog({ onClose }: Props) {
  const [selectedAmount, setSelectedAmount] = useState(15);
  const amounts = [5, 15, 25, 50];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <DialogFrame
      labelledBy="donation-title"
      describedBy="donation-description"
      panelClassName="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-surface p-6 text-center shadow-2xl ring-1 ring-ink-primary/10"
      onBackdropDismiss={onClose}
    >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close donation dialog"
          className="absolute right-3 top-3 rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-subtle hover:text-ink-strong"
        >
          <X className="h-4 w-4" />
        </button>
        <h2
          id="donation-title"
          className="text-lg font-bold tracking-tight text-ink-primary"
        >
          Support Cyber Cafe Studio
        </h2>
        <p className="mt-1 text-xs font-medium text-ink-faint">
          Created by Naim Sarkar
        </p>
        <p id="donation-description" className="mt-1 text-sm text-ink-muted">
          Every contribution helps keep the project growing.
        </p>
        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold text-ink-muted">
            Choose an amount
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {amounts.map((amount) => (
              <button
                key={amount}
                type="button"
                aria-pressed={selectedAmount === amount}
                onClick={() => setSelectedAmount(amount)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis ${
                  selectedAmount === amount
                    ? "border-action-emphasis bg-action-emphasis text-ink-inverse shadow-sm"
                    : "border-ui bg-surface text-ink-secondary hover:border-action-border-strong hover:bg-action-subtle hover:text-action"
                }`}
              >
                ₹{amount}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          Scan the QR code and enter ₹{selectedAmount} in your UPI app.
        </p>
        <img
          src="./donation-qr.jpeg"
          alt="Donation QR code"
          className="mx-auto mt-3 w-full max-w-[220px] rounded-lg object-contain"
        />
    </DialogFrame>
  );
}
