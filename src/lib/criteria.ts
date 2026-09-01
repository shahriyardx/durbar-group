/**
 * The Durbar Group criteria, verbatim. Students read them on their dashboard
 * and admins read them beside the eliminate button, so both screens quote the
 * same source rather than two copies that drift apart.
 */
export const CRITERIA_TITLE = "দূর্বার গ্রুপের ক্রাইটেরিয়া";

export const CRITERIA_INTRO =
  "দূর্বার গ্রুপের সকল সাপোর্ট পেতে হলে নিচের সকল ক্রাইটেরিয়া অবশ্যই পূরণ করতে হবে। কোনো ক্রাইটেরিয়া পূরণ করতে ব্যর্থ হলে সংশ্লিষ্ট শিক্ষার্থীকে দূর্বার গ্রুপ থেকে ইলিমিনেট করা হবে।";

export type Criterion = { number: string; title: string; points: string[] };

export const CRITERIA: Criterion[] = [
  {
    number: "১",
    title: "অ্যাসাইনমেন্ট সাবমিশন",
    points: [
      "সকল এসাইনমেন্ট মিনিমাম ৫০ মার্ক্সে সাবমিট করতে হবে।",
      "৩০ মার্ক্সে কোন এসাইনমেন্ট সাবমিট করতে পারবে না।",
    ],
  },
  {
    number: "২",
    title: "অ্যাসাইনমেন্টে ন্যূনতম মার্কস",
    points: [
      "প্রতিটি অ্যাসাইনমেন্টে ন্যূনতম ৯০% নম্বর অর্জন করতে হবে।",
      "৬০ মার্ক্সে সাবমিট করা অ্যাসাইনমেন্টে ন্যূনতম ৫৪/৬০ নম্বর পেতে হবে।",
      "৫০ মার্ক্সে সাবমিট করা অ্যাসাইনমেন্টে ন্যূনতম ৪৫/৫০ নম্বর পেতে হবে।",
    ],
  },
  {
    number: "৩",
    title: "প্রবলেম সলভিং কন্টেস্ট",
    points: [
      "সকল Problem Solving Contest-এ অংশগ্রহণ বাধ্যতামূলক।",
      "প্রতিটি কন্টেস্টে নির্ধারিত সংখ্যক সকল প্রবলেম অবশ্যই সলভ করে এপ্রুভ করাতে হবে।",
    ],
  },
  {
    number: "৪",
    title: "জব প্লেসমেন্ট (JP) টাস্ক",
    points: [
      "Job Placement Team থেকে দেওয়া সবগুলো টাস্ক (যেমন: LinkedIn Profile, GitHub Profile, Communication Task ইত্যাদি) সম্পূর্ণ করতে হবে।",
      "প্রতিটি টাস্কে ১০০% কমপ্লিশন এবং ১০০% মার্কস অর্জন করতে হবে।",
      "সর্বোচ্চ ২টি টাস্ক দুর্বার গ্রুপ চলাকালীন সময়ে Resubmit করার সুযোগ থাকবে। তবে সেক্ষেত্রে সংশোধন করে পুনরায় ১০০% মার্ক্স অর্জন করতে হবে।",
    ],
  },
];

/** Short English labels for the admin's reason picker. */
export const CRITERIA_SHORT: string[] = [
  "১. অ্যাসাইনমেন্ট সাবমিশন",
  "২. অ্যাসাইনমেন্টে ন্যূনতম মার্কস",
  "৩. প্রবলেম সলভিং কন্টেস্ট",
  "৪. জব প্লেসমেন্ট (JP) টাস্ক",
];
