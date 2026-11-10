import ImageTools from "./ImageTools";

export default function ImageConverter({ onClose }: { onClose: () => void }) {
  return <ImageTools onClose={onClose} lockedMode="convert" />;
}
