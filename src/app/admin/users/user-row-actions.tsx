"use client";

import { useActionState, useEffect, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    changeRoleAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const options = ROLE_LABELS.filter(
    (option) =>
      canGrantAdmin ||
      (option.value !== "admin" && option.value !== "super_admin"),
  );

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <Select
        name="role"
        defaultValue={role}
        disabled={disabled || pending}
        // Promotions provision Discord, so the change fires on selection
        // rather than hiding behind a second save button.
        onValueChange={(next) => {
          if (next !== role) formRef.current?.requestSubmit();
        }}
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
    </form>
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
