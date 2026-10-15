// @ts-nocheck -- strict index checks relaxed for game math
import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}
function finish(c: HTMLCanvasElement, rx: number, ry: number) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
}

/** Patchwork farmland seen from altitude. */
export const fieldsTexture = () =>
  once("fields", () => {
    const [c, g] = canvas(512, 512);
    const cols = ["#6f8f4a", "#7d9b52", "#8fa65c", "#a49a5a", "#5f7d3f", "#b7a86a", "#6a8a49"];
    for (let y = 0; y < 512; y += 64)
      for (let x = 0; x < 512; x += 64) {
        g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        const w = 64 * (1 + Math.floor(Math.random() * 2));
        g.fillRect(x, y, w, 64);
        g.strokeStyle = "rgba(60,50,30,0.35)";
        g.lineWidth = 2;
        g.strokeRect(x, y, w, 64);
        // crop rows
        g.strokeStyle = "rgba(0,0,0,0.06)";
        for (let i = 0; i < 64; i += 6) {
          g.beginPath();
          g.moveTo(x, y + i);
          g.lineTo(x + w, y + i);
          g.stroke();
        }
      }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(${30 + Math.random() * 40},${50 + Math.random() * 40},20,0.12)`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    return finish(c, 120, 120);
  });

export const grassTexture = () =>
  once("grass", () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = "#6e8f47";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) {
      const l = 35 + Math.random() * 25;
      g.fillStyle = `hsl(${85 + Math.random() * 20},40%,${l}%)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
    return finish(c, 40, 40);
  });

export const runwayTexture = () =>
  once("runway", () => {
    const [c, g] = canvas(256, 1024);
    g.fillStyle = "#3a3c3f";
    g.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 9000; i++) {
      const v = 40 + Math.random() * 30;
      g.fillStyle = `rgb(${v},${v},${v + 3})`;
      g.fillRect(Math.random() * 256, Math.random() * 1024, 1.5, 1.5);
    }
    g.fillStyle = "#ededea";
    for (let y = 20; y < 1024; y += 90) g.fillRect(124, y, 8, 50); // centreline
    g.fillRect(10, 0, 5, 1024);
    g.fillRect(241, 0, 5, 1024);
    // tyre marks
    g.fillStyle = "rgba(15,15,15,0.25)";
    for (let i = 0; i < 40; i++) g.fillRect(90 + Math.random() * 70, Math.random() * 1024, 4, 60 + Math.random() * 120);
    return finish(c, 1, 6);
  });

export const thresholdTexture = () =>
  once("threshold", () => {
    const [c, g] = canvas(256, 128);
    g.fillStyle = "#3a3c3f";
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#ededea";
    for (let i = 0; i < 8; i++) g.fillRect(14 + i * 30 + (i >= 4 ? 8 : 0), 10, 16, 108);
    const t = finish(c, 1, 1);
    return t;
  });

export const asphaltTexture = () =>
  once("asphalt", () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = "#56585a";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = 70 + Math.random() * 30;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
    g.strokeStyle = "rgba(230,190,40,0.8)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(128, 0);
    g.lineTo(128, 256);
    g.stroke();
    return finish(c, 4, 4);
  });

export const carpetTexture = () =>
  once("carpet", () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = "#2d3a5c";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8000; i++) {
      g.fillStyle = `rgba(${80 + Math.random() * 60},${90 + Math.random() * 60},${140 + Math.random() * 60},0.2)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    g.strokeStyle = "rgba(230,140,60,0.35)";
    g.lineWidth = 2;
    for (let i = 0; i < 256; i += 32) {
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(256, i + 16);
      g.stroke();
    }
    return finish(c, 2, 8);
  });

export const fabricTexture = () =>
  once("fabric", () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = "#34507a";
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) {
      g.fillStyle = y % 4 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";
      g.fillRect(0, y, 128, 1);
    }
    return finish(c, 1, 1);
  });

export const cloudSprite = () =>
  once("cloud", () => {
    const [c, g] = canvas(128, 128);
    for (let i = 0; i < 14; i++) {
      const x = 30 + Math.random() * 68;
      const y = 40 + Math.random() * 48;
      const r = 16 + Math.random() * 26;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

export const windowsTexture = () =>
  once("terminalGlass", () => {
    const [c, g] = canvas(256, 64);
    g.fillStyle = "#2c4a5e";
    g.fillRect(0, 0, 256, 64);
    for (let x = 0; x < 256; x += 16) {
      g.fillStyle = `rgba(180,220,240,${0.2 + Math.random() * 0.35})`;
      g.fillRect(x + 1, 4, 14, 56);
    }
    return finish(c, 8, 1);
  });
