import "server-only";
import type { DeviceCommandType } from "@drip-tv/shared";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  captureScreenshot,
  factoryReset,
  powerOff,
  powerOn,
  reboot,
  type AmazonResult,
} from "@/lib/amazon/signage-client";

/**
 * Commands that we route to Amazon's Signage API when the device has an
 * `amazon_device_id` set. Anything else stays in the queue for the player to
 * pick up via realtime/polling.
 */
const HARDWARE_COMMANDS: ReadonlySet<DeviceCommandType> = new Set([
  "reboot",
  "power_on",
  "power_off",
  "factory_reset",
  "screenshot",
]);

export type DeviceCommandRow = {
  id: string;
  device_id: string;
  type: DeviceCommandType;
  payload: Record<string, unknown> | null;
  status: "queued" | "sent" | "ack" | "failed";
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  acked_at: string | null;
  result: Record<string, unknown> | null;
};

export type DispatchOutcome = {
  routed: "amazon" | "player";
  status: DeviceCommandRow["status"];
  result: Record<string, unknown> | null;
};

export function isHardwareCommand(type: DeviceCommandType): boolean {
  return HARDWARE_COMMANDS.has(type);
}

/**
 * Routes a queued device_commands row.
 *
 *   - Player-level (force_refresh / clear_cache / reload_config): leaves the
 *     row in `queued` so the player can pick it up next poll/sub. Returns
 *     `{ routed: 'player' }`.
 *   - Hardware (reboot / power / factory / screenshot): calls Amazon via
 *     `signage-client`. On success → `status='sent'` with `sent_at` stamped
 *     and the Amazon result body merged into `result`. Failure modes
 *     (no `amazon_device_id`, creds missing, upstream error) all return
 *     `status='failed'` with a structured `result` describing the reason so
 *     the UI can render something useful.
 *
 * Screenshot URLs are recorded in `result.screenshot_url`. We do NOT attempt
 * to download + re-upload to Supabase Storage right now — Amazon's URLs are
 * typically signed and short-lived, so the URL itself is the deliverable.
 * (See TODO below if we later want to persist the PNG.)
 */
export async function dispatchCommand(
  command: DeviceCommandRow,
): Promise<DispatchOutcome> {
  if (!isHardwareCommand(command.type)) {
    return { routed: "player", status: "queued", result: null };
  }

  const service = createSupabaseServiceClient();

  // Need the device's amazon_device_id + org_id (for screenshot storage path).
  const { data: device, error: deviceErr } = await service
    .from("devices")
    .select("id, org_id, amazon_device_id")
    .eq("id", command.device_id)
    .single();

  if (deviceErr || !device) {
    return persistFailure(service, command.id, {
      code: "DEVICE_NOT_FOUND",
      detail: deviceErr?.message ?? null,
    });
  }

  if (!device.amazon_device_id) {
    return persistFailure(service, command.id, {
      code: "NO_AMAZON_DEVICE_ID",
      warning:
        "Device has no amazon_device_id set; hardware commands cannot be routed.",
    });
  }

  const amazonId = device.amazon_device_id as string;
  let amazonResult: AmazonResult<Record<string, unknown>>;

  switch (command.type) {
    case "reboot":
      amazonResult = await reboot(amazonId);
      break;
    case "power_on":
      amazonResult = await powerOn(amazonId);
      break;
    case "power_off":
      amazonResult = await powerOff(amazonId);
      break;
    case "factory_reset":
      amazonResult = await factoryReset(amazonId);
      break;
    case "screenshot":
      amazonResult = await captureScreenshot(amazonId);
      break;
    default:
      // Defensive — HARDWARE_COMMANDS guards this, but TS narrowing wants it.
      return persistFailure(service, command.id, {
        code: "UNKNOWN_HARDWARE_COMMAND",
        type: command.type,
      });
  }

  if (!amazonResult.ok) {
    // AMAZON_API_NOT_CONFIGURED is special: we treat it as "deferred" — the
    // row stays queued so a future config can pick it up. Everything else is
    // a hard failure.
    if (amazonResult.code === "AMAZON_API_NOT_CONFIGURED") {
      const result = {
        code: amazonResult.code,
        warning: amazonResult.warning ?? null,
      };
      const { error } = await service
        .from("device_commands")
        .update({ result })
        .eq("id", command.id);
      if (error) {
        // best-effort; we still report routed=amazon so the caller knows.
      }
      return { routed: "amazon", status: "queued", result };
    }

    return persistFailure(service, command.id, {
      code: amazonResult.code,
      detail: amazonResult.detail ?? null,
      warning: amazonResult.warning ?? null,
    });
  }

  // Success path — stamp sent_at and merge Amazon's response into result.
  const { ok: _ok, ...rest } = amazonResult;
  const result: Record<string, unknown> = { ...rest };

  if (command.type === "screenshot") {
    const url =
      (rest as { screenshotUrl?: string }).screenshotUrl ?? null;
    if (url) {
      result.screenshot_url = url;
      // TODO(perf): if Amazon ever switches to long-lived URLs, mirror to
      //   org/{device.org_id}/screenshots/{command.id}.png in Supabase Storage
      //   so we have a stable URL for the UI. For now we trust the signed URL.
    }
  }

  const sentAt = new Date().toISOString();
  const { error: updateErr } = await service
    .from("device_commands")
    .update({ status: "sent", sent_at: sentAt, result })
    .eq("id", command.id);

  if (updateErr) {
    return { routed: "amazon", status: "failed", result: { code: "PERSIST_ERROR", detail: updateErr.message } };
  }

  return { routed: "amazon", status: "sent", result };
}

async function persistFailure(
  service: ReturnType<typeof createSupabaseServiceClient>,
  commandId: string,
  result: Record<string, unknown>,
): Promise<DispatchOutcome> {
  await service
    .from("device_commands")
    .update({ status: "failed", result })
    .eq("id", commandId);
  return { routed: "amazon", status: "failed", result };
}
