"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  promoteUserAction,
  type SimpleState,
} from "@/app/admin/instructors/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: SimpleState = { status: "idle" };

const ROLE_SUFFIX: Record<string, string> = {
  admin: " · admin",
  super_admin: " · super admin",
  instructor: " · instructor",
};

export function PromoteForm({
  candidates,
}: {
  candidates: { id: string; name: string; email: string; role: string }[];
}) {
  const [userId, setUserId] = useState("");
  const [state, formAction, pending] = useActionState(
    promoteUserAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Every account already has a teaching space. A user has to sign in with
        Discord once before they can be given one.
      </p>
    );
  }

  return (
    // Remounting when the candidate list changes clears the selection after a
    // successful promotion, without a setState inside an effect.
    <form
      key={candidates.map((c) => c.id).join(",")}
      action={formAction}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue placeholder="Choose an account" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.name} · {candidate.email}
              {ROLE_SUFFIX[candidate.role] ?? ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="submit"
        disabled={pending || !userId}
        className="bg-brand-gradient h-10 rounded-full px-6 text-white hover:opacity-90"
      >
        {pending ? "Provisioning…" : "Give a teaching space"}
      </Button>
    </form>
  );
}
