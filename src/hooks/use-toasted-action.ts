"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const initialState: ActionState = { status: "idle" };

/**
 * Wraps a server action so its result surfaces as a toast. Returns just the
 * form action and pending flag, which is all these row-level buttons need.
 */
export function useToastedAction(
  action: (prev: ActionState, form: FormData) => Promise<ActionState>,
) {
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return [formAction, pending] as const;
}
