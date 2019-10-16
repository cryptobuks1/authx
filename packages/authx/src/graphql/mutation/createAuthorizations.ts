import v4 from "uuid/v4";
import { randomBytes } from "crypto";

import { getIntersection, simplify } from "@authx/scopes";
import { GraphQLFieldConfig, GraphQLList, GraphQLNonNull } from "graphql";

import { Context } from "../../Context";
import { GraphQLAuthorization } from "../GraphQLAuthorization";
import { Authorization, Grant, Role } from "../../model";
import { makeAdministrationScopes } from "../../util/makeAdministrationScopes";
import { ForbiddenError, ConflictError, NotFoundError } from "../../errors";
import { GraphQLCreateAuthorizationInput } from "./GraphQLCreateAuthorizationInput";

export const createAuthorizations: GraphQLFieldConfig<
  any,
  {
    authorizations: {
      id: null | string;
      enabled: boolean;
      userId: string;
      grantId: null | string;
      scopes: string[];
      administration: {
        roleId: string;
        scopes: string[];
      }[];
    }[];
  },
  Context
> = {
  type: new GraphQLList(GraphQLAuthorization),
  description: "Create a new authorization.",
  args: {
    authorizations: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLCreateAuthorizationInput))
      )
    }
  },
  async resolve(source, args, context): Promise<Promise<Authorization>[]> {
    const { pool, authorization: a, realm } = context;

    if (!a) {
      throw new ForbiddenError(
        "You must be authenticated to create an authorization."
      );
    }

    return args.authorizations.map(async input => {
      const tx = await pool.connect();
      try {
        if (
          !(await a.can(tx, `${realm}:authorization.:write.create`)) &&
          !(await a.can(
            tx,
            `${realm}:user.${input.userId}.authorizations:write.create`
          )) &&
          !(
            input.grantId &&
            (await a.can(
              tx,
              `${realm}:grant.${input.grantId}.authorizations:write.create`
            ))
          ) &&
          !(
            input.grantId &&
            (await a.can(
              tx,
              `${realm}:client.${
                (await Grant.read(tx, input.grantId)).clientId
              }.authorizations:write.create`
            ))
          )
        ) {
          throw new ForbiddenError(
            "You do not have permission to create this grant."
          );
        }

        try {
          await tx.query("BEGIN DEFERRABLE");

          // Make sure the ID isn't already in use.
          if (input.id) {
            try {
              await Authorization.read(tx, input.id, { forUpdate: true });
              throw new ConflictError();
            } catch (error) {
              if (!(error instanceof NotFoundError)) {
                throw error;
              }
            }
          }

          const id = input.id || v4();
          const authorization = await Authorization.write(
            tx,
            {
              id,
              enabled: input.enabled,
              userId: input.userId,
              grantId: input.grantId,
              secret: randomBytes(16).toString("hex"),
              scopes: input.scopes
            },
            {
              recordId: v4(),
              createdByAuthorizationId: a.id,
              createdByCredentialId: null,
              createdAt: new Date()
            }
          );

          const possibleAdministrationScopes = makeAdministrationScopes(
            await a.access(tx),
            realm,
            "authorization",
            id,
            [
              "read.basic",
              "read.secrets",
              "read.scopes",
              "write.basic",
              "write.secrets",
              "write.scopes"
            ]
          );

          // Add administration scopes.
          for (const { roleId, scopes } of input.administration) {
            const role = await Role.read(tx, roleId, { forUpdate: true });

            if (!role.can(tx, "write.scopes")) {
              throw new ForbiddenError(
                `You do not have permission to modify the scopes of role ${roleId}.`
              );
            }

            await Role.write(
              tx,
              {
                ...role,
                scopes: simplify([
                  ...role.scopes,
                  ...getIntersection(possibleAdministrationScopes, scopes)
                ])
              },
              {
                recordId: v4(),
                createdByAuthorizationId: a.id,
                createdAt: new Date()
              }
            );
          }

          await tx.query("COMMIT");
          return authorization;
        } catch (error) {
          await tx.query("ROLLBACK");
          throw error;
        }
      } finally {
        tx.release();
      }
    });
  }
};
