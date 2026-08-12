"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/rbac";
import { claimCourseEmail } from "@/server/verification";

const schema = z.object({
  courseEmail: z.email("সঠিক একটি ইমেইল অ্যাড্রেস লেখো।"),
});

export type VerifyState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function verifyCourseEmail(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    courseEmail: formData.get("courseEmail"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const result = await claimCourseEmail(user.id, parsed.data.courseEmail);
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: result.discordSynced
      ? "ভেরিফাই হয়েছে! ডিসকর্ড অ্যাক্সেস সেট করা হয়েছে।"
      : "ভেরিফাই হয়েছে! ইন্সট্রাক্টর অ্যাসাইন হলেই ডিসকর্ড অ্যাক্সেস পেয়ে যাবে।",
  };
}
