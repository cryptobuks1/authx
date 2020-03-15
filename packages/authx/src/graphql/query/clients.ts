import { GraphQLBoolean, GraphQLFieldConfig } from "graphql";

import {
  connectionFromArray,
  connectionArgs,
  ConnectionArguments
} from "graphql-relay";

import { GraphQLClientConnection } from "../GraphQLClientConnection";
import { Context } from "../../Context";
import { Client } from "../../model";
import { filter } from "../../util/filter";

export const clients: GraphQLFieldConfig<
  any,
  Context,
  ConnectionArguments & {
    includeDisabled: boolean;
  }
> = {
  type: GraphQLClientConnection,
  description: "List all clients.",
  args: {
    ...connectionArgs,
    includeDisabled: {
      type: GraphQLBoolean,
      defaultValue: false,
      description: "Include disabled clients in results."
    }
  },
  async resolve(source, args, context) {
    const { executor, authorization: a, realm } = context;
    if (!a) return [];

    const ids = await executor.tx.query(
      `
        SELECT entity_id AS id
        FROM authx.client_record
        WHERE
          replacement_record_id IS NULL
          ${args.includeDisabled ? "" : "AND enabled = true"}
        `
    );

    if (!ids.rows.length) {
      return [];
    }

    const clients = await Client.read(
      executor,
      ids.rows.map(({ id }) => id)
    );

    return connectionFromArray(
      await filter(clients, client =>
        client.isAccessibleBy(realm, a, executor)
      ),
      args
    );
  }
};
