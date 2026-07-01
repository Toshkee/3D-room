// A cute little robot face, matching the 3D bots — accent head, dark visor,
// glowing cyan eyes, antenna. Used as the 2D avatar in lists/chat/panels so the
// UI and the scene read as one product.
export function RobotFace({ accent, size = 48 }: { accent: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      style={{ display: 'block' }}
    >
      {/* antenna */}
      <line x1="32" y1="6" x2="32" y2="15" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3.4" fill={accent} />
      {/* ears */}
      <rect x="5" y="30" width="5" height="12" rx="2.5" fill={accent} />
      <rect x="54" y="30" width="5" height="12" rx="2.5" fill={accent} />
      {/* head */}
      <rect x="10" y="13" width="44" height="42" rx="15" fill={accent} />
      {/* clay sheen */}
      <ellipse cx="32" cy="24" rx="17" ry="8" fill="#ffffff" opacity="0.16" />
      {/* visor */}
      <rect x="16" y="23" width="32" height="22" rx="11" fill="#171226" />
      {/* eyes */}
      <circle cx="25" cy="33" r="4.1" fill="#8ff0ff" />
      <circle cx="39" cy="33" r="4.1" fill="#8ff0ff" />
      <circle cx="26.2" cy="31.6" r="1.3" fill="#ffffff" />
      <circle cx="40.2" cy="31.6" r="1.3" fill="#ffffff" />
      {/* smile */}
      <path d="M27 40 q5 4 10 0" stroke="#8ff0ff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}
