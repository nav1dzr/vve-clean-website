interface ErrorScreenProps {
  message?: string;
  onRetry: () => void;
}

// Shown when the session is valid but /api/me could not be reached. Distinct
// from UnauthorisedPage — this is a connectivity/server problem, not a claim
// about the account's permissions.
export default function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-silver-100 px-6 text-center">
      <h1 className="font-semibold text-xl text-navy-950">Couldn't verify your session</h1>
      <p className="max-w-sm text-sm text-navy-700">
        {message || "We couldn't reach the server to confirm your access. Check your connection and try again."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-navy-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
      >
        Try again
      </button>
    </div>
  );
}
