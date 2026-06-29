export default function Logo({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="40" height="40" rx="9" fill="#2B5A27" stroke="#1A1918" strokeWidth="1.5" />

      {/* Hook: rises from shoulder apex, curves right like a real hanger hook */}
      <path
        d="M20 17 L20 11 C20 8 22.5 7.5 24.5 9"
        stroke="#CCCAC5"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left shoulder */}
      <line x1="20" y1="17" x2="7" y2="30" stroke="#CCCAC5" strokeWidth="2.5" strokeLinecap="round" />

      {/* Right shoulder */}
      <line x1="20" y1="17" x2="33" y2="30" stroke="#CCCAC5" strokeWidth="2.5" strokeLinecap="round" />

      {/* Bottom bar */}
      <line x1="7" y1="30" x2="33" y2="30" stroke="#CCCAC5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
