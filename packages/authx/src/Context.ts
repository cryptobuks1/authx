import { Authorization } from "./model";
import { Explanation } from "./util/explanations";
import { DataLoaderExecutor } from "./loader";

export interface Context {
  readonly realm: string;
  readonly base: string;
  readonly privateKey: string;
  readonly publicKeys: ReadonlyArray<string>;
  readonly codeValidityDuration: number;
  readonly jwtValidityDuration: number;
  readonly sendMail: (options: {
    readonly to: string;
    readonly subject: string;
    readonly text: string;
    readonly html: string;
    readonly from?: string;
  }) => Promise<any>;
  readonly explanations: ReadonlyArray<Explanation>;
  executor: DataLoaderExecutor;
  authorization: null | Authorization;
}
