// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

// Compiles generated Malloy with the real Malloy compiler (no database needed: schemas are stubbed).
import { describe, expect, it } from "bun:test";
import { Runtime } from "@malloydata/malloy";
import type { Connection } from "@malloydata/malloy";
import { generateMalloy } from "./generateMalloy";
import { flightsModel } from "./modelFixture";

const COLUMNS: Record<string, Record<string, string>> = {
   "data/flights.parquet": {
      id2: "number",
      carrier: "string",
      origin: "string",
      destination: "string",
      dep_time: "timestamp",
      dep_delay: "number",
   },
   "data/carriers.parquet": {
      code: "string",
      nickname: "string",
      name: "string",
   },
   "data/airports.parquet": {
      code: "string",
      full_name: "string",
      state: "string",
   },
};

function stubConnection(): Connection {
   const conn = {
      name: "duckdb",
      dialectName: "duckdb",
      getDigest: () => "stub",
      fetchSchemaForTables: async (tables: Record<string, string>) => {
         const schemas: Record<string, unknown> = {};
         const errors: Record<string, string> = {};
         for (const [key, path] of Object.entries(tables)) {
            const cols = COLUMNS[path.replace(/^'|'$/g, "")];
            if (!cols) {
               errors[key] = `no stub schema for ${path}`;
               continue;
            }
            schemas[key] = {
               type: "table",
               name: key,
               dialect: "duckdb",
               tablePath: path,
               connection: "duckdb",
               fields: Object.entries(cols).map(([name, type]) =>
                  type === "number"
                     ? { name, type, numberType: "float" }
                     : { name, type },
               ),
            };
         }
         return { schemas, errors };
      },
      fetchSchemaForSQLStruct: async () => ({ error: "unsupported" }),
      runSQL: async () => ({ rows: [], totalRows: 0 }),
      isPool: () => false,
      canPersist: () => false,
      canStream: () => false,
      close: async () => {},
      estimateQueryCost: async () => ({}),
      fetchMetadata: async () => ({}),
      fetchTableMetadata: async () => ({}),
   };
   return conn as unknown as Connection;
}

async function compile(code: string) {
   const connection = stubConnection();
   const runtime = new Runtime({
      urlReader: { readURL: async () => "" },
      connection,
   });
   return runtime.loadModel(code).getModel();
}

describe("generated Malloy compiles", () => {
   it("sample model", async () => {
      const model = await compile(generateMalloy(flightsModel));
      expect(model).toBeTruthy();
   });

   it("join_many, join_cross, backticked names and source filters", async () => {
      const t = (id: string, name: string, path: string, extra = {}) => ({
         id,
         name,
         connection: "duckdb",
         tablePath: path,
         primaryKey: "",
         where: "",
         dimensions: [],
         measures: [],
         views: [],
         position: { x: 0, y: 0 },
         ...extra,
      });
      const carriers = t("c", "carriers", "data/carriers.parquet", {
         primaryKey: "code",
      });
      const airports = t("a", "airports", "data/airports.parquet");
      const flights = t("f", "flights", "data/flights.parquet", {
         where: "dep_delay > 0",
         dimensions: [
            { id: "1", name: "delay bucket", expr: "dep_delay / 15" },
         ],
         measures: [{ id: "2", name: "count", expr: "count()" }],
         views: [
            {
               id: "3",
               name: "by origin",
               groupBy: ["origin"],
               aggregate: ["`count`"],
            },
         ],
      });
      const j = (
         id: string,
         kind: "one" | "many" | "cross",
         mode: "with" | "on",
         extra = {},
      ) => ({
         id,
         from: "f",
         to: "c",
         kind,
         mode,
         withKey: "",
         onCondition: "",
         alias: "",
         ...extra,
      });
      const model = {
         tables: [flights, carriers, airports],
         joins: [
            j("j1", "one", "with", { withKey: "carrier" }),
            j("j2", "many", "on", {
               to: "a",
               alias: "dest",
               onCondition: "dest.code = destination",
            }),
            j("j3", "cross", "on", { to: "a", alias: "every_airport" }),
         ],
      };
      const code = generateMalloy(model);
      expect(code).toContain("`delay bucket`");
      await expect(compile(code)).resolves.toBeTruthy();
   });

   it("rejects a join cycle-free but broken model (sanity check the compiler is really running)", async () => {
      await expect(
         compile(
            "source: x is duckdb.table('data/flights.parquet') extend { dimension: bad is nope + }",
         ),
      ).rejects.toThrow();
   });
});
