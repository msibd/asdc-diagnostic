import { toast } from "sonner";

// The app's one way to show a short notification (Sonner). Successes disappear on their own;
// errors stay a little longer. Screen readers announce both (Sonner uses a live region).
export function notify(message: string, error = false) {
  if (error) toast.error(message, { duration: 6000 });
  else toast.success(message);
}
