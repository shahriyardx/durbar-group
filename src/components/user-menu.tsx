"use client";

import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

export function UserMenu({
  name,
  email,
  image,
  signOutLabel = "Sign out",
}: {
  name: string;
  email: string;
  image?: string | null;
  signOutLabel?: string;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="size-6">
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">
          <span className="block text-sm">{name}</span>
          <span className="text-muted-foreground block text-xs">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            // There is no login page — the landing page is where you sign in.
            router.replace("/");
            // The shell above renders from the session on the server, so the
            // cached payload has to go with it.
            router.refresh();
          }}
        >
          {signOutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
