import PdfTools from "./PdfTools";

export default function PdfUnlocker({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="unlock" />;
}
