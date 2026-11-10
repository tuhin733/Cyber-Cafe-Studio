import PdfTools from "./PdfTools";

export default function PdfPageOrganizer({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="organize" />;
}
