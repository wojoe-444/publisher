// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import {
   Alert,
   Box,
   Button,
   Stack,
   TextField,
   Typography,
} from "@mui/material";
import { ReactFlowProvider } from "@xyflow/react";
import React, { useMemo, useState } from "react";
import { parseResourceUri } from "../../utils/formatting";
import { useServer } from "../ServerProvider";
import { AddTablesDialog } from "./AddTablesDialog";
import { generateMalloy, validateModel } from "./generateMalloy";
import { ModelCanvas } from "./ModelCanvas";
import { ModelCodePane } from "./ModelCodePane";
import { ModelInspector } from "./ModelInspector";
import { useModelDraft } from "./useModelDraft";

export interface ModelBuilderProps {
   /** The package the model is saved into. */
   resourceUri: string;
   /** The model was written into the package; `path` is where. */
   onSaved?: (path: string) => void;
   /** Leave the builder without saving. */
   onCancel?: () => void;
}

/** What the server said, for a refused write: its message, else the status. */
function messageOf(error: unknown): string {
   const response = (
      error as { response?: { data?: { message?: string }; status?: number } }
   )?.response;
   return (
      response?.data?.message ??
      (response?.status
         ? `The server answered ${response.status}.`
         : undefined) ??
      (error instanceof Error ? error.message : "The model could not be saved.")
   );
}

/**
 * Draw a Malloy model: tables on a canvas, joins dragged between them, fields
 * defined in the panel on the left, and the Malloy it comes to on the right.
 * Saving writes the text into the package as a model file.
 */
export function ModelBuilder({
   resourceUri,
   onSaved,
   onCancel,
}: ModelBuilderProps) {
   const { apiClients } = useServer();
   const { environmentName, packageName } = parseResourceUri(resourceUri);
   const draft = useModelDraft();
   const [path, setPath] = useState("models/model.malloy");
   const [adding, setAdding] = useState(false);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState<string | null>(null);
   // What the file held when this builder last wrote it: the proof of what we opened.
   const [savedHash, setSavedHash] = useState<string | undefined>();
   const [savedAt, setSavedAt] = useState<string | undefined>();

   const { model } = draft;
   const code = useMemo(() => generateMalloy(model), [model]);
   const diagnostics = useMemo(() => validateModel(model), [model]);
   const blocked =
      model.tables.length === 0 ||
      diagnostics.some((d) => d.severity === "error");
   const pathProblem =
      !path.endsWith(".malloy") || path.startsWith("/") || path.includes("..")
         ? "A model path ends in .malloy and stays inside the package."
         : undefined;

   const save = async () => {
      setSaving(true);
      setError(null);
      try {
         const result = await apiClients.models.updateModelFile(
            environmentName,
            packageName,
            path,
            {
               source: code,
               expectedHash: savedAt === path ? savedHash : undefined,
            },
         );
         setSavedHash(result.data.contentHash);
         setSavedAt(path);
         onSaved?.(path);
      } catch (e) {
         setError(messageOf(e));
      } finally {
         setSaving(false);
      }
   };

   return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
         <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}
         >
            <Typography variant="h6" sx={{ mr: 1 }}>
               Model builder
            </Typography>
            <Button variant="outlined" onClick={() => setAdding(true)}>
               Add tables
            </Button>
            <Box sx={{ flex: 1 }} />
            <TextField
               size="small"
               label="Save as"
               value={path}
               error={!!pathProblem}
               helperText={pathProblem}
               onChange={(e) => setPath(e.target.value)}
               sx={{ width: 280 }}
            />
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
            <Button
               variant="contained"
               disabled={blocked || !!pathProblem || saving}
               onClick={() => void save()}
            >
               {saving ? "Saving…" : "Save model"}
            </Button>
         </Stack>
         {error && (
            <Alert severity="error" onClose={() => setError(null)}>
               {error}
            </Alert>
         )}
         {savedAt && !error && (
            <Alert severity="success">
               Saved to {savedAt}. The package was reloaded with it.
            </Alert>
         )}
         <Box
            sx={{
               flex: 1,
               minHeight: 0,
               display: "grid",
               gridTemplateColumns: "340px minmax(0, 1fr) 440px",
            }}
         >
            <Box sx={{ borderRight: 1, borderColor: "divider", minHeight: 0 }}>
               <ModelInspector
                  draft={draft}
                  onAddEmptyTable={() => draft.addTable()}
               />
            </Box>
            <Box sx={{ minWidth: 0, minHeight: 0 }}>
               <ReactFlowProvider>
                  <ModelCanvas
                     model={model}
                     selection={draft.selection}
                     onSelect={draft.select}
                     onConnect={draft.addJoin}
                     onMove={(id, position) =>
                        draft.updateTable(id, { position })
                     }
                     onDeleteTable={draft.removeTable}
                     onDeleteJoin={draft.removeJoin}
                     onAddTableAt={(position) => draft.addTable({ position })}
                  />
               </ReactFlowProvider>
            </Box>
            <Box sx={{ borderLeft: 1, borderColor: "divider", minHeight: 0 }}>
               <ModelCodePane
                  code={code}
                  diagnostics={diagnostics}
                  onSelect={draft.select}
               />
            </Box>
         </Box>
         <AddTablesDialog
            open={adding}
            environmentName={environmentName}
            packageName={packageName}
            onAdd={(seed) => draft.addTable(seed)}
            onClose={() => setAdding(false)}
         />
      </Box>
   );
}
