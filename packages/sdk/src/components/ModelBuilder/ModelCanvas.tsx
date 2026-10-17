// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import { Box, Typography, useTheme } from "@mui/material";
import {
   Background,
   BaseEdge,
   ConnectionMode,
   Controls,
   EdgeLabelRenderer,
   getBezierPath,
   Handle,
   MarkerType,
   MiniMap,
   Position,
   ReactFlow,
   useNodesState,
   useReactFlow,
   type Connection,
   type Edge,
   type EdgeProps,
   type Node,
   type NodeProps,
} from "@xyflow/react";
import React, { useCallback, useEffect, useMemo } from "react";
import { joinName } from "./generateMalloy";
import type { Model } from "./modelTypes";
import type { Selection } from "./useModelDraft";

type TableFlowNode = Node<{ tableId: string }, "table">;
type JoinFlowEdge = Edge<{ label: string; index: number }, "join">;

const MAX_ROWS = 8;

/** One source on the canvas: its name, where it reads from, and its fields. */
function TableNodeView({ data, selected }: NodeProps<TableFlowNode>) {
   const theme = useTheme();
   const model = React.useContext(ModelContext);
   const table = model.tables.find((t) => t.id === data.tableId);
   if (!table) return null;
   const rows = [
      ...table.dimensions
         .filter((f) => f.name)
         .map((f) => ({ tag: "dim", name: f.name })),
      ...table.measures
         .filter((f) => f.name)
         .map((f) => ({ tag: "measure", name: f.name })),
   ];
   const handle = {
      width: 12,
      height: 12,
      background: theme.palette.primary.main,
      border: `2px solid ${theme.palette.background.paper}`,
   };
   return (
      <Box
         sx={{
            minWidth: 190,
            maxWidth: 260,
            px: 1.5,
            py: 1,
            borderRadius: 2,
            bgcolor: "background.paper",
            border: 1.5,
            borderStyle: "solid",
            borderColor: selected ? "primary.main" : "divider",
            boxShadow: selected
               ? `0 0 0 2px ${theme.palette.primary.light}`
               : 1,
         }}
      >
         <Handle
            type="target"
            position={Position.Left}
            style={handle}
            title="Drop a join here"
         />
         <Box
            sx={{ display: "flex", justifyContent: "space-between", gap: 1.5 }}
         >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
               {table.name || "unnamed"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
               {table.connection}
            </Typography>
         </Box>
         <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            component="div"
            title={table.tablePath}
            sx={{ mb: 0.5 }}
         >
            {table.tablePath || "no table path"}
         </Typography>
         {table.primaryKey && (
            <Typography variant="caption" component="div">
               <b>pk</b> {table.primaryKey}
            </Typography>
         )}
         {rows.slice(0, MAX_ROWS).map((r) => (
            <Typography
               key={`${r.tag}:${r.name}`}
               variant="caption"
               component="div"
            >
               <b>{r.tag === "dim" ? "dim" : "m"}</b> {r.name}
            </Typography>
         ))}
         {rows.length > MAX_ROWS && (
            <Typography variant="caption" color="text.secondary">
               +{rows.length - MAX_ROWS} more
            </Typography>
         )}
         <Handle
            type="source"
            position={Position.Right}
            style={handle}
            title="Drag to another table to join it"
         />
      </Box>
   );
}

/** A join: a curve from the joining source to the joined one, labelled with what Malloy will say. */
function JoinEdgeView(props: EdgeProps<JoinFlowEdge>) {
   const {
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
   } = props;
   const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
   });
   // Several joins between one pair of tables share a path: stagger the labels.
   const dy = (props.data?.index ?? 0) * 24;
   return (
      <>
         <BaseEdge
            id={props.id}
            path={path}
            markerEnd={props.markerEnd}
            interactionWidth={24}
            style={{ strokeWidth: props.selected ? 2.5 : 1.5 }}
         />
         <EdgeLabelRenderer>
            <Box
               sx={{
                  position: "absolute",
                  pointerEvents: "all",
                  px: 0.75,
                  borderRadius: 3,
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: props.selected ? "primary.main" : "divider",
                  fontFamily: "monospace",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + dy}px)`,
               }}
            >
               {props.data?.label}
            </Box>
         </EdgeLabelRenderer>
      </>
   );
}

const nodeTypes = { table: TableNodeView };
const edgeTypes = { join: JoinEdgeView };

/** The nodes read their table from here so a keystroke in the inspector redraws them without resetting the canvas. */
const ModelContext = React.createContext<Model>({ tables: [], joins: [] });

export function ModelCanvas({
   model,
   selection,
   onSelect,
   onConnect,
   onMove,
   onDeleteTable,
   onDeleteJoin,
   onAddTableAt,
}: {
   model: Model;
   selection: Selection;
   onSelect: (selection: Selection) => void;
   /** A line dragged from `from`'s right dot to `to`'s left dot. */
   onConnect: (from: string, to: string) => void;
   onMove: (tableId: string, position: { x: number; y: number }) => void;
   onDeleteTable: (tableId: string) => void;
   onDeleteJoin: (joinId: string) => void;
   onAddTableAt: (position: { x: number; y: number }) => void;
}) {
   const { screenToFlowPosition, fitView } = useReactFlow();
   const [nodes, setNodes, onNodesChange] = useNodesState<TableFlowNode>([]);

   // React Flow owns measured sizes and live drag positions; keep its node
   // list in step with the model's tables without discarding either.
   const tableKey = model.tables.map((t) => t.id).join("|");
   const selectedTable = selection?.type === "table" ? selection.id : null;
   useEffect(() => {
      setNodes((previous) =>
         model.tables.map((t) => {
            const old = previous.find((n) => n.id === t.id);
            return {
               ...old,
               id: t.id,
               type: "table",
               position: old?.position ?? t.position,
               data: { tableId: t.id },
               selected: t.id === selectedTable,
            } as TableFlowNode;
         }),
      );
      // The table list is keyed by id on purpose: edits to a table's fields
      // reach the nodes through ModelContext.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [tableKey, selectedTable, setNodes]);

   // A table added from the dialog may land outside the view: frame them all
   // once React Flow has measured the new nodes.
   const tableCount = model.tables.length;
   useEffect(() => {
      if (tableCount === 0) return;
      const frame = requestAnimationFrame(
         () => void fitView({ padding: 0.3, maxZoom: 1, duration: 200 }),
      );
      return () => cancelAnimationFrame(frame);
   }, [tableCount, fitView]);

   const edges = useMemo<JoinFlowEdge[]>(() => {
      const seen = new Map<string, number>();
      return model.joins.map((j) => {
         const pair = `${j.from}>${j.to}`;
         const index = seen.get(pair) ?? 0;
         seen.set(pair, index + 1);
         const how =
            j.kind === "cross"
               ? ""
               : j.mode === "with"
                 ? ` with ${j.withKey || "?"}`
                 : " on …";
         return {
            id: j.id,
            type: "join",
            source: j.from,
            target: j.to,
            selected: selection?.type === "join" && selection.id === j.id,
            markerEnd: { type: MarkerType.ArrowClosed },
            data: {
               label: `join_${j.kind}: ${joinName(j, model)}${how}`,
               index,
            },
         };
      });
   }, [model, selection]);

   const connect = useCallback(
      (c: Connection) => {
         if (c.source && c.target) onConnect(c.source, c.target);
      },
      [onConnect],
   );

   return (
      <ModelContext.Provider value={model}>
         <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Strict}
            onNodesChange={onNodesChange}
            onConnect={connect}
            onNodeDragStop={(_, node) => onMove(node.id, node.position)}
            onNodesDelete={(deleted) =>
               deleted.forEach((n) => onDeleteTable(n.id))
            }
            onEdgesDelete={(deleted) =>
               deleted.forEach((e) => onDeleteJoin(e.id))
            }
            onNodeClick={(_, n) => onSelect({ type: "table", id: n.id })}
            onEdgeClick={(_, e) => onSelect({ type: "join", id: e.id })}
            onPaneClick={() => onSelect(null)}
            isValidConnection={(c) =>
               !!c.source && !!c.target && c.source !== c.target
            }
            zoomOnDoubleClick={false}
            onDoubleClick={(e) => {
               if (
                  (e.target as HTMLElement).classList.contains(
                     "react-flow__pane",
                  )
               )
                  onAddTableAt(
                     screenToFlowPosition({ x: e.clientX, y: e.clientY }),
                  );
            }}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            deleteKeyCode={["Backspace", "Delete"]}
         >
            <Background gap={20} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
         </ReactFlow>
      </ModelContext.Provider>
   );
}
