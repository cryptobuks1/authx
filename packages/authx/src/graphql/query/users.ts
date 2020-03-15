import { GraphQLBoolean, GraphQLFieldConfig } from "graphql";

import {
  connectionFromArray,
  connectionArgs,
  ConnectionArguments
} from "graphql-relay";

import { GraphQLUserConnection } from "../GraphQLUserConnection";
import { Context } from "../../Context";
import { User } from "../../model";
import { filter } from "../../util/filter";

export const users: GraphQLFieldConfig<
  any,
  Context,
  ConnectionArguments & {
    includeDisabled: boolean;
  }
> = {
  type: GraphQLUserConnection,
  description: "List all users.",
  args: {
    ...connectionArgs,
    includeDisabled: {
      type: GraphQLBoolean,
      defaultValue: false,
      description: "Include disabled users in results."
    }
  },
  async resolve(source, args, context) {
    const { executor, authorization: a, realm } = context;
    if (!a) return [];

    const ids = await executor.tx.query(
      `
      SELECT entity_id AS id
      FROM authx.user_record
      WHERE
        replacement_record_id IS NULL
        ${args.includeDisabled ? "" : "AND enabled = true"}
      `
    );

    if (!ids.rows.length) {
      return [];
    }

    const users = await User.read(
      executor,
      ids.rows.map(({ id }) => id)
    );

    return connectionFromArray(
      await filter(users, user => user.isAccessibleBy(realm, a, executor)),
      args
    );
  }
};
