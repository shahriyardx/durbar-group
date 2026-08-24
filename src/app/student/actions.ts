"use server";

import { revalidatePath } from "next/cache";

import { requireVerifiedStudent } from "@/lib/rbac";
import { SYNC_FAILURE_BN, syncStudentDiscordAccess } from "@/server/discord-sync";

export type RejoinState = {
  status: "idle" | "error" | "success";
  message?: string;
};

/**
 * Put a student who left — or was removed — back into the guild, with the
 * roles their assignments say they should hold. It is the same sync that runs
 * at verification, so somebody already in the server just has their roles
 * re-applied.
 */
export async function rejoinDiscordAction(): Promise<RejoinState> {
  const user = await requireVerifiedStudent();

  try {
    const result = await syncStudentDiscordAccess(user.id);
    revalidatePath("/student");

    if (!result.ok) {
      console.error(`[rejoin] failed for user=${user.id}: ${result.reason}`);
      return { status: "error", message: SYNC_FAILURE_BN[result.reason] };
    }

    return {
      status: "success",
      message: result.joinedGuild
        ? "ডিসকর্ড সার্ভারে যুক্ত করা হয়েছে। চ্যানেলগুলো এখন দেখতে পাবে।"
        : "তুমি সার্ভারে আছোই — রোলগুলো আবার সেট করে দেওয়া হয়েছে।",
    };
  } catch (error) {
    console.error(`[rejoin] failed for user=${user.id}:`, error);
    return {
      status: "error",
      message:
        "ডিসকর্ডে যুক্ত করা যায়নি। একটু পরে আবার চেষ্টা করো — সমস্যা থাকলে অ্যাডমিনকে জানাও।",
    };
  }
}
