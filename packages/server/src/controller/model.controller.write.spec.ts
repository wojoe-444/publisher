// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import sinon from "sinon";
import {
   BadRequestError,
   CompileRefusedError,
   FrozenConfigError,
   InvalidModelPathError,
   WriteConflictError,
   WriteRolledBackError,
} from "../errors";
import type { EnvironmentStore } from "../service/environment_store";
import { MODEL_BUILDER_MARKER, ModelController } from "./model.controller";

/**
 * The model builder's write path against a stubbed environment. The service
 * runs `check` and `verify` under the package lock, so the stub runs them too:
 * `check` IS the 409/400 and `verify` IS the rollback trigger.
 */
const PATH = "models/sales.malloy";
const TEXT = `${MODEL_BUILDER_MARKER}\n\nsource: sales is duckdb.table('sales.parquet')\n`;
const hash = (text: string) =>
   createHash("sha256").update(text, "utf8").digest("hex");

function harness(
   options: {
      frozen?: boolean;
      current?: string;
      problems?: Array<{ severity: string; message: string }>;
      reloadCompiles?: boolean;
   } = {},
) {
   const model = {
      getModel:
         options.reloadCompiles === false
            ? sinon.stub().rejects(new Error("bad"))
            : sinon.stub().resolves({}),
   };
   const pkg = { getModel: sinon.stub().returns(model) };
   const environment = {
      getPackage: sinon.stub().resolves(pkg),
      compileSource: sinon
         .stub()
         .resolves({ problems: options.problems ?? [] }),
      writeModelFileTransactional: sinon
         .stub()
         .callsFake(
            async (
               _pkg: string,
               _path: string,
               _source: string,
               check: (current: string | undefined) => void,
               verify: (reloaded: unknown) => Promise<unknown>,
            ) => {
               check(options.current);
               try {
                  return {
                     previous: options.current,
                     verified: await verify(pkg),
                  };
               } catch {
                  throw new WriteRolledBackError("rolled back");
               }
            },
         ),
   };
   const store = {
      publisherConfigIsFrozen: options.frozen ?? false,
      getEnvironment: sinon.stub().resolves(environment),
   } as unknown as EnvironmentStore;
   return { controller: new ModelController(store), environment };
}

describe("ModelController.putModelFile", () => {
   afterEach(() => sinon.restore());

   it("creates a new model and reports its hash", async () => {
      const { controller, environment } = harness();
      const result = await controller.putModelFile("env", "pkg", PATH, {
         source: TEXT,
      });
      expect(result.created).toBe(true);
      expect(result.contentHash).toBe(hash(TEXT));
      expect(environment.compileSource.calledOnce).toBe(true);
      expect(environment.compileSource.firstCall.args[5]).toBe("file");
   });

   it("refuses on a frozen config before touching anything", async () => {
      const { controller, environment } = harness({ frozen: true });
      await expect(
         controller.putModelFile("env", "pkg", PATH, { source: TEXT }),
      ).rejects.toBeInstanceOf(FrozenConfigError);
      expect(environment.compileSource.called).toBe(false);
   });

   it("refuses unsafe paths, index.malloy and public/", async () => {
      const { controller } = harness();
      for (const path of [
         "../x.malloy",
         "index.malloy",
         "public/x.malloy",
         "x.txt",
      ]) {
         await expect(
            controller.putModelFile("env", "pkg", path, { source: TEXT }),
         ).rejects.toBeInstanceOf(BadRequestError);
      }
      await expect(
         controller.putModelFile("env", "pkg", "index.malloy", {
            source: TEXT,
         }),
      ).rejects.toBeInstanceOf(InvalidModelPathError);
   });

   it("refuses text without the builder marker, and reports", async () => {
      const { controller } = harness();
      await expect(
         controller.putModelFile("env", "pkg", PATH, {
            source: "source: a is b",
         }),
      ).rejects.toBeInstanceOf(BadRequestError);
      await expect(
         controller.putModelFile("env", "pkg", PATH, {
            source: `${TEXT}## artifact { layout=grid }\n`,
         }),
      ).rejects.toBeInstanceOf(BadRequestError);
   });

   it("refuses text that does not compile and writes nothing", async () => {
      const { controller, environment } = harness({
         problems: [{ severity: "error", message: "nope" }],
      });
      await expect(
         controller.putModelFile("env", "pkg", PATH, { source: TEXT }),
      ).rejects.toBeInstanceOf(CompileRefusedError);
      expect(environment.writeModelFileTransactional.called).toBe(false);
   });

   it("409s a create over an existing file", async () => {
      const { controller } = harness({ current: TEXT });
      await expect(
         controller.putModelFile("env", "pkg", PATH, { source: TEXT }),
      ).rejects.toBeInstanceOf(WriteConflictError);
   });

   it("replaces a builder file when the hash matches", async () => {
      const { controller } = harness({ current: TEXT });
      const next = `${TEXT}\n// edited\n`;
      const result = await controller.putModelFile("env", "pkg", PATH, {
         source: next,
         expectedHash: hash(TEXT),
      });
      expect(result.created).toBe(false);
      expect(result.contentHash).toBe(hash(next));
   });

   it("409s a stale hash and 400s a hand-written model", async () => {
      await expect(
         harness({ current: TEXT }).controller.putModelFile(
            "env",
            "pkg",
            PATH,
            {
               source: TEXT,
               expectedHash: "stale",
            },
         ),
      ).rejects.toBeInstanceOf(WriteConflictError);
      const handWritten = "source: a is duckdb.table('a')\n";
      await expect(
         harness({ current: handWritten }).controller.putModelFile(
            "env",
            "pkg",
            PATH,
            {
               source: TEXT,
               expectedHash: hash(handWritten),
            },
         ),
      ).rejects.toBeInstanceOf(BadRequestError);
      await expect(
         harness().controller.putModelFile("env", "pkg", PATH, {
            source: TEXT,
            expectedHash: hash(TEXT),
         }),
      ).rejects.toBeInstanceOf(WriteConflictError);
   });

   it("surfaces a rollback when the reloaded package cannot compile the file", async () => {
      const { controller } = harness({ reloadCompiles: false });
      await expect(
         controller.putModelFile("env", "pkg", PATH, { source: TEXT }),
      ).rejects.toBeInstanceOf(WriteRolledBackError);
   });
});
