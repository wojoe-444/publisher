// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

export interface Field {
   id: string;
   name: string;
   expr: string;
}

/** A named query. `groupBy` / `aggregate` entries are emitted verbatim (a field name or `alias is expr`). */
export interface View {
   id: string;
   name: string;
   groupBy: string[];
   aggregate: string[];
   limit?: number;
}

export interface TableNode {
   id: string;
   /** Malloy source name. */
   name: string;
   /** Connection name, e.g. duckdb, bigquery, postgres. */
   connection: string;
   /** Table path passed to `connection.table('...')`. */
   tablePath: string;
   /** Columns the database reported for the table, when it was added from one. Used for suggestions only. */
   columns?: { name: string; type?: string }[];
   primaryKey: string;
   /** Optional source-level `where:` filter. */
   where: string;
   dimensions: Field[];
   measures: Field[];
   views: View[];
   position: { x: number; y: number };
}

export type JoinKind = "one" | "many" | "cross";
/** `with`: join on the target's primary key using an expression from the source. `on`: free-form condition. */
export type JoinMode = "with" | "on";

/** `from` joins `to`: the join is declared inside the `from` source. */
export interface Join {
   id: string;
   from: string;
   to: string;
   kind: JoinKind;
   mode: JoinMode;
   /** Expression on the `from` side (mode `with`). */
   withKey: string;
   /** Condition (mode `on`). Optional for cross joins. */
   onCondition: string;
   /** Optional name for the joined source (`join_one: alias is target ...`). */
   alias: string;
}

export interface Model {
   tables: TableNode[];
   joins: Join[];
}

export type Severity = "error" | "warning";

export interface Diagnostic {
   severity: Severity;
   message: string;
   tableId?: string;
   joinId?: string;
}
