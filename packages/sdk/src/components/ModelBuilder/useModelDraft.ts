// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import { useCallback, useMemo, useState } from "react";
import {
   addField,
   addJoin,
   addTable,
   addView,
   emptyModel,
   newId,
   removeField,
   removeJoin,
   removeTable,
   removeView,
   updateField,
   updateJoin,
   updateTable,
   updateView,
   type FieldKind,
} from "./modelOps";
import type { Field, Join, Model, TableNode, View } from "./modelTypes";

/** What the inspector shows: a table, a join, or (null) the table list. */
export type Selection = { type: "table" | "join"; id: string } | null;

/** The model being drawn, the selection, and every edit the builder makes to them. */
export function useModelDraft(initial: Model = emptyModel) {
   const [model, setModel] = useState<Model>(initial);
   const [selection, setSelection] = useState<Selection>(null);

   const actions = useMemo(
      () => ({
         addTable: (seed?: Partial<TableNode>) => {
            // The id is made here, not in the updater, which React may run twice.
            const id = newId("t");
            setModel((m) => addTable(m, seed, id).model);
            setSelection({ type: "table", id });
         },
         updateTable: (id: string, patch: Partial<TableNode>) =>
            setModel((m) => updateTable(m, id, patch)),
         removeTable: (id: string) => {
            setModel((m) => removeTable(m, id));
            setSelection((s) => (s?.id === id ? null : s));
         },
         addField: (tableId: string, kind: FieldKind) =>
            setModel((m) => addField(m, tableId, kind)),
         updateField: (
            tableId: string,
            kind: FieldKind,
            fieldId: string,
            patch: Partial<Field>,
         ) => setModel((m) => updateField(m, tableId, kind, fieldId, patch)),
         removeField: (tableId: string, kind: FieldKind, fieldId: string) =>
            setModel((m) => removeField(m, tableId, kind, fieldId)),
         addView: (tableId: string) => setModel((m) => addView(m, tableId)),
         updateView: (tableId: string, viewId: string, patch: Partial<View>) =>
            setModel((m) => updateView(m, tableId, viewId, patch)),
         removeView: (tableId: string, viewId: string) =>
            setModel((m) => removeView(m, tableId, viewId)),
         addJoin: (from: string, to: string) => {
            const id = newId("j");
            setModel((m) => addJoin(m, from, to, id)?.model ?? m);
            // A refused join (a table joined to itself) leaves a selection with no join behind it.
            if (from !== to) setSelection({ type: "join", id });
         },
         updateJoin: (id: string, patch: Partial<Join>) =>
            setModel((m) => updateJoin(m, id, patch)),
         removeJoin: (id: string) => {
            setModel((m) => removeJoin(m, id));
            setSelection((s) => (s?.id === id ? null : s));
         },
         replace: (next: Model) => {
            setModel(next);
            setSelection(null);
         },
      }),
      [],
   );

   const select = useCallback((s: Selection) => setSelection(s), []);
   return { model, selection, select, ...actions };
}
