import { Workspace } from "@/components/Workspace";
import { UserMenu } from "@/components/UserMenu";
import { SystemStatus } from "@/components/SystemStatus";
import { BillingControls } from "@/components/BillingControls";
import { McpConnection } from "@/components/McpConnection";
import { LiveTokenMeter } from "@/components/LiveTokenMeter";
import { NewSwarmButton } from "@/components/NewSwarmButton";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/billing/repository";
import { isBillingEnabled } from "@/lib/billing/stripe";
import { getMcpTokenStatus } from "@/lib/mcp/service";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MurmurBrand } from "@/components/ui/Brand";
import { CheckIcon, GitHubIcon, WarningIcon } from "@/components/ui/Icons";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const billingEnabled = isBillingEnabled();
  const [plan, query, mcpStatus] = await Promise.all([
    getUserPlan(session.user.id),
    searchParams,
    getMcpTokenStatus(session.user.id),
  ]);

  return (
    <main className="murmur-app">
      <header className="murmur-header">
        <MurmurBrand tagline="Live agent swarm orchestration" />
        <div className="murmur-header-actions">
          <NewSwarmButton />
          <SystemStatus />
          <LiveTokenMeter />
          {billingEnabled ? <BillingControls plan={plan} /> : null}
          <McpConnection
            initialStatus={{
              configured: mcpStatus.configured,
              lastUsedAt: mcpStatus.lastUsedAt?.toISOString() ?? null,
            }}
          />
          <a
            aria-label="View Murmur source on GitHub"
            className="murmur-icon-link"
            href="https://github.com/RishavTiwari25/murmur"
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon size={17} />
            <span>Source</span>
          </a>
          <UserMenu name={session.user.name} email={session.user.email} />
        </div>
      </header>

      {!billingEnabled ? null : query.billing === "success" ? (
        <div className="murmur-billing-notice is-success">
          <CheckIcon size={16} />
          <span>Payment received. Pro activates as soon as Stripe confirms the subscription.</span>
        </div>
      ) : query.billing === "cancelled" ? (
        <div className="murmur-billing-notice">
          <WarningIcon size={16} />
          <span>Checkout cancelled. Your plan was not changed.</span>
        </div>
      ) : null}

      <Workspace userName={session.user.name} />
    </main>
  );
}
