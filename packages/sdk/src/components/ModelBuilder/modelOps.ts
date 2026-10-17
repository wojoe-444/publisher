// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import type { Field, Join, Model, TableNode, View } from "./modelTypes";

/** The two field lists a table carries, by what its entries are. */
export type FieldKind = "dimensions" | "measures";

export const emptyModel: Model = { tables: [], joins: [] };

export const newId = (prefix: string): string =>
   `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const mapTable = (
   model: Model,
   id: string,
   change: (table: TableNode) => TableNode,
): Model => ({
   ...model,
   tables: model.tables.map((t) => (t.id === id ? change(t) : t)),
});

/** A source name not yet used in the model, from a base such as a table name. */
export function uniqueSourceName(model: Model, base: string): string {
   const taken = new Set(model.tables.map((t) => t.name));
   const clean = base.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1");
   const stem = clean || "table";
   if (!taken.has(stem)) return stem;
   let n = 2;
   while (taken.has(`${stem}_${n}`)) n++;
   return `${stem}_${n}`;
}

/** Where the next table goes on the canvas: a grid, three across. */
export function nextPosition(model: Model): { x: number; y: number } {
   const count = model.tables.length;
   return { x: 40 + (count % 3) * 300, y: 40 + Math.floor(count / 3) * 220 };
}

export function addTable(
   model: Model,
   seed: Partial<TableNode> = {},
   id: string = newId("t"),
): { model: Model; id: string } {
   const table: TableNode = {
      id,
      name: uniqueSourceName(model, seed.name ?? "table"),
      connection: seed.connection ?? model.tables[0]?.connection ?? "duckdb",
      tablePath: seed.tablePath ?? "",
      columns: seed.columns,
      primaryKey: "",
      where: "",
      dimensions: [],
      measures: [{ id: newId("m"), name: "row_count", expr: "count()" }],
      views: [],
      position: seed.position ?? nextPosition(model),
   };
   return { model: { ...model, tables: [...model.tables, table] }, id };
}

export const updateTable = (
   model: Model,
   id: string,
   patch: Partial<TableNode>,
): Model => mapTable(model, id, (t) => ({ ...t, ...patch }));

export const removeTable = (model: Model, id: string): Model => ({
   tables: model.tables.filter((t) => t.id !== id),
   joins: model.joins.filter((j) => j.from !== id && j.to !== id),
});

export const addField = (
   model: Model,
   tableId: string,
   kind: FieldKind,
): Model =>
   mapTable(model, tableId, (t) => ({
      ...t,
      [kind]: [...t[kind], { id: newId("f"), name: "", expr: "" }],
   }));

export const updateField = (
   model: Model,
   tableId: string,
   kind: FieldKind,
   fieldId: string,
   patch: Partial<Field>,
): Model =>
   mapTable(model, tableId, (t) => ({
      ...t,
      [kind]: t[kind].map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
   }));

export const removeField = (
   model: Model,
   tableId: string,
   kind: FieldKind,
   fieldId: string,
): Model =>
   mapTable(model, tableId, (t) => ({
      ...t,
      [kind]: t[kind].filter((f) => f.id !== fieldId),
   }));

export const addView = (model: Model, tableId: string): Model =>
   mapTable(model, tableId, (t) => ({
      ...t,
      views: [
         ...t.views,
         {
            id: newId("v"),
            name: `view_${t.views.length + 1}`,
            groupBy: [],
            aggregate: [],
         },
      ],
   }));

export const updateView = (
   model: Model,
   tableId: string,
   viewId: string,
   patch: Partial<View>,
): Model =>
   mapTable(model, tableId, (t) => ({
      ...t,
      views: t.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)),
   }));

export const removeView = (
   model: Model,
   tableId: string,
   viewId: string,
): Model =>
   mapTable(model, tableId, (t) => ({
      ...t,
      views: t.views.filter((v) => v.id !== viewId),
   }));

/**
 * Join `to` from `from`. A source cannot join itself in Malloy, so that is
 * refused. When the target has a primary key the join starts as `with` that
 * key, since foreign keys are often named after it.
 */
export function addJoin(
   model: Model,
   from: string,
   to: string,
   id: string = newId("j"),
): { model: Model; id: string } | undefined {
   if (from === to) return undefined;
   const target = model.tables.find((t) => t.id === to);
   if (!target || !model.tables.some((t) => t.id === from)) return undefined;
   const hasKey = !!target.primaryKey.trim();
   const join: Join = {
      id,
      from,
      to,
      kind: "one",
      mode: hasKey ? "with" : "on",
      withKey: hasKey ? target.primaryKey : "",
      onCondition: "",
      alias: "",
   };
   return { model: { ...model, joins: [...model.joins, join] }, id: join.id };
}

export const updateJoin = (
   model: Model,
   id: string,
   patch: Partial<Join>,
): Model => ({
   ...model,
   joins: model.joins.map((j) => (j.id === id ? { ...j, ...patch } : j)),
});

export const removeJoin = (model: Model, id: string): Model => ({
   ...model,
   joins: model.joins.filter((j) => j.id !== id),
});
