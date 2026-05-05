// Shared constants for Campaign navigation system
// Single source of truth — used by CampaignSelection, CassetteCard, TapeProgress

// --- Design-time reference dimensions (the "ideal" card at 460px container) ---
const REF_CONTAINER = 460;
const REF_CARD_W = 320;
const REF_CARD_H = 480;
const REF_GAP = 40;

/**
 * Computes responsive card & carousel metrics based on actual container width.
 * On mobile the container fills 100 vw, so cards scale proportionally.
 */
export function getMetrics(containerWidth: number) {
  // Ratio relative to the reference design
  const ratio = Math.min(containerWidth / REF_CONTAINER, 1.15);
  const cardWidth  = Math.round(REF_CARD_W * ratio);
  const cardHeight = Math.round(REF_CARD_H * ratio);
  const gap        = Math.round(REF_GAP * ratio);
  const step       = cardWidth + gap;
  const centerOffset = Math.round((containerWidth - cardWidth) / 2);

  return { cardWidth, cardHeight, gap, step, centerOffset, ratio };
}

// Minimum px to consider a drag vs. tap
export const DRAG_THRESHOLD = 6;

// Spring configs — tuned for natural, subtle feel
export const SNAP_SPRING = { type: "spring" as const, stiffness: 260, damping: 26 };
export const INDICATOR_SPRING = { type: "spring" as const, stiffness: 280, damping: 28 };

// Legacy named exports kept for any external consumers
export const CARD_WIDTH = REF_CARD_W;
export const CARD_GAP = REF_GAP;
export const CARD_STEP = REF_CARD_W + REF_GAP;
export const CONTAINER_WIDTH = REF_CONTAINER;
export const CENTER_OFFSET = Math.round((REF_CONTAINER - REF_CARD_W) / 2);
