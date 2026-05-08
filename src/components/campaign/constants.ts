// Shared constants for Campaign navigation system
// Single source of truth — used by CampaignSelection, CassetteCard, TapeProgress

// --- Design-time reference dimensions (the "ideal" card at 460px container) ---
const REF_CONTAINER = 460;
const REF_CARD_W = 320;
const REF_CARD_H = 480;
const REF_GAP = 40;

/**
 * Computes responsive card & carousel metrics based on actual container size.
 * On mobile the container fills 100 vw/vh, so cards scale proportionally to fit within both dimensions.
 */
export function getMetrics(containerWidth: number, containerHeight: number) {
  // Ratio relative to the reference design
  const widthRatio = containerWidth / REF_CONTAINER;
  
  // We want the card height (REF_CARD_H = 480) to fit within containerHeight
  // with some padding (e.g., 64px for top/bottom margins in the flex container).
  // If containerHeight is 0 (initial load), default to widthRatio.
  const heightRatio = containerHeight > 0 ? (containerHeight - 64) / REF_CARD_H : widthRatio;
  
  // Choose the smallest ratio so it doesn't overflow horizontally OR vertically.
  // We also limit it to 1.15 to avoid massive cards on ultra-wide screens.
  const ratio = Math.min(widthRatio, heightRatio, 1.15);
  
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
