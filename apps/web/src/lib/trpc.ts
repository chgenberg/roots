import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

// AppRouter type is imported from the API package using the relative workspace path.
// In a monorepo, the type-only import ensures no runtime dependency on the API.
import type { AppRouter } from "../../../api/src/trpc/router";

import { getBrowserApiBase } from "./api-base";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return getBrowserApiBase();
  }
  return (
    process.env.API_BACKEND_URL ||
    process.env.API_URL ||
    "http://127.0.0.1:4000"
  );
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
