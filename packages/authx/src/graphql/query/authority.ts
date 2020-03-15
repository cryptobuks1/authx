import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull } from "graphql";
import { Context } from "../../Context";
import { GraphQLAuthority } from "../GraphQLAuthority";
import { Authority } from "../../model";

export const authority: GraphQLFieldConfig<
  any,
  Context,
  {
    id: string;
  }
> = {
  type: GraphQLAuthority,
  description: "Fetch an authority by ID.",
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID)
    }
  },
  async resolve(source, args, context): Promise<null | Authority<any>> {
    const {
      executor,
      strategies: { authorityMap }
    } = context;
    return await Authority.read(executor, args.id, authorityMap);
  }
};
