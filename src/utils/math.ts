export const manhattan = (a: {x:number;y:number}, b:{x:number;y:number}) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const snap = (v:number, grid:number) => Math.round(v / grid) * grid;
export const snapUp = (v:number, grid:number) => Math.ceil(v / grid) * grid;
export const intersects = (a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) =>
  !(a.x+a.w <= b.x || b.x+b.w <= a.x || a.y+a.h <= b.y || b.y+b.h <= a.y);
