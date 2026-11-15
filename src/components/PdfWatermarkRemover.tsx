import PdfTools from "./PdfTools";

export default function PdfWatermarkRemover({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="remove-watermark" />;
}
