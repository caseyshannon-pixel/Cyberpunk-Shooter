export interface GridItem {
  x: number;
  y: number;
  radius: number;
}

/**
 * Uniform grid for broad-phase circle queries. Rebuilt every tick: items are
 * bucketed by centre cell, and queries widen their search by the largest
 * radius inserted, so each item lives in exactly one cell (no de-duplication
 * needed) yet big enemies are still found.
 */
export class SpatialGrid<T extends GridItem> {
  private readonly cells: T[][];
  private readonly cols: number;
  private readonly rows: number;
  private maxRadius = 0;

  constructor(
    private readonly originX: number,
    private readonly originY: number,
    width: number,
    height: number,
    private readonly cellSize: number,
  ) {
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const c of this.cells) c.length = 0;
    this.maxRadius = 0;
  }

  insert(item: T): void {
    const cx = this.col(item.x);
    const cy = this.row(item.y);
    this.cells[cy * this.cols + cx].push(item);
    if (item.radius > this.maxRadius) this.maxRadius = item.radius;
  }

  /** Collect items whose circles may overlap the query circle into `out` (cleared first). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const reach = r + this.maxRadius;
    const c0 = this.col(x - reach);
    const c1 = this.col(x + reach);
    const r0 = this.row(y - reach);
    const r1 = this.row(y + reach);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const cell = this.cells[row * this.cols + col];
        for (let i = 0; i < cell.length; i++) out.push(cell[i]);
      }
    }
    return out;
  }

  private col(x: number): number {
    const c = Math.floor((x - this.originX) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private row(y: number): number {
    const r = Math.floor((y - this.originY) / this.cellSize);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }
}
