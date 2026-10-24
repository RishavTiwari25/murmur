"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "./ui/Icons";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  return (
    <details className="murmur-user">
      <summary aria-label="Open account menu">
        <span className="murmur-avatar">{name.trim().charAt(0).toUpperCase() || <UserIcon size={16} />}</span>
        <span className="murmur-user-summary">
          <strong>{name}</strong>
          <small>Account</small>
        </span>
        <ChevronDownIcon size={14} />
      </summary>
      <div className="murmur-popover murmur-user-popover">
        <div className="murmur-user-identity">
          <span className="murmur-avatar is-large">{name.trim().charAt(0).toUpperCase() || <UserIcon size={18} />}</span>
          <div><strong>{name}</strong><span>{email}</span></div>
        </div>
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          <LogOutIcon size={16} />Sign out
        </button>
      </div>
    </details>
  );
}
