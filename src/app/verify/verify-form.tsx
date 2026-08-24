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
        <div className="border-destructive/40 bg-destructive/5 space-y-3 rounded-xl border p-4">
          <p className="font-bangla text-destructive text-sm leading-relaxed">
            {state.message}
          </p>

          {/* Joining by hand sidesteps the OAuth token entirely: the next
              attempt sees an existing member and skips the failing call. */}
          {state.inviteUrl ? (
            <div className="space-y-2">
              <Button
                asChild
                variant="outline"
                className="font-bangla h-10 w-full rounded-full"
              >
                <a href={state.inviteUrl} target="_blank" rel="noreferrer">
                  ডিসকর্ড সার্ভারে জয়েন করো ↗
                </a>
              </Button>
              <p className="font-bangla text-muted-foreground text-xs leading-loose">
                লিংকটি একবারই কাজ করবে, এক ঘণ্টার মধ্যে। জয়েন করা হয়ে গেলে এই
                পেজে ফিরে এসে আবার &ldquo;জয়েন করো&rdquo; চাপো — তখনই ভেরিফিকেশন
                সম্পূর্ণ হবে।
              </p>
            </div>
          ) : null}
        </div>
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
