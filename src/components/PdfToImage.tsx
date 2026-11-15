import PdfTools from "./PdfTools";

export default function PdfToImage({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="pdf-to-image" />;
}
