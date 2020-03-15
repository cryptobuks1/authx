import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLBoolean,
  GraphQLString,
  GraphQLFieldConfigMap
} from "graphql";

import {
  connectionFromArray,
  connectionArgs,
  ConnectionArguments
} from "graphql-relay";

import { User, Grant } from "../model";
import { Context } from "../Context";
import { GraphQLRoleConnection } from "./GraphQLRoleConnection";
import { GraphQLUserType } from "./GraphQLUserType";
import { GraphQLGrant } from "./GraphQLGrant";
import { GraphQLGrantConnection } from "./GraphQLGrantConnection";
import { GraphQLAuthorizationConnection } from "./GraphQLAuthorizationConnection";
import { GraphQLCredentialConnection } from "./GraphQLCredentialConnection";
import { GraphQLNode } from "./GraphQLNode";
import { filter } from "../util/filter";

export const GraphQLUser: GraphQLObjectType<
  User,
  Context,
  any
> = new GraphQLObjectType({
  name: "User",
  interfaces: () => [GraphQLNode],
  fields: (): GraphQLFieldConfigMap<User, Context, any> => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    enabled: {
      type: new GraphQLNonNull(GraphQLBoolean)
    },
    name: {
      type: GraphQLString
    },
    type: { type: GraphQLUserType },
    authorizations: {
      type: GraphQLAuthorizationConnection,
      description: "List all of the user's authorizations.",

      // TODO: The type definitions in graphql-js are garbage, and will be
      // refactored shortly.
      args: connectionArgs as any,
      async resolve(
        user,
        args: ConnectionArguments,
        { realm, authorization: a, executor }: Context
      ) {
        return a
          ? connectionFromArray(
              await filter(await user.authorizations(executor), authorization =>
                authorization.isAccessibleBy(realm, a, executor)
              ),
              args
            )
          : null;
      }
    },
    credentials: {
      type: GraphQLCredentialConnection,
      description: "List all of the user's credentials.",

      // TODO: The type definitions in graphql-js are garbage, and will be
      // refactored shortly.
      args: connectionArgs as any,
      async resolve(
        user,
        args: ConnectionArguments,
        {
          realm,
          authorization: a,
          executor,
          strategies: { credentialMap }
        }: Context
      ) {
        return a
          ? connectionFromArray(
              await filter(
                await user.credentials(executor, credentialMap),
                credential => credential.isAccessibleBy(realm, a, executor)
              ),
              args
            )
          : null;
      }
    },
    grants: {
      type: GraphQLGrantConnection,
      description: "List all of the user's grants.",

      // TODO: The type definitions in graphql-js are garbage, and will be
      // refactored shortly.
      args: connectionArgs as any,
      async resolve(
        user,
        args,
        { realm, authorization: a, executor }: Context
      ) {
        return a
          ? connectionFromArray(
              await filter(await user.grants(executor), grant =>
                grant.isAccessibleBy(realm, a, executor)
              ),
              args
            )
          : null;
      }
    },
    grant: {
      type: GraphQLGrant,
      args: {
        clientId: {
          type: new GraphQLNonNull(GraphQLID),
          description: "The ID of a client."
        }
      },
      description: "Look for a grant between this user and a client.",
      resolve: async function resolve(
        user: User,
        args: { clientId: string },
        { realm, authorization: a, executor }: Context
      ): Promise<null | Grant> {
        if (!a) return null;
        const grant = await user.grant(executor, args.clientId);
        return grant && grant.isAccessibleBy(realm, a, executor) ? grant : null;

        // This is necessary because of a flaw in the type definitions:
        // https://github.com/graphql/graphql-js/issues/2152
      } as any
    },
    roles: {
      type: GraphQLRoleConnection,
      description: "List all roles to which the user is assigned.",

      // TODO: The type definitions in graphql-js are garbage, and will be
      // refactored shortly.
      args: connectionArgs as any,
      async resolve(
        user,
        args,
        { realm, authorization: a, executor }: Context
      ) {
        return a
          ? connectionFromArray(
              await filter(
                await user.roles(executor),
                async role =>
                  (await role.isAccessibleBy(realm, a, executor)) &&
                  (await role.isAccessibleBy(realm, a, executor, {
                    basic: "r",
                    scopes: "",
                    users: "r"
                  }))
              ),
              args
            )
          : null;
      }
    }
  })
});
