export type Vec3 = [number, number, number];
export type Side = "left" | "right";

export interface LayoutItem {
  pos: Vec3;
  rot: Vec3;
  isDouble: boolean;
}
