// src/render/camera.ts
export type Camera = { scale: number; tx: number; ty: number };

export function makeCamera(): Camera {
  return { scale: 1, tx: 0, ty: 0 };
}

export function applyCamera(ctx: CanvasRenderingContext2D, dpr: number, cam: Camera) {
  ctx.setTransform(cam.scale * dpr, 0, 0, cam.scale * dpr, cam.tx * dpr, cam.ty * dpr);
}

export function zoomAt(cam: Camera, mx: number, my: number, zoom: number) {
  // (mx,my): 화면 좌표(픽셀)
  const wx = (mx - cam.tx) / cam.scale;
  const wy = (my - cam.ty) / cam.scale;
  cam.scale *= zoom;
  cam.tx = mx - wx * cam.scale;
  cam.ty = my - wy * cam.scale;
}

export function fitToView(
  cam: Camera,
  viewW: number,
  viewH: number,
  world: { x: number; y: number; w: number; h: number },
  pad = 40
) {
  const sx = (viewW - pad * 2) / world.w;
  const sy = (viewH - pad * 2) / world.h;
  cam.scale = Math.max(0.05, Math.min(sx, sy));
  const cx = world.x + world.w / 2;
  const cy = world.y + world.h / 2;
  cam.tx = viewW / 2 - cx * cam.scale;
  cam.ty = viewH / 2 - cy * cam.scale;
}

export function fitTopLeft(
  cam: Camera,
  viewW: number,
  viewH: number,
  world: { x: number; y: number; w: number; h: number },
  pad = 24
) {
  // 화면 안에 전부 보이도록 스케일만 정하고, 기준점은 좌상단으로
  const sx = (viewW - pad * 2) / world.w;
  const sy = (viewH - pad * 2) / world.h;
  cam.scale = Math.max(0.05, Math.min(sx, sy));
  cam.tx = pad - world.x * cam.scale;  // 좌측 여백 pad
  cam.ty = pad - world.y * cam.scale;  // 상단 여백 pad
}
