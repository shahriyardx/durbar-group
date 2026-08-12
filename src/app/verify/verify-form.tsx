"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { verifyCourseEmail, type VerifyState } from "@/app/verify/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: VerifyState = { status: "idle" };

export function VerifyForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    verifyCourseEmail,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.replace("/student");
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="courseEmail" className="font-bangla text-sm">
          কোর্সের ইমেইল
        </Label>
        <Input
          id="courseEmail"
          name="courseEmail"
          type="email"
          autoComplete="email"
          placeholder="tomar.email@gmail.com"
          required
        />
        <p className="font-bangla text-muted-foreground text-xs leading-loose">
          তুমি যেই ইমেইল দিয়ে কোর্সে এনরোল করেছ, সেটাই লিখে জয়েন করো। ডিসকর্ডের
          ইমেইল আলাদা হলেও সমস্যা নেই।
        </p>
      </div>

      {state.status === "error" ? (
        <p className="font-bangla text-destructive text-sm leading-relaxed">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="bg-brand-gradient font-bangla h-11 w-full rounded-full text-white hover:opacity-90"
        disabled={pending}
      >
        {pending ? "চেক করা হচ্ছে…" : "জয়েন করো"}
      </Button>
    </form>
  );
}
