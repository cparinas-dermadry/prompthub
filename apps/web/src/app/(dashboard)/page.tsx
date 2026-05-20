// Root dashboard page — landing card when no session is selected.
export default function DashboardHome() {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface">
      <div className="text-center max-w-sm space-y-4">
        <h2 className="text-2xl font-bold text-body">
          Welcome to <span className="text-navy">Prompt</span><span className="text-teal">Hub</span>
        </h2>
        <p className="text-muted-foreground text-sm">
          Create a new session from the sidebar to start dispatching prompts across multiple AI
          models simultaneously.
        </p>
      </div>
    </div>
  );
}
