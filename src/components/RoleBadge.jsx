import React from 'react';
import {
  Crown,
  Skull,
  HeartPulse,
  Search,
  Users,
  ShieldAlert,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { ROLES, getRoleImage } from '../shared/roles.js';

export function RoleIcon({ roleId, className = 'w-6 h-6' }) {
  switch (roleId) {
    case 'GAMEMASTER':
      return <Wand2 className={`${className} text-amber-400`} />;
    case 'GODFATHER':
      return <Crown className={`${className} text-rose-400`} />;
    case 'MAFIA':
      return <Skull className={`${className} text-red-400`} />;
    case 'DOCTOR':
      return <HeartPulse className={`${className} text-emerald-400`} />;
    case 'DETECTIVE':
      return <Search className={`${className} text-sky-400`} />;
    case 'VILLAGER':
    default:
      return <Users className={`${className} text-amber-300`} />;
  }
}

export function RoleBadge({ roleId, size = 'sm' }) {
  const role = ROLES[roleId];
  if (!role) return null;
  const sizeClasses =
    size === 'lg'
      ? 'px-3.5 py-1 text-sm font-bold tracking-wider uppercase gap-2'
      : 'px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded border font-serif-title ${role.badgeColor} ${sizeClasses}`}
    >
      <RoleIcon roleId={roleId} className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      {role.name}
    </span>
  );
}

/**
 * Art Deco Obsidian & Gold Card Back (Matches the exact dimensions of RoleCard)
 */
export function ArtDecoCardBack({
  playerName,
  subtitle = 'Tap to Inspect Confidential Dossier',
  onClick,
  buttonLabel,
}) {
  return (
    <div className="mx-auto w-full max-w-[310px]">
      {/* Card Container — identical outer dimensions to RoleCard */}
      <div
        onClick={onClick}
        className={`w-full h-[clamp(360px,56vh,420px)] rounded-[24px] bg-[#141210] p-3.5 border-2 border-[#c6a15b]/80 shadow-[0_25px_60px_rgba(0,0,0,0.95)] select-none flex flex-col ${
          onClick ? 'cursor-pointer hover:border-[#f0cf85] transition-all group' : ''
        }`}
      >
        {/* Outer Gold Filigree Frame */}
        <div className="relative flex-1 min-h-0 rounded-[16px] border-2 border-[#c6a15b]/70 bg-[#0d0c0a] p-2.5 overflow-hidden flex flex-col">
          {/* Corner Art Deco Ornaments */}
          <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute top-2 left-2 z-10" />
          <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute top-2 right-2 z-10" />
          <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute bottom-2 left-2 z-10" />
          <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute bottom-2 right-2 z-10" />

          {/* Geometric Diagonal Lattice */}
          <div
            className="relative flex-1 min-h-0 w-full rounded-lg border border-[#c6a15b]/40 flex flex-col items-center justify-between p-4 text-center"
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(198, 161, 91, 0.14) 0%, rgba(13, 12, 10, 0.96) 70%),
                repeating-linear-gradient(45deg, rgba(198, 161, 91, 0.07) 0px, rgba(198, 161, 91, 0.07) 1px, transparent 1px, transparent 14px),
                repeating-linear-gradient(-45deg, rgba(198, 161, 91, 0.07) 0px, rgba(198, 161, 91, 0.07) 1px, transparent 1px, transparent 14px)
              `,
            }}
          >
            {/* Top Chevron Motif */}
            <div className="text-[10px] font-serif-title tracking-[0.25em] uppercase text-[#c6a15b]/90 border-b border-[#c6a15b]/30 pb-1 px-3">
              Syndicate Confidential
            </div>

            {/* Center Rotated Art Deco Medallion */}
            <div className="relative my-auto flex items-center justify-center">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rotate-45 border-2 border-[#c6a15b] bg-[#141210] shadow-[0_0_25px_rgba(198,161,91,0.2)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <div className="w-20 h-20 sm:w-24 sm:h-24 border border-[#c6a15b]/50 flex items-center justify-center -rotate-45">
                  {/* Noir Detective Silhouette SVG */}
                  <svg
                    className="w-12 h-12 sm:w-14 sm:h-14 text-[#c6a15b]"
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    {/* Fedora Hat */}
                    <path
                      d="M10 26 C20 24, 44 24, 54 26 L44 14 C40 12, 34 15, 32 15 C30 15, 24 12, 20 14 Z"
                      fill="rgba(198,161,91,0.18)"
                    />
                    {/* Trenchcoat Collar & Silhouette */}
                    <path d="M16 54 L22 34 L32 42 L42 34 L48 54" />
                    {/* Magnifying Glass */}
                    <circle cx="24" cy="40" r="6" fill="#141210" />
                    <line x1="19" y1="45" x2="14" y2="50" strokeWidth="3" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Player Name & Action Prompt */}
            <div className="space-y-1 w-full">
              {playerName && (
                <div className="font-serif-title text-lg sm:text-xl font-black tracking-wider uppercase text-[#f5efe2] truncate">
                  {playerName}
                </div>
              )}
              <div className="text-[11px] text-[#c6a15b]/90 leading-snug line-clamp-2">
                {subtitle}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button Directly Below Card */}
      {buttonLabel && (
        <button
          type="button"
          onClick={onClick}
          className="mt-4 w-full py-3.5 px-4 rounded-2xl deco-gold-btn font-serif-title font-black text-xs sm:text-sm uppercase tracking-widest text-center transition"
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Vintage Cream Art Deco Tarot Role Card (Matches the exact dimensions of ArtDecoCardBack)
 */
export function RoleCard({
  roleId,
  fellowMafia = [],
  compact = false,
  actionLabel,
  onAction,
  imageUrl,
  variantIndex,
}) {
  const role = ROLES[roleId];
  if (!role) return null;
  const resolvedImage = imageUrl || getRoleImage(roleId, variantIndex);

  if (compact) {
    return (
      <div className="rounded-2xl bg-[#efe6d5] text-[#181615] p-2.5 shadow-2xl border-2 border-[#c6a15b]/60">
        <div className="rounded-xl border-2 border-[#1b1917] p-3 flex items-center gap-3.5 bg-[#f5efe2]">
          <div className="w-16 h-20 rounded-lg overflow-hidden border-2 border-[#1b1917] shrink-0 shadow-md bg-stone-900">
            <img
              src={resolvedImage}
              onError={(e) => {
                if (e.currentTarget.src !== role.image) {
                  e.currentTarget.src = role.image;
                }
              }}
              alt={role.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-serif-title font-bold uppercase tracking-[0.2em] text-stone-600">
              {role.team === 'MAFIA'
                ? 'Syndicate'
                : role.team === 'MODERATOR'
                ? 'Moderator'
                : 'Town Alliance'}
            </div>
            <div className="text-xl font-serif-title font-black uppercase tracking-wider text-[#141210] truncate">
              {role.name}
            </div>
            <div className="text-xs text-stone-700 italic leading-snug">{role.tagline}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[310px]">
      {/* Cream Tarot Card Stock — identical outer dimensions to ArtDecoCardBack */}
      <div className="w-full h-[clamp(360px,56vh,420px)] rounded-[24px] bg-gradient-to-b from-[#f5efe2] via-[#efe5d2] to-[#e5d8c0] p-3.5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] border-2 border-[#d6c7ad] text-[#181615] select-none flex flex-col">
        {/* Outer Thick Ink Art Deco Frame */}
        <div className="relative flex-1 min-h-0 rounded-[16px] border-[3px] border-[#1c1a17] p-2.5 flex flex-col justify-between bg-[#f4ece0]">
          {/* Top Left & Right Circular Art Deco Corner Rivets */}
          <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -top-1.5 -left-1.5 z-10">
            <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
          </div>
          <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -top-1.5 -right-1.5 z-10">
            <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
          </div>

          {/* Bottom Left & Right Circular Art Deco Corner Rivets */}
          <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -bottom-1.5 -left-1.5 z-10">
            <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
          </div>
          <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -bottom-1.5 -right-1.5 z-10">
            <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
          </div>

          {/* Top Title Banner */}
          <div className="py-1 text-center border-b-2 border-[#1c1a17] shrink-0">
            <h3 className="font-serif-title text-xl sm:text-2xl font-black uppercase tracking-[0.18em] text-[#141210]">
              {role.name}
            </h3>
          </div>

          {/* Center Noir Illustration Frame */}
          <div className="my-2 relative flex-1 min-h-0 rounded-lg border-[3px] border-[#1c1a17] overflow-hidden bg-[#0e0d0c] shadow-inner">
            <img
              src={resolvedImage}
              onError={(e) => {
                if (e.currentTarget.src !== role.image) {
                  e.currentTarget.src = role.image;
                }
              }}
              alt={role.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.65)] pointer-events-none" />
            <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-sm border border-[#c6a15b]/50 rounded px-2 py-1 text-center">
              <div className="text-[9.5px] sm:text-[10px] font-serif-title uppercase tracking-[0.09em] leading-snug text-[#e5c365] font-bold">
                {role.tagline}
              </div>
            </div>
          </div>

          {/* Bottom Title Banner */}
          <div className="py-1 text-center border-t-2 border-[#1c1a17] shrink-0">
            <div className="font-serif-title text-lg sm:text-xl font-black uppercase tracking-[0.18em] text-[#141210]">
              {role.name}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Next/Conceal Button Directly Below the Card */}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 w-full py-3.5 px-4 rounded-2xl deco-gold-btn font-serif-title font-black text-xs sm:text-sm uppercase tracking-widest text-center transition"
        >
          {actionLabel}
        </button>
      )}

      {/* Role Dossier Briefing Below the Button */}
      <div className="mt-4 rounded-2xl deco-panel p-4 text-left space-y-2.5">
        <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
          {role.description}
        </p>
        <div className="pt-2 border-t border-[#c6a15b]/20 flex items-center gap-2 text-xs text-[#e5c365]">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>
            <strong>Night Directive:</strong> {role.nightAction}
          </span>
        </div>

        {role.team === 'MAFIA' && fellowMafia.length > 0 && (
          <div className="pt-2 border-t border-rose-500/30">
            <p className="text-[11px] uppercase tracking-widest text-rose-300 font-bold mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Known Syndicate Operatives
            </p>
            <div className="flex flex-wrap gap-1.5">
              {fellowMafia.map((m) => (
                <span
                  key={m.id}
                  className="text-xs px-2.5 py-1 rounded bg-rose-950/90 border border-rose-500/40 text-rose-200 font-semibold"
                >
                  {m.name} ({ROLES[m.role]?.name || 'Mafia'})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 3D Flippable Tarot Role Card (Animates between ArtDecoCardBack and RoleCard in 3D space)
 */
export function FlippableRoleCard({
  isFlipped,
  playerName,
  subtitle = 'Tap Card to Flip & Inspect Your Secret Identity',
  roleId,
  fellowMafia = [],
  onFlip,
  onNext,
  flipButtonLabel,
  nextButtonLabel,
  isTransitioning = false,
  imageUrl,
  variantIndex,
}) {
  const role = ROLES[roleId];
  if (!role) return null;
  const resolvedImage = imageUrl || getRoleImage(roleId, variantIndex);

  return (
    <div className="mx-auto w-full max-w-[310px]">
      {/* 3D Perspective Stage */}
      <div className="w-full h-[clamp(360px,56vh,420px)] card-perspective select-none">
        <div className={`card-flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
          {/* BACK FACE (Obsidian & Gold Filigree Deck Back) */}
          <div
            onClick={() => {
              if (!isFlipped && !isTransitioning && onFlip) onFlip();
            }}
            className={`card-face rounded-[24px] bg-[#141210] p-3.5 border-2 border-[#c6a15b]/80 shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col ${
              !isFlipped && !isTransitioning
                ? 'cursor-pointer hover:border-[#f0cf85] group'
                : ''
            }`}
          >
            <div className="relative flex-1 min-h-0 rounded-[16px] border-2 border-[#c6a15b]/70 bg-[#0d0c0a] p-2.5 overflow-hidden flex flex-col">
              <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute top-2 left-2 z-10" />
              <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute top-2 right-2 z-10" />
              <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute bottom-2 left-2 z-10" />
              <div className="w-3.5 h-3.5 border-2 border-[#c6a15b] absolute bottom-2 right-2 z-10" />

              <div
                className="relative flex-1 min-h-0 w-full rounded-lg border border-[#c6a15b]/40 flex flex-col items-center justify-between p-4 text-center"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 50% 50%, rgba(198, 161, 91, 0.14) 0%, rgba(13, 12, 10, 0.96) 70%),
                    repeating-linear-gradient(45deg, rgba(198, 161, 91, 0.07) 0px, rgba(198, 161, 91, 0.07) 1px, transparent 1px, transparent 14px),
                    repeating-linear-gradient(-45deg, rgba(198, 161, 91, 0.07) 0px, rgba(198, 161, 91, 0.07) 1px, transparent 1px, transparent 14px)
                  `,
                }}
              >
                <div className="text-[10px] font-serif-title tracking-[0.25em] uppercase text-[#c6a15b]/90 border-b border-[#c6a15b]/30 pb-1 px-3">
                  Syndicate Confidential
                </div>

                <div className="relative my-auto flex items-center justify-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rotate-45 border-2 border-[#c6a15b] bg-[#141210] shadow-[0_0_25px_rgba(198,161,91,0.2)] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 border border-[#c6a15b]/50 flex items-center justify-center -rotate-45">
                      <svg
                        className="w-12 h-12 sm:w-14 sm:h-14 text-[#c6a15b]"
                        viewBox="0 0 64 64"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path
                          d="M10 26 C20 24, 44 24, 54 26 L44 14 C40 12, 34 15, 32 15 C30 15, 24 12, 20 14 Z"
                          fill="rgba(198,161,91,0.18)"
                        />
                        <path d="M16 54 L22 34 L32 42 L42 34 L48 54" />
                        <circle cx="24" cy="40" r="6" fill="#141210" />
                        <line x1="19" y1="45" x2="14" y2="50" strokeWidth="3" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 w-full">
                  {playerName && (
                    <div className="font-serif-title text-lg sm:text-xl font-black tracking-wider uppercase text-[#f5efe2] truncate">
                      {playerName}
                    </div>
                  )}
                  <div className="text-[11px] text-[#c6a15b]/90 leading-snug line-clamp-2">
                    {subtitle}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FRONT FACE (Cream Tarot Role Card) */}
          <div className="card-face card-face-front rounded-[24px] bg-gradient-to-b from-[#f5efe2] via-[#efe5d2] to-[#e5d8c0] p-3.5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] border-2 border-[#d6c7ad] text-[#181615] flex flex-col">
            <div className="relative flex-1 min-h-0 rounded-[16px] border-[3px] border-[#1c1a17] p-2.5 flex flex-col justify-between bg-[#f4ece0]">
              <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -top-1.5 -left-1.5 z-10">
                <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
              </div>
              <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -top-1.5 -right-1.5 z-10">
                <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
              </div>
              <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -bottom-1.5 -left-1.5 z-10">
                <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
              </div>
              <div className="w-5 h-5 rounded-full border-[3px] border-[#1c1a17] bg-[#f4ece0] flex items-center justify-center absolute -bottom-1.5 -right-1.5 z-10">
                <div className="w-2 h-2 rounded-full bg-[#1c1a17]" />
              </div>

              <div className="py-1 text-center border-b-2 border-[#1c1a17] shrink-0">
                <h3 className="font-serif-title text-xl sm:text-2xl font-black uppercase tracking-[0.18em] text-[#141210]">
                  {role.name}
                </h3>
              </div>

              <div className="my-2 relative flex-1 min-h-0 rounded-lg border-[3px] border-[#1c1a17] overflow-hidden bg-[#0e0d0c] shadow-inner">
                <img
                  src={resolvedImage}
                  onError={(e) => {
                    if (e.currentTarget.src !== role.image) {
                      e.currentTarget.src = role.image;
                    }
                  }}
                  alt={role.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.65)] pointer-events-none" />
                <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-sm border border-[#c6a15b]/50 rounded px-2 py-1 text-center">
                  <div className="text-[9.5px] sm:text-[10px] font-serif-title uppercase tracking-[0.09em] leading-snug text-[#e5c365] font-bold">
                    {role.tagline}
                  </div>
                </div>
              </div>

              <div className="py-1 text-center border-t-2 border-[#1c1a17] shrink-0">
                <div className="font-serif-title text-lg sm:text-xl font-black uppercase tracking-[0.18em] text-[#141210]">
                  {role.name}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button Directly Below the Card */}
      <button
        type="button"
        disabled={isTransitioning}
        onClick={isFlipped ? onNext : onFlip}
        className="mt-4 w-full py-3.5 px-4 rounded-2xl deco-gold-btn disabled:opacity-60 font-serif-title font-black text-xs sm:text-sm uppercase tracking-widest text-center transition"
      >
        {isFlipped ? nextButtonLabel : flipButtonLabel}
      </button>

      {/* Role Dossier Briefing Below the Button (Revealed when flipped) */}
      {isFlipped && (
        <div className="mt-4 rounded-2xl deco-panel p-4 text-left space-y-2.5 animate-fadeIn">
          <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
            {role.description}
          </p>
          <div className="pt-2 border-t border-[#c6a15b]/20 flex items-center gap-2 text-xs text-[#e5c365]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              <strong>Night Directive:</strong> {role.nightAction}
            </span>
          </div>

          {role.team === 'MAFIA' && fellowMafia.length > 0 && (
            <div className="pt-2 border-t border-rose-500/30">
              <p className="text-[11px] uppercase tracking-widest text-rose-300 font-bold mb-1.5 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Known Syndicate Operatives
              </p>
              <div className="flex flex-wrap gap-1.5">
                {fellowMafia.map((m) => (
                  <span
                    key={m.id}
                    className="text-xs px-2.5 py-1 rounded bg-rose-950/90 border border-rose-500/40 text-rose-200 font-semibold"
                  >
                    {m.name} ({ROLES[m.role]?.name || 'Mafia'})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RoleSettingsEditor({
  playerCount,
  settings,
  onUpdateSettings,
  isEditable = true,
}) {
  const counts = settings.roleCounts || {};
  const totalAssigned = Object.values(counts).reduce((a, b) => a + b, 0);

  const adjustRole = (roleKey, delta) => {
    if (!isEditable) return;
    const nextCounts = { ...counts };
    const current = nextCounts[roleKey] || 0;
    const updated = Math.max(0, current + delta);

    if (roleKey !== 'VILLAGER') {
      const diff = updated - current;
      if (diff > 0 && (nextCounts.VILLAGER || 0) >= diff) {
        nextCounts.VILLAGER -= diff;
        nextCounts[roleKey] = updated;
      } else if (diff < 0) {
        nextCounts.VILLAGER = (nextCounts.VILLAGER || 0) - diff;
        nextCounts[roleKey] = updated;
      } else {
        return;
      }
    } else {
      nextCounts[roleKey] = updated;
    }

    onUpdateSettings({
      ...settings,
      autoCustomRoles: false,
      roleCounts: nextCounts,
    });
  };

  return (
    <div className="rounded-2xl deco-panel p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c6a15b]/20 pb-3">
        <div>
          <h3 className="text-base font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
            Syndicate Role Deck
          </h3>
          <p className="text-xs text-stone-400">
            Total Citizen Cards: {totalAssigned} / {Math.max(4, playerCount)} Citizens
          </p>
        </div>

        {isEditable && (
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                autoCustomRoles: !settings.autoCustomRoles,
              })
            }
            className={`text-xs px-3 py-1.5 rounded-lg border font-serif-title font-bold uppercase tracking-wider transition ${
              settings.autoCustomRoles
                ? 'bg-[#c6a15b]/20 text-[#e5c365] border-[#c6a15b]/50'
                : 'bg-stone-900 text-stone-300 border-white/10 hover:border-[#c6a15b]/40'
            }`}
          >
            {settings.autoCustomRoles ? 'Auto-Balance: ON' : 'Custom Deck'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {['GODFATHER', 'MAFIA', 'DOCTOR', 'DETECTIVE', 'VILLAGER'].map((roleKey) => {
          const r = ROLES[roleKey];
          const val = counts[roleKey] || 0;
          return (
            <div
              key={roleKey}
              className="flex items-center justify-between p-2 rounded-xl bg-stone-950/90 border border-[#c6a15b]/20"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={r.image}
                  alt={r.name}
                  className="w-9 h-11 rounded object-cover border border-[#c6a15b]/40 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#f5efe2] truncate">
                    {r.name}
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">
                    {r.id === 'GODFATHER'
                      ? 'Appears Innocent'
                      : r.team === 'MAFIA'
                      ? 'Mafia Syndicate'
                      : 'Town Alliance'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isEditable && roleKey !== 'VILLAGER' && (
                  <button
                    type="button"
                    onClick={() => adjustRole(roleKey, -1)}
                    disabled={val <= 0}
                    className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-[#f5efe2] font-bold text-xs flex items-center justify-center border border-[#c6a15b]/30"
                  >
                    -
                  </button>
                )}
                <span className="w-5 text-center font-bold text-sm text-[#e5c365]">
                  {val}
                </span>
                {isEditable && roleKey !== 'VILLAGER' && (
                  <button
                    type="button"
                    onClick={() => adjustRole(roleKey, 1)}
                    disabled={(counts.VILLAGER || 0) <= 0}
                    className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-[#f5efe2] font-bold text-xs flex items-center justify-center border border-[#c6a15b]/30"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-[#c6a15b]/20 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={!isEditable}
          onClick={() =>
            isEditable &&
            onUpdateSettings({
              ...settings,
              doctorSelfSave: !settings.doctorSelfSave,
            })
          }
          className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/70 border border-[#c6a15b]/20 text-left text-xs"
        >
          <span className="text-stone-300">Doctor Can Self-Save</span>
          <span
            className={`px-2 py-0.5 rounded font-bold ${
              settings.doctorSelfSave
                ? 'bg-[#c6a15b]/20 text-[#e5c365]'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {settings.doctorSelfSave ? 'YES' : 'NO'}
          </span>
        </button>

        <button
          type="button"
          disabled={!isEditable}
          onClick={() =>
            isEditable &&
            onUpdateSettings({
              ...settings,
              revealRoleOnDeath: !settings.revealRoleOnDeath,
            })
          }
          className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/70 border border-[#c6a15b]/20 text-left text-xs"
        >
          <span className="text-stone-300">Reveal Role on Death</span>
          <span
            className={`px-2 py-0.5 rounded font-bold ${
              settings.revealRoleOnDeath
                ? 'bg-[#c6a15b]/20 text-[#e5c365]'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {settings.revealRoleOnDeath ? 'YES' : 'NO'}
          </span>
        </button>
      </div>
    </div>
  );
}
