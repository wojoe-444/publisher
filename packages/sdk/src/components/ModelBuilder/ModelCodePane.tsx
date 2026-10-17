// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import { Alert, Box, Link, Stack, Typography } from "@mui/material";
import React from "react";
import type { Diagnostic } from "./modelTypes";
import type { Selection } from "./useModelDraft";

/** The generated Malloy, and what is still wrong with the model; a problem links to the table or join it is about. */
export function ModelCodePane({
   code,
   diagnostics,
   onSelect,
}: {
   code: string;
   diagnostics: Diagnostic[];
   onSelect: (s: Selection) => void;
}) {
   return (
      <Stack sx={{ height: "100%", minHeight: 0 }}>
         <Box
            component="pre"
            aria-label="Generated Malloy"
            sx={{
               m: 0,
               p: 2,
               flex: 1,
               overflow: "auto",
               fontFamily: "monospace",
               fontSize: 12.5,
               lineHeight: 1.5,
               bgcolor: "action.hover",
               whiteSpace: "pre",
            }}
         >
            {code}
         </Box>
         {diagnostics.length > 0 && (
            <Box sx={{ p: 1.5, maxHeight: "35%", overflowY: "auto" }}>
               <Typography variant="overline" color="text.secondary">
                  {diagnostics.length} issue{diagnostics.length > 1 ? "s" : ""}
               </Typography>
               <Stack spacing={0.5}>
                  {diagnostics.map((d, i) => (
                     <Alert
                        key={i}
                        severity={d.severity}
                        icon={false}
                        sx={{ py: 0 }}
                     >
                        <Link
                           component="button"
                           variant="body2"
                           underline="hover"
                           sx={{ textAlign: "left" }}
                           onClick={() =>
                              d.joinId
                                 ? onSelect({ type: "join", id: d.joinId })
                                 : d.tableId &&
                                   onSelect({ type: "table", id: d.tableId })
                           }
                        >
                           {d.message}
                        </Link>
                     </Alert>
                  ))}
               </Stack>
            </Box>
         )}
      </Stack>
   );
}
