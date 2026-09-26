// The loading_* status line for each boot and load step (current-app-inventory.md §1).
import type { BootStep } from "@/session/boot";
import type { LoadStep } from "@/session/playlistLoad";

export const BOOT_STEP_KEYS = {
  identifying_device: "loading_identifying_device",
  finding_server: "loading_finding_server",
  server_busy: "mobile_loading_server_busy",
  verifying_device: "loading_verifying_device",
  registering_device: "loading_registering_device",
  account: "loading_account",
} as const satisfies Record<BootStep, string>;

export const LOAD_STEP_KEYS = {
  playlist: "loading_playlist",
  provider: "loading_provider",
  portal: "loading_portal",
  streams: "loading_streams",
  almost_ready: "loading_almost_ready",
} as const satisfies Record<LoadStep, string>;
