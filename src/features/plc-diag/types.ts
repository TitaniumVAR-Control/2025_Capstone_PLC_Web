export interface DiagAck {
  ok: boolean;
  rs_code?: string | null;
  response_raw?: string | null;
  elapsed_ms: number;
  error?: string | null;
}

export interface DiagConnection {
  connected: boolean;
  host: string;
  port: number;
  error?: string | null;
}

export interface DiagDefaults {
  hmi_host: string;
  hmi_port: number;
  chamber_temp_source: string;
  rotation_primary_rpm: number;
  rotation_secondary_rpm: number;
  rotation_direction: number;
  tilt_steps: number[][];
  lift_start_position_mm: number;
  lift_pulse_speed_rpm: number;
  lift_pulse_up_dist_mm: number;
}

export interface DiagRg1 {
  ok: boolean;
  raw?: string | null;
  parsed?: Record<string, unknown> | null;
  elapsed_ms: number;
  error?: string | null;
}

export type LogLevel = 'info' | 'ok' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  label: string;
  message: string;
}
