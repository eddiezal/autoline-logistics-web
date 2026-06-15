/**
 * PortalPreviewCard. Homepage preview of the customer portal IN-TRANSIT stage.
 *
 * Static visual rebuild of the actual <TrackingMapModule> component from
 * src/components/portal/stages/InTransitStage.tsx. Mirrors the real portal's
 * design language (dark-green status header, lime accents, route map, 3-col
 * summary row) without pulling in Mapbox or any portal data dependencies, so
 * the homepage bundle stays paid-ad-friendly.
 *
 * No interactivity. Visitors who want to play with the real portal sign up
 * and book a shipment. The hand-rebuilt SVG route is "good enough" for the
 * homepage hook, light enough not to move LCP.
 *
 * Drift note: when the real TrackingMapModule visual language evolves, this
 * needs a manual refresh pass. The real component lives at
 * src/components/portal/stages/InTransitStage.tsx (TrackingStatusHeader fn).
 */

export function PortalPreviewCard({
  urlBar,
  driverFirstName,
  titlePrefix,
  destCityHeadline,
  statusConfidence,
  statusEta,
  statusLocation,
  originEyebrow,
  currentEyebrow,
  destEyebrow,
  originCity,
  currentCity,
  currentTime,
  destCityFull,
  destEtaLabel,
}: {
  urlBar: string;
  driverFirstName: string;
  titlePrefix: string;
  destCityHeadline: string;
  statusConfidence: string;
  statusEta: string;
  statusLocation: string;
  originEyebrow: string;
  currentEyebrow: string;
  destEyebrow: string;
  originCity: string;
  currentCity: string;
  currentTime: string;
  destCityFull: string;
  destEtaLabel: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-2xl shadow-black/15 max-w-[480px] mx-auto lg:mx-0">
      {/* Minimal browser chrome. Just enough context that this is "a page" */}
      <div className="bg-gray-100 px-3.5 py-2 flex items-center gap-2.5 border-b border-gray-200">
        <div className="flex gap-1.5 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff6058]" aria-hidden="true" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" aria-hidden="true" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" aria-hidden="true" />
        </div>
        <div className="flex-1 bg-white border border-gray-200 rounded-md px-2.5 py-0.5 text-[10px] text-gray-500 font-mono truncate">
          {urlBar}
        </div>
      </div>

      {/* Dark-green status header — mirrors TrackingStatusHeader.
          Linear gradient matches the real portal exactly. */}
      <div
        className="flex items-start gap-3 px-4 py-3.5"
        style={{ background: "linear-gradient(90deg, #052e1a 0%, #0b3b24 100%)" }}
      >
        {/* Truck icon bubble. 36px circle, #16a34a green. */}
        <div
          className="grid place-items-center flex-shrink-0 w-9 h-9 rounded-full"
          style={{ background: "#16a34a", color: "#ffffff" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="14" height="11" rx="1" />
            <path d="M15 8h4l4 4v3h-8z" />
            <circle cx="5.5" cy="17.5" r="2" fill="currentColor" />
            <circle cx="18.5" cy="17.5" r="2" fill="currentColor" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="text-white text-[15px] font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-brand-display)" }}
          >
            {driverFirstName} {titlePrefix}{" "}
            <span style={{ color: "#86efac" }}>{destCityHeadline}</span>
          </h3>
          {/* Status meta — 3 lines with leading icons, matching the real portal */}
          <div className="mt-2 space-y-1 text-[11px] font-semibold" style={{ color: "#d1fae5" }}>
            <p className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {statusConfidence}
            </p>
            <p className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {statusEta}
            </p>
            <p className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {statusLocation}
            </p>
          </div>
        </div>
      </div>

      {/* Static SVG route map. Replaces the Mapbox dark-v11 of the real portal.
          Lime traveled portion + slate-dashed remaining + truck at split point. */}
      <div className="relative h-[160px]" style={{ background: "#0f1729" }}>
        <svg viewBox="0 0 480 160" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
          {/* Subtle grid — gives the map a sense of "tiled" geography */}
          <defs>
            <pattern id="portal-preview-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#portal-preview-grid)" />

          {/* Remaining route (slate-dashed). Drawn first so traveled overlays. */}
          <path
            d="M 290 78 Q 350 60, 410 52 T 455 48"
            fill="none"
            stroke="#475569"
            strokeWidth="3"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />

          {/* Traveled route (lime solid). */}
          <path
            d="M 28 110 Q 110 80, 200 92 T 290 78"
            fill="none"
            stroke="#84cc16"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Origin marker (Beverly Hills) */}
          <circle cx="28" cy="110" r="7" fill="#84cc16" stroke="#ffffff" strokeWidth="2" />
          <circle cx="28" cy="110" r="2.5" fill="#ffffff" />

          {/* Destination marker (Austin) */}
          <circle cx="455" cy="48" r="7" fill="#ffffff" stroke="#84cc16" strokeWidth="2.5" />
          <circle cx="455" cy="48" r="2.5" fill="#84cc16" />

          {/* Truck at current location — at the lime/slate-dashed split */}
          <g transform="translate(290 78) rotate(-12)">
            {/* Truck body */}
            <rect x="-14" y="-8" width="20" height="13" rx="2" fill="#84cc16" stroke="#0f1729" strokeWidth="1.5" />
            {/* Cab */}
            <rect x="6" y="-5" width="8" height="10" rx="1.5" fill="#a3e635" stroke="#0f1729" strokeWidth="1.5" />
            {/* Window */}
            <rect x="8" y="-3" width="4" height="4" fill="#0f1729" opacity="0.5" />
            {/* Wheels */}
            <circle cx="-8" cy="6" r="2.5" fill="#0f1729" />
            <circle cx="10" cy="6" r="2.5" fill="#0f1729" />
          </g>

          {/* Subtle glow under truck — implies motion */}
          <ellipse cx="290" cy="82" rx="22" ry="3" fill="#84cc16" opacity="0.18" />
        </svg>
      </div>

      {/* Origin / Current / Destination summary row.
          Center column gets a soft lime tint to signal "current". */}
      <div className="grid grid-cols-3 divide-x divide-gray-200">
        <div className="px-3 py-3.5">
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            {originEyebrow}
          </p>
          <p className="text-[12px] font-bold text-charcoal leading-tight">
            {originCity}
          </p>
        </div>
        <div className="px-3 py-3.5" style={{ background: "rgba(132,204,22,0.06)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "#15803d" }}>
            {currentEyebrow}
          </p>
          <p className="text-[12px] font-bold text-charcoal leading-tight">
            {currentCity}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">{currentTime}</p>
        </div>
        <div className="px-3 py-3.5">
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            {destEyebrow}
          </p>
          <p className="text-[12px] font-bold text-charcoal leading-tight">
            {destCityFull}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">{destEtaLabel}</p>
        </div>
      </div>
    </div>
  );
}
