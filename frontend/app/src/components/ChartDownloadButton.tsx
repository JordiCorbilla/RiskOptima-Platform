import { type MouseEvent, useState } from "react";
import { Download } from "lucide-react";

const CHART_SCOPE_SELECTOR = ".chart-download-scope, .chart-panel, .rendered-chart, .drawer-section, .mini-chart-block";

function normalizedFilename(filename: string) {
  const safe = filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe || "riskoptima-chart"}.png`;
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = normalizedFilename(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load chart image for export."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode chart image."));
    }, "image/png");
  });
}

async function exportSvgAsPng(svg: SVGSVGElement, filename: string) {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width || Number(svg.getAttribute("width")) || 960));
  const height = Math.max(1, Math.ceil(rect.height || Number(svg.getAttribute("height")) || 540));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", clone.getAttribute("viewBox") ?? `0 0 ${width} ${height}`);

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    text, tspan { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .recharts-cartesian-grid line { stroke: #e5e7eb; }
  `;
  clone.insertBefore(style, clone.firstChild);

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8"
  });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(svgUrl);
    const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create export canvas.");
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const pngBlob = await canvasToBlob(canvas);
    const pngUrl = URL.createObjectURL(pngBlob);
    try {
      triggerDownload(pngUrl, filename);
    } finally {
      URL.revokeObjectURL(pngUrl);
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

interface ChartDownloadButtonProps {
  filename: string;
  imageSrc?: string;
}

export function ChartDownloadButton({ filename, imageSrc }: ChartDownloadButtonProps) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function onDownload(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (status === "working") return;

    setStatus("working");
    try {
      if (imageSrc) {
        triggerDownload(imageSrc, filename);
      } else {
        const scope = event.currentTarget.closest(CHART_SCOPE_SELECTOR);
        const svg = scope?.querySelector("svg");
        if (!(svg instanceof SVGSVGElement)) throw new Error("No chart SVG found to export.");
        await exportSvgAsPng(svg, filename);
      }
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2400);
    }
  }

  return (
    <button
      aria-label={`Download ${filename} chart`}
      className={status === "error" ? "chart-download-button chart-download-button--error" : "chart-download-button"}
      disabled={status === "working"}
      title={status === "error" ? "Chart download failed" : "Download chart as PNG"}
      type="button"
      onClick={onDownload}
    >
      <Download size={15} />
      <span>{status === "working" ? "Exporting" : status === "error" ? "Retry" : "PNG"}</span>
    </button>
  );
}
