import PdfTools from "./PdfTools";

export default function PdfPageDeleter({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="delete-pages" />;
}
