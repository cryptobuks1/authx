import { v4 } from "uuid";
import { URL } from "url";
import { randomBytes } from "crypto";
import { GraphQLFieldConfig, GraphQLList, GraphQLNonNull } from "graphql";
import { Context } from "../../Context";
import { GraphQLClient } from "../GraphQLClient";
import { Client } from "../../model";
import { validateIdFormat } from "../../util/validateIdFormat";
import { ForbiddenError, ValidationError } from "../../errors";
import { GraphQLUpdateClientInput } from "./GraphQLUpdateClientInput";

export const updateClients: GraphQLFieldConfig<
  any,
  Context,
  {
    clients: {
      id: string;
      enabled: null | boolean;
      name: null | string;
      description: null | string;
      addUrls: null | string[];
      removeUrls: null | string[];
      generateSecrets: null | number;
      removeSecrets: null | string[];
    }[];
  }
> = {
  type: new GraphQLList(GraphQLClient),
  description: "Update a new client.",
  args: {
    clients: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLUpdateClientInput))
      )
    }
  },
  async resolve(source, args, context): Promise<Promise<Client>[]> {
    const { pool, authorization: a, realm } = context;

    if (!a) {
      throw new ForbiddenError("You must be authenticated to update a client.");
    }

    return args.clients.map(async input => {
      // Validate `id`.
      if (!validateIdFormat(input.id)) {
        throw new ValidationError("The provided `id` is an invalid ID.");
      }

      // Validate `addUrls`.
      if (Array.isArray(input.addUrls)) {
        for (const url of input.addUrls) {
          try {
            new URL(url);
          } catch (error) {
            throw new ValidationError(
              "The provided `addUrls` list contains an invalid URL."
            );
          }
        }
      }

      const tx = await pool.connect();
      try {
        await tx.query("BEGIN DEFERRABLE");
        const before = await Client.read(tx, input.id, {
          forUpdate: true
        });

        // w.... -----------------------------------------------------------
        if (
          !(await before.isAccessibleBy(realm, a, tx, {
            basic: "w",
            secrets: ""
          }))
        ) {
          throw new ForbiddenError(
            "You do not have permission to update this client."
          );
        }

        let urls = [...before.urls];

        // Add URLs
        if (input.addUrls) {
          urls = [...urls, ...input.addUrls];
        }

        // Remove URLs
        if (input.removeUrls) {
          const removeUrls = new Set(input.removeUrls);
          urls = urls.filter(id => !removeUrls.has(id));
        }

        // w...w. ---------------------------------------------------------
        if (
          !(await before.isAccessibleBy(realm, a, tx, {
            basic: "w",
            secrets: "w"
          }))
        ) {
          throw new ForbiddenError(
            "You do not have permission to update this client's secrets."
          );
        }

        let secrets = [...before.secrets];

        // Generate secrets
        if (input.generateSecrets) {
          for (let i = input.generateSecrets; i > 0; i--) {
            secrets.push(randomBytes(16).toString("hex"));
          }
        }

        // Remove secrets
        if (input.removeSecrets) {
          const removeSecrets = new Set(input.removeSecrets);
          secrets = secrets.filter(id => !removeSecrets.has(id));
        }

        const client = await Client.write(
          tx,
          {
            ...before,
            enabled:
              typeof input.enabled === "boolean"
                ? input.enabled
                : before.enabled,
            name: input.name || before.name,
            description: input.description || before.description,
            urls,
            secrets
          },
          {
            recordId: v4(),
            createdByAuthorizationId: a.id,
            createdAt: new Date()
          }
        );

        await tx.query("COMMIT");
        return client;
      } catch (error) {
        await tx.query("ROLLBACK");
        throw error;
      } finally {
        tx.release();
      }
    });
  }
};
