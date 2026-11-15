import ImageTools from "./ImageTools";

export default function ImageCropper({ onClose }: { onClose: () => void }) {
  return <ImageTools onClose={onClose} lockedMode="crop" />;
}
