import type * as Leaflet from "leaflet";
import { riskGradientRgb } from "@/lib/safego/risk-model";

export interface HeatPoint {
  coordinates: [number, number];
  score: number;
}

export interface RiskHeatLayer extends Leaflet.Layer {
  setPoints(points: HeatPoint[]): this;
}

// Pixels per sample. The coarse grid is upscaled with smoothing, which also blurs the edges.
const CELL_PX = 4;
// Keeps each area visible when zoomed out to the whole country.
const MIN_RADIUS_PX = 60;
const MAX_ALPHA = 0.62;
const METERS_PER_DEGREE_LAT = 111_320;

const COLORS = Array.from({ length: 101 }, (_, score) => riskGradientRgb(score));

/**
 * A risk surface rather than a density heatmap: each pixel shows the distance-weighted
 * average score of nearby locations, and fades out where SafeGo has no data, so
 * clustered locations never look riskier than their own scores and empty areas never look safe.
 */
export function createRiskHeatLayer(
  L: typeof Leaflet,
  { radiusMeters, pane }: { radiusMeters: number; pane: string },
): RiskHeatLayer {
  class Layer extends L.Layer implements RiskHeatLayer {
    private points: HeatPoint[] = [];
    private canvas: HTMLCanvasElement | null = null;
    private zooming = false;
    private readonly sample = document.createElement("canvas");

    constructor() {
      super();
      L.Util.setOptions(this, { pane });
    }

    setPoints(points: HeatPoint[]) {
      this.points = points;
      // Mid-zoom the map is not settled yet; moveend redraws with these points.
      if (!this.zooming) this.reset();
      return this;
    }

    onAdd(map: Leaflet.Map) {
      this.canvas = L.DomUtil.create("canvas", "risk-heat-layer");
      this.getPane()?.appendChild(this.canvas);
      map.on("zoomstart", this.hide, this);
      map.on("moveend resize", this.settle, this);
      this.reset();
      return this;
    }

    onRemove(map: Leaflet.Map) {
      map.off("zoomstart", this.hide, this);
      map.off("moveend resize", this.settle, this);
      this.canvas?.remove();
      this.canvas = null;
      return this;
    }

    // The canvas can't scale with Leaflet's zoom animation, so it fades out and redraws after.
    private hide() {
      this.zooming = true;
      if (this.canvas) this.canvas.style.opacity = "0";
    }

    private settle() {
      this.zooming = false;
      this.reset();
    }

    private reset() {
      if (!this._map || !this.canvas) return;
      const size = this._map.getSize();
      L.DomUtil.setPosition(this.canvas, this._map.containerPointToLayerPoint([0, 0]));
      this.canvas.width = size.x;
      this.canvas.height = size.y;
      this.draw();
      this.canvas.style.opacity = "1";
    }

    private draw() {
      const map = this._map;
      const context = this.canvas?.getContext("2d");
      if (!map || !this.canvas || !context) return;

      const size = map.getSize();
      const columns = Math.ceil(size.x / CELL_PX);
      const rows = Math.ceil(size.y / CELL_PX);
      const sources = this.points.map(({ coordinates, score }) => {
        const center = map.latLngToContainerPoint(coordinates);
        const edge = map.latLngToContainerPoint([coordinates[0] + radiusMeters / METERS_PER_DEGREE_LAT, coordinates[1]]);
        const radius = Math.max(MIN_RADIUS_PX, Math.abs(center.y - edge.y)) / CELL_PX;
        return { x: center.x / CELL_PX, y: center.y / CELL_PX, radiusSquared: radius * radius, color: COLORS[Math.round(Math.max(0, Math.min(100, score)))] };
      });

      this.sample.width = columns;
      this.sample.height = rows;
      const sampleContext = this.sample.getContext("2d");
      if (!sampleContext) return;
      const image = sampleContext.createImageData(columns, rows);

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          let weightSum = 0;
          let colorWeightSum = 0;
          let red = 0;
          let green = 0;
          let blue = 0;
          for (const source of sources) {
            const dx = column - source.x;
            const dy = row - source.y;
            const distance = (dx * dx + dy * dy) / source.radiusSquared;
            if (distance > 6) continue;
            const weight = Math.exp(-distance);
            weightSum += weight;
            // Colour follows the nearest location closely; coverage (alpha) uses the wider falloff.
            // Blending colours rather than scores keeps band edges (e.g. 59 to 60) from turning into hard borders.
            const colorWeight = weight ** 6;
            colorWeightSum += colorWeight;
            red += colorWeight * source.color[0];
            green += colorWeight * source.color[1];
            blue += colorWeight * source.color[2];
          }
          if (weightSum < 0.01) continue;
          const offset = (row * columns + column) * 4;
          image.data[offset] = red / colorWeightSum;
          image.data[offset + 1] = green / colorWeightSum;
          image.data[offset + 2] = blue / colorWeightSum;
          image.data[offset + 3] = Math.round(255 * MAX_ALPHA * Math.min(1, weightSum * 1.4));
        }
      }

      sampleContext.putImageData(image, 0, 0);
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(this.sample, 0, 0, columns * CELL_PX, rows * CELL_PX);
    }
  }

  return new Layer();
}
