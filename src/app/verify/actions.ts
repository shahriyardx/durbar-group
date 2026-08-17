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
    // Reaching here means they are in the Discord server; what differs is
    // whether an instructor has been assigned, and so whether they can see
    // any channels yet.
    message: result.assigned
      ? "ভেরিফাই হয়েছে! ডিসকর্ড সার্ভারে যুক্ত করা হয়েছে, তোমার চ্যানেলগুলো এখন দেখতে পাবে।"
      : "ভেরিফাই হয়েছে! ডিসকর্ড সার্ভারে যুক্ত করা হয়েছে। ইন্সট্রাক্টর অ্যাসাইন হলেই চ্যানেলগুলো দেখা যাবে।",
  };
}
