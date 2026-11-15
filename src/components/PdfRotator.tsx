import PdfTools from "./PdfTools";

export default function PdfRotator({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="rotate" />;
}
