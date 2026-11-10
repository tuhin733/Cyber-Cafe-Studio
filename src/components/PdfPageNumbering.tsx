import PdfTools from "./PdfTools";

export default function PdfPageNumbering({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="page-numbers" />;
}
