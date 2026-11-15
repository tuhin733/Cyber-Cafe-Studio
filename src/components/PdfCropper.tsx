import PdfTools from "./PdfTools";

export default function PdfCropper({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="crop" />;
}
