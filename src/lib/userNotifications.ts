export const USER_SUCCESS_EVENT = "cyber-cafe-studio:user-success";

export function notifyUserSuccess(message: string) {
  if (typeof window === "undefined" || !message.trim()) return;
  window.dispatchEvent(
    new CustomEvent(USER_SUCCESS_EVENT, { detail: message.trim() }),
  );
}
