import { initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import superjson from "superjson";
import type { Context } from "./context";
import {
  localizeZodFlatten,
  localizeZodMessage,
} from "../lib/zod-i18n";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
    const locale = ctx?.locale ?? "sv";
    if (!(error.cause instanceof ZodError)) {
      return {
        ...shape,
        message: localizeZodMessage(shape.message, locale),
      };
    }

    const zodError = localizeZodFlatten(error.cause.flatten(), locale);
    const firstField = Object.values(zodError.fieldErrors)
      .flat()
      .find((m): m is string => Boolean(m));
    const first =
      zodError.formErrors[0] ||
      firstField ||
      localizeZodMessage(shape.message, locale);

    return {
      ...shape,
      message: first,
      data: {
        ...shape.data,
        zodError,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
