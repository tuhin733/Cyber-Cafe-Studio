import PdfTools from "./PdfTools";

export default function ImageToPdf({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="image-to-pdf" />;
}
