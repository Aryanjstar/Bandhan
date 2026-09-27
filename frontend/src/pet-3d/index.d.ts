import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from 'react';

export type PetActivity = 'idle' | 'walk' | 'run' | 'jump' | 'eat' | 'drink' | 'sniff' | 'headShake';

export interface PetDigitalTwinProps {
  sensorData?: unknown;
  activity?: PetActivity;
  activityMode?: 'automatic' | 'manual';
  playing?: boolean;
  staleAfterMs?: number;
  connected?: boolean;
  modelUrl?: string;
  modelConfig?: unknown;
  revision?: number;
  onComplete?: (revision: number) => void;
  onModelInfo?: (info: unknown) => void;
  onSensorError?: (err: unknown) => void;
  headAction?: string;
  className?: string;
  style?: CSSProperties;
}

export interface PetDigitalTwinHandle {
  calibrate(): boolean;
  resetCalibration(): void;
  getState(): unknown;
}

export const PetDigitalTwin: ForwardRefExoticComponent<PetDigitalTwinProps & RefAttributes<PetDigitalTwinHandle>>;
export function normalizePetSensorFrame(payload: unknown, opts?: { gyroUnit?: 'deg/s' | 'rad/s' }): unknown;
export const createSensorFrame: typeof normalizePetSensorFrame;
export const DOG_MODEL_URL: string;
export const DOG_RIG_CONFIG: unknown;
