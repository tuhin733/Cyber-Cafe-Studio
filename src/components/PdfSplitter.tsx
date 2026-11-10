import PdfTools from "./PdfTools";

export default function PdfSplitter({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="split" />;
}
