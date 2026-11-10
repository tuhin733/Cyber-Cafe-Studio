import PdfTools from "./PdfTools";

export default function PdfCompressor({ onClose }: { onClose: () => void }) {
  return <PdfTools onClose={onClose} lockedOperation="compress" />;
}
