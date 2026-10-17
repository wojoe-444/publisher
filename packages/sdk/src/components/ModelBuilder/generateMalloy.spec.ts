// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import {
   generateMalloy,
   ident,
   MODEL_BUILDER_MARKER,
   validateModel,
} from "./generateMalloy";
import { flightsModel } from "./modelFixture";

describe("ident", () => {
   it("leaves plain names alone and quotes the rest", () => {
      expect(ident("flight_count")).toBe("flight_count");
      expect(ident("my field")).toBe("`my field`");
      expect(ident("count")).toBe("`count`");
      expect(ident("1abc")).toBe("`1abc`");
   });
});

describe("generateMalloy", () => {
   const code = generateMalloy(flightsModel);

   it("starts with the marker the server requires to replace the file", () => {
      expect(code.startsWith(MODEL_BUILDER_MARKER)).toBe(true);
   });

   it("defines joined sources before the sources that join them", () => {
      expect(code.indexOf("source: carriers")).toBeLessThan(
         code.indexOf("source: flights"),
      );
      expect(code.indexOf("source: airports")).toBeLessThan(
         code.indexOf("source: flights"),
      );
   });

   it("emits joins, fields and views", () => {
      expect(code).toContain(
         "source: flights is duckdb.table('data/flights.parquet') extend {",
      );
      expect(code).toContain("join_one: carriers with carrier");
      expect(code).toContain(
         "join_one: origin_airport is airports with origin",
      );
      expect(code).toContain(
         "join_one: destination_airport is airports on destination_airport.code = destination",
      );
      expect(code).toContain("dimension:\n    carrier_year is dep_time.year");
      expect(code).toContain("measure:\n    flight_count is count()");
      expect(code).toContain("view: by_carrier is {");
      expect(code).toContain("limit: 10");
   });

   it("has no diagnostics for the sample", () => {
      expect(validateModel(flightsModel)).toEqual([]);
   });
});

describe("validateModel", () => {
   it("flags join cycles and missing primary keys", () => {
      const [a, b] = flightsModel.tables;
      const model = {
         tables: [
            { ...a, primaryKey: "" },
            { ...b, primaryKey: "" },
         ],
         joins: [
            {
               id: "x",
               from: a.id,
               to: b.id,
               kind: "one" as const,
               mode: "with" as const,
               withKey: "k",
               onCondition: "",
               alias: "",
            },
            {
               id: "y",
               from: b.id,
               to: a.id,
               kind: "many" as const,
               mode: "on" as const,
               withKey: "",
               onCondition: "",
               alias: "",
            },
         ],
      };
      const messages = validateModel(model)
         .map((d) => d.message)
         .join("\n");
      expect(messages).toContain("join cycle");
      expect(messages).toContain("has no primary key");
      expect(messages).toContain('needs an "on" condition');
   });
});
