import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import heroBannerUrl from '../assets/images/hero_verified_circle_1791364909906.jpg';
import avatarMemberOneUrl from '../assets/images/avatar_member_one_1791364920587.jpg';
import avatarMemberTwoUrl from '../assets/images/avatar_member_two_1791364932817.jpg';
import badgeSealUrl from '../assets/images/badge_identity_seal_1791364942012.jpg';

export const VISUAL_ASSETS = Object.freeze({
  heroBanner: heroBannerUrl,
  avatarOne: avatarMemberOneUrl,
  avatarTwo: avatarMemberTwoUrl,
  badgeSeal: badgeSealUrl,
});

interface ResilientImageProps {
  readonly src: string;
  readonly alt: string;
  readonly className?: string;
  readonly fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200 p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <ShieldCheck className="w-6 h-6 text-slate-400 mb-1.5" />
        {fallbackLabel && (
          <span className="text-xs font-medium text-slate-300 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
