// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import {
   Alert,
   Box,
   Button,
   Dialog,
   DialogActions,
   DialogContent,
   DialogTitle,
   List,
   ListItemButton,
   ListItemText,
   MenuItem,
   Stack,
   Tab,
   Tabs,
   TextField,
   Typography,
} from "@mui/material";
import React, { useState } from "react";
import { useQueryWithApiError } from "../../hooks/useQueryWithApiError";
import { useServer } from "../ServerProvider";
import type { TableNode } from "./modelTypes";

export type TableSeed = Pick<
   TableNode,
   "name" | "connection" | "tablePath" | "columns"
>;

/** `data/flights.parquet` → `flights`. */
const baseName = (path: string) =>
   (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");

/**
 * Pick tables to put on the canvas: the data files the package already holds
 * (read through its DuckDB sandbox), or a table from one of the environment's
 * connections. Picking one adds it and keeps the dialog open, so several can
 * be added in a row.
 */
export function AddTablesDialog({
   open,
   environmentName,
   packageName,
   onAdd,
   onClose,
}: {
   open: boolean;
   environmentName: string;
   packageName: string;
   onAdd: (seed: TableSeed) => void;
   onClose: () => void;
}) {
   const [tab, setTab] = useState<"files" | "connection">("files");
   return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
         <DialogTitle>Add tables</DialogTitle>
         <DialogContent>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
               <Tab value="files" label="Package data files" />
               <Tab value="connection" label="Connection tables" />
            </Tabs>
            {tab === "files" ? (
               <DataFiles
                  environmentName={environmentName}
                  packageName={packageName}
                  onAdd={onAdd}
               />
            ) : (
               <ConnectionTables
                  environmentName={environmentName}
                  onAdd={onAdd}
               />
            )}
         </DialogContent>
         <DialogActions>
            <Button onClick={onClose}>Done</Button>
         </DialogActions>
      </Dialog>
   );
}

function DataFiles({
   environmentName,
   packageName,
   onAdd,
}: {
   environmentName: string;
   packageName: string;
   onAdd: (seed: TableSeed) => void;
}) {
   const { apiClients } = useServer();
   const { data, isLoading, isError } = useQueryWithApiError({
      queryKey: ["modelBuilderDatabases", environmentName, packageName],
      queryFn: () =>
         apiClients.databases.listDatabases(environmentName, packageName),
   });
   const files = (data?.data ?? []).filter((d) => d.path && !d.error);
   if (isError)
      return <Alert severity="error">Could not list data files.</Alert>;
   if (isLoading) return <Typography>Loading…</Typography>;
   if (files.length === 0)
      return (
         <Typography color="text.secondary">
            This package has no CSV, Parquet or other data files.
         </Typography>
      );
   return (
      <List dense>
         {files.map((f) => (
            <ListItemButton
               key={f.path}
               onClick={() =>
                  onAdd({
                     name: baseName(f.path!),
                     connection: "duckdb",
                     tablePath: f.path!,
                     columns: f.info?.columns?.map((c) => ({
                        name: c.name ?? "",
                        type: c.type,
                     })),
                  })
               }
            >
               <ListItemText
                  primary={f.path}
                  secondary={
                     f.info?.columns
                        ? `${f.info.columns.length} columns`
                        : undefined
                  }
               />
            </ListItemButton>
         ))}
      </List>
   );
}

function ConnectionTables({
   environmentName,
   onAdd,
}: {
   environmentName: string;
   onAdd: (seed: TableSeed) => void;
}) {
   const { apiClients } = useServer();
   const [connection, setConnection] = useState("");
   const [schema, setSchema] = useState("");
   const [search, setSearch] = useState("");
   const [failed, setFailed] = useState<string | null>(null);

   const connections = useQueryWithApiError({
      queryKey: ["modelBuilderConnections", environmentName],
      queryFn: () => apiClients.connections.listConnections(environmentName),
   });
   const schemas = useQueryWithApiError({
      queryKey: ["modelBuilderSchemas", environmentName, connection],
      queryFn: () =>
         apiClients.connections.listSchemas(environmentName, connection),
      enabled: !!connection,
   });
   const tables = useQueryWithApiError({
      queryKey: ["modelBuilderTables", environmentName, connection, schema],
      queryFn: () =>
         apiClients.connections.listTables(environmentName, connection, schema),
      enabled: !!connection && !!schema,
   });

   // A table is listed by resource path; its name for Malloy is what follows `/tables/`.
   const tablePathOf = (resource: string) =>
      decodeURIComponent(resource.split("/tables/").pop() ?? resource);
   const listed = (tables.data?.data ?? [])
      .map((t) => tablePathOf(t.resource ?? ""))
      .filter((p) => p && p.toLowerCase().includes(search.toLowerCase()));

   const add = async (tablePath: string) => {
      setFailed(null);
      let columns: TableSeed["columns"];
      try {
         const table = await apiClients.connections.getTable(
            environmentName,
            connection,
            schema,
            tablePath,
         );
         columns = table.data.columns?.map((c) => ({
            name: c.name ?? "",
            type: c.type,
         }));
      } catch {
         // The table can still be added; it just has no column suggestions.
         setFailed(`Added ${tablePath} without its column list.`);
      }
      onAdd({
         name: tablePath.split(".").pop() ?? tablePath,
         connection,
         tablePath,
         columns,
      });
   };

   return (
      <Stack spacing={2}>
         <Stack direction="row" spacing={1}>
            <TextField
               select
               size="small"
               label="Connection"
               value={connection}
               sx={{ flex: 1 }}
               onChange={(e) => {
                  setConnection(e.target.value);
                  setSchema("");
               }}
            >
               {(connections.data?.data ?? []).map((c) => (
                  <MenuItem key={c.name} value={c.name ?? ""}>
                     {c.name}
                  </MenuItem>
               ))}
            </TextField>
            <TextField
               select
               size="small"
               label="Schema"
               value={schema}
               disabled={!connection}
               sx={{ flex: 1 }}
               onChange={(e) => setSchema(e.target.value)}
            >
               {(schemas.data?.data ?? []).map((s) => (
                  <MenuItem key={s.name} value={s.name ?? ""}>
                     {s.name}
                  </MenuItem>
               ))}
            </TextField>
         </Stack>
         {(schemas.isError || tables.isError) && (
            <Alert severity="error">Could not read the database.</Alert>
         )}
         {failed && <Alert severity="info">{failed}</Alert>}
         {schema && (
            <>
               <TextField
                  size="small"
                  placeholder="Search tables"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
               />
               <Box sx={{ maxHeight: 320, overflowY: "auto" }}>
                  <List dense>
                     {listed.map((p) => (
                        <ListItemButton key={p} onClick={() => void add(p)}>
                           <ListItemText primary={p} />
                        </ListItemButton>
                     ))}
                     {tables.isLoading && <Typography>Loading…</Typography>}
                     {!tables.isLoading && listed.length === 0 && (
                        <Typography color="text.secondary">
                           No tables.
                        </Typography>
                     )}
                  </List>
               </Box>
            </>
         )}
      </Stack>
   );
}
