import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

// AppRouter type is imported from the API package using the relative workspace path.
// In a monorepo, the type-only import ensures no runtime dependency on the API.
import type { AppRouter } from "../../../api/src/trpc/router";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  }
  return process.env.API_URL || "http://localhost:4000";
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      transformer: superjson,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
