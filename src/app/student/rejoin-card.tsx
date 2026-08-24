"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { rejoinDiscordAction, type RejoinState } from "@/app/student/actions";
import { Button } from "@/components/ui/button";

const initialState: RejoinState = { status: "idle" };

/**
 * Shown only when Discord says the student is not in the server. Leaving or
 * being removed does not touch their verification, so getting back in is one
 * button rather than a conversation with an admin.
 */
export function RejoinCard() {
  const [state, formAction, pending] = useActionState(
    rejoinDiscordAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <section className="border-destructive/40 bg-destructive/5 rounded-2xl border p-8">
      <h2 className="font-bangla text-xl font-bold">
        তুমি এখন ডিসকর্ড সার্ভারে নেই
      </h2>
      <p className="font-bangla text-muted-foreground mt-3 max-w-2xl text-sm leading-loose">
        সার্ভার থেকে বেরিয়ে গেলে বা কেউ রিমুভ করে দিলে চ্যানেলগুলো আর দেখা
        যায় না। তোমার ভেরিফিকেশন ঠিকই আছে — নিচের বাটনে ক্লিক করলেই আবার যুক্ত
        হয়ে যাবে, ইন্সট্রাক্টরের রোলসহ।
      </p>

      <form action={formAction} className="mt-6">
        <Button
          type="submit"
          disabled={pending}
          className="bg-brand-gradient font-bangla h-11 rounded-full px-6 text-white hover:opacity-90"
        >
          {pending ? "যুক্ত করা হচ্ছে…" : "আবার জয়েন করো"}
        </Button>
      </form>
    </section>
  );
}
