import { AUTHOR } from "@/lib/author";
import { GitHubIcon } from "./ui/Icons";

/** Small "Built by" credit with a GitHub link to the source repository. */
export function AuthorSignature({ className }: { className?: string }) {
  return (
    <div className={`murmur-signature${className ? ` ${className}` : ""}`}>
      <span>
        Built by{" "}
        <a href={AUTHOR.profileUrl} target="_blank" rel="noreferrer">
          {AUTHOR.name}
        </a>
      </span>
      <a
        className="murmur-signature-repo"
        href={AUTHOR.repoUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Murmur source code on GitHub"
        title="Murmur on GitHub"
      >
        <GitHubIcon size={14} />
      </a>
    </div>
  );
}
