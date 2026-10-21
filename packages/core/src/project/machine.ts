export type ControllerKind = "F2100K" | "GRBL" | "LinuxCNC" | "Mach3" | "grblHAL";

/** Machine profile (design screen L2 · Profile maszyn). */
export interface MachineProfile {
  id: string;
  name: string;
  description?: string;
  controller: ControllerKind;
  postId: string;
  workAreaMm: { x: number; y: number };
  /** Torch swirl direction. CW swirl → good side on the right → outer CW, holes CCW (spec §5.1). */
  swirl: "CW" | "CCW";
  hasTHC: boolean;
  /** Write pierce/cut heights (Z) into the program. Off when heights are set on the controller. */
  heightsInProgram: boolean;
  travelHeightMm: number;
  ihs: "none" | "beforePierce" | "everyN";
  /** Controller performs cutter compensation (G41/G42). GRBL cannot → CAM offsets geometry. */
  controllerCompensation: boolean;
  rapidMmMin: number;
  /** Program zero relative to the sheet. Design R: "Lewy górny · X+ w prawo, Y+ w dół". */
  origin: "top-left" | "bottom-left";
  originOffsetMm: { x: number; y: number };
  marker?: { offsetXMm: number; offsetYMm: number };
}

export const toploong1325: MachineProfile = {
  id: "toploong-1325",
  name: "Toploong 1325",
  description: "Fangling F2100K v5.0, THC (ARC VOL-DIV), IHS microswitch, CUT80CNC",
  controller: "F2100K",
  postId: "f2100k",
  workAreaMm: { x: 2500, y: 1250 },
  swirl: "CW",
  hasTHC: true,
  heightsInProgram: false,
  travelHeightMm: 10,
  ihs: "beforePierce",
  controllerCompensation: false,
  rapidMmMin: 12000,
  origin: "top-left",
  originOffsetMm: { x: 0, y: 0 },
  marker: { offsetXMm: 62, offsetYMm: 0 },
};

export const grblTable: MachineProfile = {
  id: "grbl-table",
  name: "Stół warsztatowy",
  description: "GRBL 1.1 (np. MKS DLC32), przekaźnik łuku, bez THC",
  controller: "GRBL",
  postId: "grbl",
  workAreaMm: { x: 1000, y: 1000 },
  swirl: "CW",
  hasTHC: false,
  heightsInProgram: false,
  travelHeightMm: 10,
  ihs: "none",
  controllerCompensation: false,
  rapidMmMin: 6000,
  origin: "bottom-left",
  originOffsetMm: { x: 0, y: 0 },
};
