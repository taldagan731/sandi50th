declare module "canvas-confetti" {
  export type Options = {
    angle?: number;
    colors?: string[];
    decay?: number;
    disableForReducedMotion?: boolean;
    drift?: number;
    gravity?: number;
    origin?: { x?: number; y?: number };
    particleCount?: number;
    scalar?: number;
    shapes?: Array<"circle" | "square" | string>;
    spread?: number;
    startVelocity?: number;
    ticks?: number;
    zIndex?: number;
  };

  export default function confetti(options?: Options): Promise<null> | null;
}
