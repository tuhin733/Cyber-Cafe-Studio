import ImageTools from "./ImageTools";

export default function ImageResizer({ onClose }: { onClose: () => void }) {
  return <ImageTools onClose={onClose} lockedMode="resize" />;
}
