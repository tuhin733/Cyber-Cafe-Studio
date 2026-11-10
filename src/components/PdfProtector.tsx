import PdfTools from "./PdfTools";

export default function PdfProtector({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="protect" />;
}
