import PdfTools from "./PdfTools";

export default function PdfWatermarkAdder({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="add-watermark" />;
}
