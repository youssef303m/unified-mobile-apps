// The message for a section that failed to download (architecture.md "Error handling": a
// failed request is never shown as an empty list).
import { AuthError, NetworkError, TimeoutError } from "@/api/errors";

export function sectionErrorKey(error: unknown) {
  if (error instanceof AuthError)
    return error.reason === "portal_expired" || error.reason === "portal_unavailable"
      ? "mobile_portal_error_unavailable"
      : "mobile_playlist_error_generic";
  if (error instanceof NetworkError || error instanceof TimeoutError)
    return "mobile_verify_network_error";
  return "msg_data_loading_failed";
}
