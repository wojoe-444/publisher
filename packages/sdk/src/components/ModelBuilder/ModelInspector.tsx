// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
   Box,
   Button,
   IconButton,
   Link,
   MenuItem,
   Stack,
   TextField,
   Typography,
} from "@mui/material";
import React from "react";
import { joinName } from "./generateMalloy";
import type { FieldKind } from "./modelOps";
import type { Join, JoinKind, Model, TableNode, View } from "./modelTypes";
import type { Selection, useModelDraft } from "./useModelDraft";

type Draft = ReturnType<typeof useModelDraft>;

const MONO = { fontFamily: "monospace", fontSize: 13 };

function SectionHeading({
   title,
   action,
}: {
   title: string;
   action?: React.ReactNode;
}) {
   return (
      <Stack
         direction="row"
         alignItems="center"
         justifyContent="space-between"
         sx={{ mt: 3, mb: 1 }}
      >
         <Typography variant="overline" color="text.secondary">
            {title}
         </Typography>
         {action}
      </Stack>
   );
}

/** The panel left of the canvas: the table list, a table's fields, or a join's settings. */
export function ModelInspector({
   draft,
   onAddEmptyTable,
}: {
   draft: Draft;
   onAddEmptyTable: () => void;
}) {
   const { model, selection } = draft;
   const table =
      selection?.type === "table"
         ? model.tables.find((t) => t.id === selection.id)
         : undefined;
   const join =
      selection?.type === "join"
         ? model.joins.find((j) => j.id === selection.id)
         : undefined;
   return (
      <Box sx={{ p: 2, overflowY: "auto", height: "100%" }}>
         {table ? (
            <TableEditor table={table} draft={draft} />
         ) : join ? (
            <JoinEditor join={join} draft={draft} />
         ) : (
            <TableList
               model={model}
               onSelect={draft.select}
               onAddEmptyTable={onAddEmptyTable}
            />
         )}
      </Box>
   );
}

function TableList({
   model,
   onSelect,
   onAddEmptyTable,
}: {
   model: Model;
   onSelect: (s: Selection) => void;
   onAddEmptyTable: () => void;
}) {
   return (
      <>
         <Typography variant="h6">Tables</Typography>
         <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            Select a table to edit its fields. Drag from the dot on the right of
            one table to the dot on the left of another to join them.
            Double-click the canvas to add a table.
         </Typography>
         <Stack spacing={0.5} sx={{ mb: 2 }}>
            {model.tables.map((t) => (
               <Link
                  key={t.id}
                  component="button"
                  variant="body2"
                  underline="hover"
                  sx={{ textAlign: "left" }}
                  onClick={() => onSelect({ type: "table", id: t.id })}
               >
                  {t.name || "unnamed"}
                  <Typography
                     component="span"
                     variant="caption"
                     color="text.secondary"
                  >
                     {" "}
                     · {t.dimensions.length} dimensions · {t.measures.length}{" "}
                     measures
                  </Typography>
               </Link>
            ))}
         </Stack>
         <Button size="small" onClick={onAddEmptyTable}>
            Add empty table
         </Button>
      </>
   );
}

function TableEditor({ table, draft }: { table: TableNode; draft: Draft }) {
   const { model } = draft;
   const patch = (p: Partial<TableNode>) => draft.updateTable(table.id, p);
   const outgoing = model.joins.filter((j) => j.from === table.id);
   const columns = table.columns?.map((c) => c.name) ?? [];
   const fieldNames = [...table.dimensions, ...table.measures]
      .map((f) => f.name)
      .filter(Boolean);
   return (
      <>
         <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6">Source</Typography>
            <Button
               size="small"
               color="error"
               onClick={() => draft.removeTable(table.id)}
            >
               Delete table
            </Button>
         </Stack>
         <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
               label="Source name"
               size="small"
               value={table.name}
               onChange={(e) => patch({ name: e.target.value })}
            />
            <Stack direction="row" spacing={1}>
               <TextField
                  label="Connection"
                  size="small"
                  value={table.connection}
                  onChange={(e) => patch({ connection: e.target.value })}
               />
               <TextField
                  label="Primary key"
                  size="small"
                  value={table.primaryKey}
                  onChange={(e) => patch({ primaryKey: e.target.value })}
                  slotProps={{ htmlInput: { list: `cols-${table.id}` } }}
               />
               <datalist id={`cols-${table.id}`}>
                  {columns.map((c) => (
                     <option key={c} value={c} />
                  ))}
               </datalist>
            </Stack>
            <TextField
               label="Table path"
               size="small"
               value={table.tablePath}
               helperText="Passed to connection.table('…'), e.g. data/flights.parquet or schema.table"
               onChange={(e) => patch({ tablePath: e.target.value })}
            />
            <TextField
               label="Filter (optional)"
               size="small"
               value={table.where}
               helperText="A where: on the source"
               slotProps={{ htmlInput: { style: MONO } }}
               onChange={(e) => patch({ where: e.target.value })}
            />
         </Stack>

         <SectionHeading title="Joins from this source" />
         {outgoing.length === 0 && (
            <Typography variant="body2" color="text.secondary">
               Drag from this table&apos;s right dot to another table to add
               one.
            </Typography>
         )}
         {outgoing.map((j) => (
            <Link
               key={j.id}
               component="button"
               variant="body2"
               underline="hover"
               display="block"
               onClick={() => draft.select({ type: "join", id: j.id })}
            >
               join_{j.kind}: {joinName(j, model)}
            </Link>
         ))}

         {(["dimensions", "measures"] as FieldKind[]).map((kind) => (
            <FieldList key={kind} table={table} kind={kind} draft={draft} />
         ))}

         <SectionHeading
            title="Views"
            action={
               <Button size="small" onClick={() => draft.addView(table.id)}>
                  Add
               </Button>
            }
         />
         {table.views.map((v) => (
            <ViewEditor
               key={v.id}
               tableId={table.id}
               view={v}
               draft={draft}
               fieldNames={[...columns, ...fieldNames]}
            />
         ))}
      </>
   );
}

function FieldList({
   table,
   kind,
   draft,
}: {
   table: TableNode;
   kind: FieldKind;
   draft: Draft;
}) {
   const isDimension = kind === "dimensions";
   return (
      <>
         <SectionHeading
            title={isDimension ? "Dimensions" : "Measures"}
            action={
               <Button
                  size="small"
                  onClick={() => draft.addField(table.id, kind)}
               >
                  Add
               </Button>
            }
         />
         {table[kind].length === 0 && (
            <Typography variant="body2" color="text.secondary">
               {isDimension
                  ? "Computed columns, e.g. dep_delay > 15"
                  : "Aggregates, e.g. count() or avg(dep_delay)"}
            </Typography>
         )}
         {table[kind].map((f) => (
            <Stack
               key={f.id}
               direction="row"
               spacing={0.5}
               alignItems="center"
               sx={{ mb: 1 }}
            >
               <TextField
                  size="small"
                  placeholder="name"
                  value={f.name}
                  sx={{ width: "38%" }}
                  onChange={(e) =>
                     draft.updateField(table.id, kind, f.id, {
                        name: e.target.value,
                     })
                  }
               />
               <Typography variant="caption" color="text.secondary">
                  is
               </Typography>
               <TextField
                  size="small"
                  placeholder={isDimension ? "expression" : "count()"}
                  value={f.expr}
                  sx={{ flex: 1 }}
                  slotProps={{
                     htmlInput: { style: MONO, list: `cols-${table.id}` },
                  }}
                  onChange={(e) =>
                     draft.updateField(table.id, kind, f.id, {
                        expr: e.target.value,
                     })
                  }
               />
               <IconButton
                  size="small"
                  aria-label={`Remove ${f.name || "field"}`}
                  onClick={() => draft.removeField(table.id, kind, f.id)}
               >
                  <DeleteOutlineIcon fontSize="small" />
               </IconButton>
            </Stack>
         ))}
      </>
   );
}

const lines = (text: string) => text.split("\n");

function ViewEditor({
   tableId,
   view,
   draft,
   fieldNames,
}: {
   tableId: string;
   view: View;
   draft: Draft;
   fieldNames: string[];
}) {
   const hint = fieldNames.length
      ? `One per line. Available: ${fieldNames.slice(0, 12).join(", ")}${fieldNames.length > 12 ? ", …" : ""}`
      : "One per line";
   return (
      <Box
         sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            p: 1,
            mb: 1,
         }}
      >
         <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
            <TextField
               size="small"
               placeholder="view name"
               value={view.name}
               sx={{ flex: 1 }}
               onChange={(e) =>
                  draft.updateView(tableId, view.id, { name: e.target.value })
               }
            />
            <TextField
               size="small"
               type="number"
               placeholder="limit"
               value={view.limit ?? ""}
               sx={{ width: 84 }}
               onChange={(e) =>
                  draft.updateView(tableId, view.id, {
                     limit: e.target.value ? Number(e.target.value) : undefined,
                  })
               }
            />
            <IconButton
               size="small"
               aria-label={`Remove view ${view.name}`}
               onClick={() => draft.removeView(tableId, view.id)}
            >
               <DeleteOutlineIcon fontSize="small" />
            </IconButton>
         </Stack>
         {(
            [
               ["group_by", "groupBy"],
               ["aggregate", "aggregate"],
            ] as const
         ).map(([label, key]) => (
            <TextField
               key={key}
               label={label}
               size="small"
               multiline
               minRows={2}
               fullWidth
               helperText={hint}
               sx={{ mb: 1 }}
               value={view[key].join("\n")}
               slotProps={{ htmlInput: { style: MONO } }}
               onChange={(e) =>
                  draft.updateView(tableId, view.id, {
                     [key]: lines(e.target.value),
                  })
               }
            />
         ))}
      </Box>
   );
}

function JoinEditor({ join, draft }: { join: Join; draft: Draft }) {
   const from = draft.model.tables.find((t) => t.id === join.from);
   const to = draft.model.tables.find((t) => t.id === join.to);
   if (!from || !to) return null;
   const patch = (p: Partial<Join>) => draft.updateJoin(join.id, p);
   const alias = join.alias.trim() || to.name;
   const hasKey = !!to.primaryKey.trim();
   return (
      <>
         <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6">Join</Typography>
            <Button
               size="small"
               color="error"
               onClick={() => draft.removeJoin(join.id)}
            >
               Delete join
            </Button>
         </Stack>
         <Typography variant="body2" sx={{ my: 1 }}>
            <Link
               component="button"
               onClick={() => draft.select({ type: "table", id: from.id })}
            >
               {from.name}
            </Link>
            {" → "}
            <Link
               component="button"
               onClick={() => draft.select({ type: "table", id: to.id })}
            >
               {to.name}
            </Link>
         </Typography>
         <Stack spacing={2}>
            <TextField
               select
               size="small"
               label="Relationship"
               value={join.kind}
               onChange={(e) => patch({ kind: e.target.value as JoinKind })}
            >
               <MenuItem value="one">
                  join_one: at most one matching row
               </MenuItem>
               <MenuItem value="many">join_many: many matching rows</MenuItem>
               <MenuItem value="cross">join_cross: every combination</MenuItem>
            </TextField>
            <TextField
               size="small"
               label="Name (optional)"
               placeholder={to.name}
               value={join.alias}
               helperText="Needed when the same table is joined twice, e.g. origin_airport"
               onChange={(e) => patch({ alias: e.target.value })}
            />
            {join.kind !== "cross" && (
               <>
                  <TextField
                     select
                     size="small"
                     label="Join using"
                     value={join.mode}
                     onChange={(e) =>
                        patch({ mode: e.target.value as Join["mode"] })
                     }
                  >
                     <MenuItem value="with" disabled={!hasKey}>
                        with: {to.name}&apos;s primary key
                        {hasKey ? ` (${to.primaryKey})` : " (not set)"}
                     </MenuItem>
                     <MenuItem value="on">on: a custom condition</MenuItem>
                  </TextField>
                  {join.mode === "with" ? (
                     <TextField
                        size="small"
                        label={`${from.name} field`}
                        value={join.withKey}
                        helperText={`Matched against ${to.name}.${to.primaryKey || "primary key"}`}
                        slotProps={{
                           htmlInput: { style: MONO, list: `cols-${from.id}` },
                        }}
                        onChange={(e) => patch({ withKey: e.target.value })}
                     />
                  ) : (
                     <TextField
                        size="small"
                        label="Condition"
                        value={join.onCondition}
                        placeholder={`${alias}.code = carrier`}
                        helperText={`Refer to the joined table as ${alias}`}
                        slotProps={{ htmlInput: { style: MONO } }}
                        onChange={(e) => patch({ onCondition: e.target.value })}
                     />
                  )}
               </>
            )}
            {join.kind === "cross" && (
               <TextField
                  size="small"
                  label="Condition (optional)"
                  value={join.onCondition}
                  slotProps={{ htmlInput: { style: MONO } }}
                  onChange={(e) => patch({ onCondition: e.target.value })}
               />
            )}
         </Stack>
         <datalist id={`cols-${from.id}`}>
            {(from.columns ?? []).map((c) => (
               <option key={c.name} value={c.name} />
            ))}
         </datalist>
      </>
   );
}
