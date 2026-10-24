import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthForm } from "@/components/AuthForm";
import { AuthSwarmGraph } from "@/components/AuthSwarmGraph";
import { AmbientRelayVideo } from "@/components/AmbientRelayVideo";
import { AuthorSignature } from "@/components/AuthorSignature";
import { AUTHOR } from "@/lib/author";
import { auth } from "@/lib/auth";
import { isBillingEnabled } from "@/lib/billing/stripe";
import { MurmurBrand } from "@/components/ui/Brand";
import {
  ArrowUpRightIcon,
  CheckIcon,
  GitHubIcon,
  RadioIcon,
} from "@/components/ui/Icons";

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
  const mcpUrl = new URL("/api/mcp", process.env.APP_URL ?? "http://localhost:3000").toString();
  const codexConfig = `[mcp_servers.murmur]\nurl = "${mcpUrl}"\nbearer_token_env_var = "MURMUR_MCP_TOKEN"`;
  const claudeConfig = JSON.stringify({
    type: "http",
    url: mcpUrl,
    headers: { Authorization: "Bearer ${MURMUR_MCP_TOKEN}" },
  });

  return (
    <main className="murmur-auth-page">
      <section className="murmur-auth-showcase" aria-labelledby="murmur-auth-title">
        <div className="murmur-auth-video" aria-hidden="true">
          <AmbientRelayVideo />
        </div>
        <div className="murmur-auth-showcase-top">
          <MurmurBrand tagline="Live agent swarm orchestration" />
          <a
            className="murmur-auth-source"
            href={AUTHOR.repoUrl}
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon size={17} />
            GitHub
            <ArrowUpRightIcon size={15} />
          </a>
        </div>

        <div className="murmur-auth-story">
          <div className="murmur-live-label">
            <RadioIcon size={15} />
            Durable orchestration, visible live
          </div>
          <h1 id="murmur-auth-title">One ambitious goal. A swarm that proves its work.</h1>
          <p>
            Murmur plans the work, runs specialists in parallel, validates their output, and
            synthesizes one usable result—while you watch the complete execution graph unfold.
          </p>
        </div>

        <AuthSwarmGraph />

        <ul className="murmur-auth-proof">
          <li><CheckIcon size={15} /> Temporal durability</li>
          <li><CheckIcon size={15} /> Redis replay</li>
          <li><CheckIcon size={15} /> Validated output</li>
        </ul>
      </section>

      <section className="murmur-auth-entry" aria-label="Murmur account access">
        <AuthForm />
        <p className="murmur-auth-footnote">
          Secure sessions powered by Better Auth.{isBillingEnabled() ? " Payments stay on Stripe." : ""}
        </p>
        <AuthorSignature className="is-auth" />
        <aside className="murmur-auth-terminal" aria-label="Connect Codex or Claude Code through MCP">
          <header>
            <span className="murmur-terminal-lights" aria-hidden="true"><i /><i /><i /></span>
            <strong>Murmur MCP</strong>
            <span>Sign in to create token</span>
          </header>
          <div className="murmur-terminal-body">
            <div>
              <b>Token</b>
              <code>export MURMUR_MCP_TOKEN=&quot;&lt;token from Connect MCP&gt;&quot;</code>
            </div>
            <div>
              <b>Codex</b>
              <code>{codexConfig}</code>
            </div>
            <div>
              <b>Claude Code</b>
              <code>claude mcp add-json --scope user murmur &apos;{claudeConfig}&apos;</code>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
