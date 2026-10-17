// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import type express from "express";
import type { ModelController } from "../controller/model.controller";
import { logger } from "../logger";
import { sendRouteError, setVersionIdError, wildcardParam } from "./json_route";

/**
 * The model builder's save route: `PUT …/model-files/<path>` with
 * `{source, expectedHash?}`. 201 for a file that did not exist, 200 for one
 * that was replaced. Refusals are logged at `warn`, like the report write.
 */
export function modelWriteRoute(
   controller: Pick<ModelController, "putModelFile">,
): express.RequestHandler {
   return async (req, res) => {
      if (req.query.versionId) {
         setVersionIdError(res);
         return;
      }
      try {
         const result = await controller.putModelFile(
            req.params.environmentName,
            req.params.packageName,
            wildcardParam(req),
            req.body,
         );
         res.status(result.created ? 201 : 200).json(result);
      } catch (error) {
         sendRouteError(res, error as Error, (status) =>
            logger.warn("Model write refused", {
               packageName: req.params.packageName,
               model: wildcardParam(req),
               status,
               error: (error as Error).message,
            }),
         );
      }
   };
}
