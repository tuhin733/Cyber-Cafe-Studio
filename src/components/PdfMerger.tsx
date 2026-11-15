import PdfTools from "./PdfTools";

export default function PdfMerger({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="merge" />;
}
