import ImageTools from "./ImageTools";

export default function ImageCompressor({ onClose }: { onClose: () => void }) {
  return <ImageTools onClose={onClose} lockedMode="compress" />;
}
