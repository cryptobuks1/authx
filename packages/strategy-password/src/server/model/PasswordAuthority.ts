import { ClientBase, Pool } from "pg";
import { Authority, DataLoaderExecutor } from "@authx/authx";
import {
  PasswordCredentialDetails,
  PasswordCredential
} from "./PasswordCredential";

// Authority
// ---------

export interface PasswordAuthorityDetails {
  rounds: number;
}

export class PasswordAuthority extends Authority<PasswordAuthorityDetails> {
  private _credentials: null | Promise<PasswordCredential[]> = null;

  public credentials(
    tx: Pool | ClientBase | DataLoaderExecutor,
    refresh: boolean = false
  ): Promise<PasswordCredential[]> {
    if (!refresh && this._credentials) {
      return this._credentials;
    }

    return (this._credentials = (async () => {
      const ids = (
        await (tx instanceof DataLoaderExecutor ? tx.connection : tx).query(
          `
              SELECT entity_id AS id
              FROM authx.credential_records
              WHERE
                authority_id = $1
                AND replacement_record_id IS NULL
              `,
          [this.id]
        )
      ).rows.map(({ id }) => id);

      return tx instanceof DataLoaderExecutor
        ? PasswordCredential.read(tx, ids)
        : PasswordCredential.read(tx, ids);
    })());
  }

  public async credential(
    tx: Pool | ClientBase | DataLoaderExecutor,
    authorityUserId: string
  ): Promise<null | PasswordCredential> {
    const results = await (tx instanceof DataLoaderExecutor
      ? tx.connection
      : tx
    ).query(
      `
      SELECT entity_id AS id
      FROM authx.credential_record
      WHERE
        authority_id = $1
        AND authority_user_id = $2
        AND enabled = true
        AND replacement_record_id IS NULL
    `,
      [this.id, authorityUserId]
    );

    if (results.rows.length > 1) {
      throw new Error(
        "INVARIANT: There cannot be more than one active credential for the same user and authority."
      );
    }

    if (!results.rows[0]) return null;

    // Some silliness to help typescript...
    return tx instanceof DataLoaderExecutor
      ? PasswordCredential.read<PasswordCredentialDetails, PasswordCredential>(
          tx,
          results.rows[0].id
        )
      : PasswordCredential.read<PasswordCredentialDetails, PasswordCredential>(
          tx,
          results.rows[0].id
        );
  }
}
