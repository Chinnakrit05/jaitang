"use client";

import { useTranslations } from "next-intl";

/**
 * What the screen shows while a scanned receipt is being read.
 *
 * Reading a photo takes several seconds — long enough that a small
 * spinner in the corner of a form reads as "nothing happened". This
 * takes the screen: a scrim over the form, and the receipt itself with
 * a beam passing over it, which is the thing that is actually going on.
 *
 * The motion is SMIL inside the SVG rather than CSS keyframes. It is one
 * element with no stylesheet in between, so it cannot be dropped by a
 * class name that did not survive, and it keeps its own timeline —
 * `svg.setCurrentTime()` steps it, which is how the sweep was checked
 * without watching it.
 */
export function ScanLoadingOverlay() {
  const t = useTranslations();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,20,16,0.45)] backdrop-blur-[2.5px]"
    >
      <div className="w-[178px] rounded-[24px] soft-raised px-[18px] pt-5 pb-[18px] flex flex-col items-center gap-1.5">
        <svg
          viewBox="0 4 96 84"
          width="96"
          height="84"
          aria-hidden="true"
          className="block"
        >
          <defs>
            <linearGradient id="jt-scan-beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#4cc9f0" stopOpacity="0" />
              <stop offset=".5" stopColor="#4cc9f0" stopOpacity="1" />
              <stop offset="1" stopColor="#4cc9f0" stopOpacity="0" />
            </linearGradient>
            <filter
              id="jt-scan-glow"
              x="-60%"
              y="-300%"
              width="220%"
              height="700%"
            >
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
          </defs>

          {/* The slip, breathing slightly so the card never looks frozen
              even at the ends of the sweep. */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -3; 0 0"
              dur="2.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.5;1"
              keySplines=".4 0 .6 1;.4 0 .6 1"
            />
            <path
              d="M22 13 A5 5 0 0 1 27 8 H69 A5 5 0 0 1 74 13 V82
                 l-5.2 4 l-5.2 -4 l-5.2 4 l-5.2 -4 l-5.2 4
                 l-5.2 -4 l-5.2 4 l-5.2 -4 l-5.2 4 l-5.2 -4 Z"
              fill="#ffffff"
            />
            <rect x="30" y="19" width="30" height="4" rx="2" fill="#E6DCD1" />
            <rect x="30" y="29" width="22" height="4" rx="2" fill="#E6DCD1" />
            <rect x="30" y="39" width="30" height="4" rx="2" fill="#E6DCD1" />
            <rect x="30" y="49" width="20" height="4" rx="2" fill="#E6DCD1" />
            <rect x="30" y="59" width="28" height="4" rx="2" fill="#E6DCD1" />
          </g>

          {/* Down to the bottom and back up, over and over: values with
              three stops rather than a `from`/`to`, so there is no jump
              back to the top between passes. */}
          <rect
            x="14"
            y="12"
            width="68"
            height="5"
            fill="url(#jt-scan-beam)"
            opacity=".55"
            filter="url(#jt-scan-glow)"
          >
            <animate
              attributeName="y"
              values="12;76;12"
              dur="2.7s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.5;1"
              keySplines=".42 0 .58 1;.42 0 .58 1"
            />
          </rect>
          <rect
            x="14"
            y="13"
            width="68"
            height="2"
            rx="1"
            fill="url(#jt-scan-beam)"
          >
            <animate
              attributeName="y"
              values="13;77;13"
              dur="2.7s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.5;1"
              keySplines=".42 0 .58 1;.42 0 .58 1"
            />
          </rect>
        </svg>

        <div>
          <p className="m-0 text-[12.5px] font-semibold text-(--peach-fg) text-center">
            {t("ocr.reading")}
          </p>
          <p className="mt-0.5 mb-0 text-[10.5px] text-(--muted) text-center">
            {t("ocr.readingSub")}
          </p>
        </div>
      </div>
    </div>
  );
}
