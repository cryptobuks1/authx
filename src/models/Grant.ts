import { PoolClient } from "pg";
import { Client } from "./Client";
import { User } from "./User";
import { Token } from "./Token";
import {
  simplify,
  getIntersection,
  isSuperset,
  isStrictSuperset
} from "scopeutils";
import { NotFoundError } from "../errors";

export interface GrantData {
  readonly id: string;
  readonly enabled: boolean;
  readonly clientId: string;
  readonly userId: string;
  readonly oauth2Nonce: null | string;
  readonly oauth2RefreshToken: string;
  readonly scopes: Iterable<string>;
}

export class Grant implements GrantData {
  public readonly id: string;
  public readonly enabled: boolean;
  public readonly clientId: string;
  public readonly userId: string;
  public readonly oauth2Nonce: null | string;
  public readonly oauth2RefreshToken: string;
  public readonly scopes: string[];

  private _client: null | Promise<Client> = null;
  private _user: null | Promise<User> = null;

  public constructor(data: GrantData) {
    this.id = data.id;
    this.enabled = data.enabled;
    this.clientId = data.clientId;
    this.userId = data.userId;
    this.oauth2Nonce = data.oauth2Nonce;
    this.oauth2RefreshToken = data.oauth2RefreshToken;
    this.scopes = simplify([...data.scopes]);
  }

  public async isAccessibleBy(
    realm: string,
    t: Token,
    tx: PoolClient,
    action: string = "read.basic"
  ): Promise<boolean> {
    // can view all grants
    if (await t.can(tx, `${realm}:grant.*.*:${action}`)) {
      return true;
    }

    // can view own grants
    if (
      this.userId === t.userId &&
      (await t.can(tx, `${realm}:grant.equal.self:${action}`))
    ) {
      return true;
    }

    // can view the grants of users with lesser or equal access
    if (await t.can(tx, `${realm}:grant.equal.*:${action}`)) {
      return isSuperset(
        await (await t.user(tx)).access(tx),
        await (await this.user(tx)).access(tx)
      );
    }

    // can view the grants of users with lesser access
    if (await t.can(tx, `${realm}:grant.equal.lesser:${action}`)) {
      return isStrictSuperset(
        await (await t.user(tx)).access(tx),
        await (await this.user(tx)).access(tx)
      );
    }

    return false;
  }

  public client(tx: PoolClient, refresh: boolean = false): Promise<Client> {
    if (!refresh && this._client) {
      return this._client;
    }

    return (this._client = Client.read(tx, this.clientId));
  }

  public user(tx: PoolClient, refresh: boolean = false): Promise<User> {
    if (!refresh && this._user) {
      return this._user;
    }
    return (this._user = User.read(tx, this.userId));
  }

  public async access(
    tx: PoolClient,
    refresh: boolean = false
  ): Promise<string[]> {
    return getIntersection(
      this.scopes,
      await (await this.user(tx, refresh)).access(tx, refresh)
    );
  }

  public async can(
    tx: PoolClient,
    scope: string,
    refresh: boolean = false
  ): Promise<boolean> {
    return isSuperset(await this.access(tx, refresh), scope);
  }

  public static read(tx: PoolClient, id: string): Promise<Grant>;
  public static read(tx: PoolClient, id: string[]): Promise<Grant[]>;
  public static async read(
    tx: PoolClient,
    id: string[] | string
  ): Promise<Grant[] | Grant> {
    if (typeof id !== "string" && !id.length) {
      return [];
    }

    const result = await tx.query(
      `
      SELECT
        entity_id AS id,
        enabled,
        client_id,
        user_id,
        oauth2_nonce,
        oauth2_refresh_token,
        scopes
      FROM authx.grant_record
      WHERE
        entity_id = ANY($1)
        AND replacement_record_id IS NULL
      `,
      [typeof id === "string" ? [id] : id]
    );

    if (result.rows.length > (typeof id === "string" ? 1 : id.length)) {
      throw new Error(
        "INVARIANT: Read must never return more records than requested."
      );
    }

    if (result.rows.length < (typeof id === "string" ? 1 : id.length)) {
      throw new NotFoundError();
    }

    const grants = result.rows.map(
      row =>
        new Grant({
          ...row,
          clientId: row.client_id,
          userId: row.user_id,
          oauth2Nonce: row.oauth2_nonce,
          oauth2RefreshToken: row.oauth2_refresh_token
        })
    );

    return typeof id === "string" ? grants[0] : grants;
  }

  public static async write(
    tx: PoolClient,
    data: GrantData,
    metadata: {
      recordId: string;
      createdByTokenId: string;
      createdAt: Date;
    }
  ): Promise<Grant> {
    // ensure that the entity ID exists
    await tx.query(
      `
      INSERT INTO authx.grant
        (id)
      VALUES
        ($1)
      ON CONFLICT DO NOTHING
      `,
      [data.id]
    );

    // replace the previous record
    const previous = await tx.query(
      `
      UPDATE authx.grant_record
      SET replacement_record_id = $2
      WHERE
        entity_id = $1
        AND replacement_record_id IS NULL
      RETURNING entity_id AS id, record_id
      `,
      [data.id, metadata.recordId]
    );

    if (previous.rows.length > 1) {
      throw new Error(
        "INVARIANT: It must be impossible to replace more than one record."
      );
    }

    // insert the new record
    const next = await tx.query(
      `
      INSERT INTO authx.grant_record
      (
        record_id,
        created_by_token_id,
        created_at,
        entity_id,
        enabled,
        client_id,
        user_id,
        oauth2_nonce,
        oauth2_refresh_token,
        scopes
      )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        entity_id AS id,
        enabled,
        client_id,
        user_id,
        oauth2_nonce,
        oauth2_refresh_token,
        scopes
      `,
      [
        metadata.recordId,
        metadata.createdByTokenId,
        metadata.createdAt,
        data.id,
        data.enabled,
        data.clientId,
        data.userId,
        data.oauth2Nonce,
        data.oauth2RefreshToken,
        simplify([...data.scopes])
      ]
    );

    if (next.rows.length !== 1) {
      throw new Error("INVARIANT: Insert must return exactly one row.");
    }

    const row = next.rows[0];
    return new Grant({
      ...row,
      clientId: row.client_id,
      userId: row.user_id,
      oauth2Nonce: row.oauth2_nonce,
      oauth2RefreshToken: row.oauth2_refresh_token
    });
  }
}
