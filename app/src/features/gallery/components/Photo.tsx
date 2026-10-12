import { type GalleryPhoto } from '@/core/api/gallery';
import { Icon } from '@/shared/components/Icon';
import { useState } from 'react';

export function Photo({ photo, label, alt }: { photo: GalleryPhoto; label: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="civic-photo-fallback">
      <Icon name="image" size={20} />
      <span>{label}</span>
    </div>
  ) : (
    <img
      src={photo.src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
