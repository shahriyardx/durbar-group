"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useOptimistic,
} from "react";
import { toast } from "sonner";

import {
  changeRoleAction,
  toggleBanAction,
  type UserActionState,
} from "@/app/admin/users/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/db/schema";

const initialState: UserActionState = { status: "idle" };

const ROLE_LABELS: { value: Role; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "instructor", label: "Instructor" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];

export function RoleSelect({
  userId,
  role,
  disabled,
  canGrantAdmin,
}: {
  userId: string;
  role: Role;
  disabled: boolean;
  canGrantAdmin: boolean;
}) {
  const [state, submit, pending] = useActionState(
    changeRoleAction,
    initialState,
  );
  // Shows the pick straight away, and falls back to whatever `role` says once
  // the action settles — so a refusal snaps the select back on its own.
  const [selected, setSelected] = useOptimistic(role);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const options = ROLE_LABELS.filter(
    (option) =>
      canGrantAdmin ||
      (option.value !== "admin" && option.value !== "super_admin"),
  );

  // The form data is built by hand rather than read off a submitted <form>.
  // Radix writes its hidden input on the React commit, so a requestSubmit()
  // fired from inside onValueChange would post the *previous* role — which
  // looked like the select silently snapping back.
  const change = (next: string) => {
    if (next === selected) return;
    const payload = new FormData();
    payload.set("userId", userId);
    payload.set("role", next);
    startTransition(() => {
      setSelected(next as Role);
      submit(payload);
    });
  };

  return (
    <Select
      value={selected}
      onValueChange={change}
      disabled={disabled || pending}
    >
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BanButton({
  userId,
  userName,
  banned,
  disabled,
}: {
  userId: string;
  userName: string;
  banned: boolean;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    toggleBanAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (banned) {
    return (
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="banned" value="false" />
        <Button type="submit" size="sm" variant="outline" disabled={disabled || pending}>
          Unban
        </Button>
      </form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={disabled}
        >
          Ban
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to Durbar immediately. This does not remove them
            from the Discord server — do that in Discord if you need to.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="banned" value="true" />
            <AlertDialogAction
              type="submit"
              disabled={pending}
              className="bg-destructive text-white hover:opacity-90"
            >
              Ban account
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
