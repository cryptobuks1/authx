import {
  verify,
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError
} from "jsonwebtoken";
import fetch from "node-fetch";
import { isValidScopeLiteral } from "@authx/scopes";

const BEARER = /^BEARER\s+/i;
const BASIC = /^BASIC\s+/i;

export class NotAuthorizedError extends Error {}

export async function validateAuthorizationHeader(
  authxUrl: string,
  keys: ReadonlyArray<string>,
  authorizationHeader: string
): Promise<{
  authorizationId: string;
  authorizationSubject: string;
  authorizationScopes: string[];
}> {
  // BEARER
  if (BEARER.test(authorizationHeader)) {
    const token = authorizationHeader.replace(BEARER, "");

    // Try each public key.
    for (const key of keys) {
      try {
        // Verify the token against the key.
        const payload = verify(token, key, {
          algorithms: ["RS512"]
        }) as string | { sub: string; aid: string; scopes: string[] };

        // Ensure the token payload is correctly formatted.
        if (typeof payload !== "object") {
          throw new Error(
            "A cryptographically verified token contained a malformed payload."
          );
        }

        if (
          !Array.isArray(payload.scopes) ||
          !payload.scopes.every(
            scope => typeof scope === "string" && isValidScopeLiteral(scope)
          )
        ) {
          throw new Error(
            "A cryptographically verified token contained a malformed scope."
          );
        }

        if (typeof payload.aid !== "string") {
          throw new Error(
            "A cryptographically verified token contained a malformed aid."
          );
        }

        if (typeof payload.sub !== "string") {
          throw new Error(
            "A cryptographically verified token contained a malformed sub."
          );
        }

        return {
          authorizationId: payload.aid,
          authorizationSubject: payload.sub,
          authorizationScopes: payload.scopes
        };
      } catch (error) {
        // Keep trying public keys.
        if (error instanceof JsonWebTokenError) {
          continue;
        }

        // The token is expired or not yet valid; there's no point in trying
        // to verify against additional public keys.
        if (
          error instanceof TokenExpiredError ||
          error instanceof NotBeforeError
        ) {
          break;
        }

        throw error;
      }
    }

    throw new NotAuthorizedError(
      "The submitted bearer token failed validation."
    );
  }

  // BASIC
  if (BASIC.test(authorizationHeader)) {
    const body = await (await fetch(authxUrl + "/graphql", {
      method: "POST",
      headers: {
        authorization: authorizationHeader,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: `
          query {
            viewer {
              id
              enabled
              scopes
              user {
                id
              }
            }
          }
        `
      })
    })).json();

    const viewer:
      | undefined
      | {
          id: string;
          enabled: boolean;
          scopes?: null | string[];
          user?: null | {
            id: string;
          };
        } =
      (typeof body === "object" &&
        body &&
        typeof body.data === "object" &&
        body.data &&
        typeof body.data.viewer === "object" &&
        body.data.viewer) ||
      undefined;

    if (!viewer || typeof viewer !== "object") {
      throw new NotAuthorizedError(
        "The submitted basic credentials failed to retreive an authorization. Make sure the authorization has the scope `authx:authorization.equal.self.current:read.basic`."
      );
    }

    if (typeof viewer.id !== "string") {
      throw new Error("The AuthX response was missing a viewer id.");
    }

    if (!viewer.scopes) {
      throw new NotAuthorizedError(
        "The submitted basic credentials failed to retreive authorization scopes. Make sure the authorization has the scope `authx:authorization.equal.self.current:read.scopes`."
      );
    }

    if (
      !Array.isArray(viewer.scopes) ||
      !viewer.scopes.every(
        scope => typeof scope === "string" && isValidScopeLiteral(scope)
      )
    ) {
      throw new Error("The AuthX response contained a malformed scope.");
    }

    if (viewer.enabled !== true) {
      throw new NotAuthorizedError(
        "The submitted basic credentials belong to a disabled authorization."
      );
    }

    if (!viewer.user || typeof viewer.user.id !== "string") {
      throw new NotAuthorizedError(
        "The submitted credentials could not resolve a subject ID. Make sure the authorization has the scope `authx:user.equal.self:read.basic`."
      );
    }

    return {
      authorizationId: viewer.id,
      authorizationSubject: viewer.user.id,
      authorizationScopes: viewer.scopes
    };
  }

  throw new NotAuthorizedError(
    "The sumitted authorization header was malformed."
  );
}
