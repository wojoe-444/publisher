// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import { encodeResourceUri } from "@malloy-publisher/sdk";
import { Box, CircularProgress } from "@mui/material";
import "@xyflow/react/dist/style.css";
import React, { Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";

// The builder's canvas is a chunk of its own: most Console users never open it.
const ModelBuilder = React.lazy(() =>
   import("@malloy-publisher/sdk/model-builder").then((m) => ({
      default: m.ModelBuilder,
   })),
);

/** The Console's host for the SDK `ModelBuilder`: draw a model, save it into the package. */
export default function ModelBuilderPage() {
   const { environmentName, packageName } = useParams();
   const navigate = useNavigate();
   if (!environmentName || !packageName) return null;
   const resourceUri = encodeResourceUri({ environmentName, packageName });
   const toPackage = () => navigate(`/${environmentName}/${packageName}`);
   return (
      // The builder fills the viewport under the header: a canvas needs a height.
      <Box sx={{ height: "calc(100vh - 120px)", minHeight: 520 }}>
         <Suspense fallback={<CircularProgress />}>
            <ModelBuilder resourceUri={resourceUri} onCancel={toPackage} />
         </Suspense>
      </Box>
   );
}
