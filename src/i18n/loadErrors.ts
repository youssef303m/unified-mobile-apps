// The Playlists / Portals banner text for a failed load (current-app-inventory.md §6, §8).
import type { LoadFailure } from "@/session/playlistLoad";

export function loadErrorKey(failure: LoadFailure) {
  switch (failure.error) {
    case "playlist_expired":
      return "mobile_playlist_error_expired";
    case "portal_expired":
      return "mobile_portal_error_expired";
    case "portal_unavailable":
      return "mobile_portal_error_unavailable";
    case "no_url":
      return "mobile_playlist_error_no_url";
    case "all_failed":
      return "mobile_playlist_error_all_failed";
    case "aborted":
      return failure.screen === "portals"
        ? "mobile_portal_error_aborted"
        : "mobile_playlist_error_aborted";
    case "playlist_generic":
      return "mobile_playlist_error_generic";
  }
}
