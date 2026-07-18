export const MESSAGE_TYPES = Object.freeze([
  "hello",
  "get_status",
  "get_settings",
  "update_settings",
  "open_fut",
  "get_diagnostics",
  "check_update"
] as const);

export type MessageType = (typeof MESSAGE_TYPES)[number];

export function isMessageType(value: string): value is MessageType {
  return (MESSAGE_TYPES as readonly string[]).includes(value);
}
