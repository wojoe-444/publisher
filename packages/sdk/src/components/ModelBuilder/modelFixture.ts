// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import type { Model } from "./modelTypes";

/** The classic Malloy flights example, for the builder specs. */
export const flightsModel: Model = {
   tables: [
      {
         id: "flights",
         name: "flights",
         connection: "duckdb",
         tablePath: "data/flights.parquet",
         primaryKey: "id2",
         where: "",
         dimensions: [
            { id: "d1", name: "carrier_year", expr: "dep_time.year" },
            { id: "d2", name: "is_delayed", expr: "dep_delay > 15" },
         ],
         measures: [
            { id: "m1", name: "flight_count", expr: "count()" },
            { id: "m2", name: "avg_delay", expr: "avg(dep_delay)" },
         ],
         views: [
            {
               id: "v1",
               name: "by_carrier",
               groupBy: ["carriers.nickname"],
               aggregate: ["flight_count", "avg_delay"],
               limit: 10,
            },
         ],
         position: { x: 20, y: 140 },
      },
      {
         id: "carriers",
         name: "carriers",
         connection: "duckdb",
         tablePath: "data/carriers.parquet",
         primaryKey: "code",
         where: "",
         dimensions: [],
         measures: [{ id: "m3", name: "carrier_count", expr: "count()" }],
         views: [],
         position: { x: 420, y: 20 },
      },
      {
         id: "airports",
         name: "airports",
         connection: "duckdb",
         tablePath: "data/airports.parquet",
         primaryKey: "code",
         where: "",
         dimensions: [
            { id: "d3", name: "full_name_upper", expr: "upper(full_name)" },
         ],
         measures: [{ id: "m4", name: "airport_count", expr: "count()" }],
         views: [],
         position: { x: 420, y: 300 },
      },
   ],
   joins: [
      {
         id: "j1",
         from: "flights",
         to: "carriers",
         kind: "one",
         mode: "with",
         withKey: "carrier",
         onCondition: "",
         alias: "",
      },
      {
         id: "j2",
         from: "flights",
         to: "airports",
         kind: "one",
         mode: "with",
         withKey: "origin",
         onCondition: "",
         alias: "origin_airport",
      },
      {
         id: "j3",
         from: "flights",
         to: "airports",
         kind: "one",
         mode: "on",
         withKey: "",
         onCondition: "destination_airport.code = destination",
         alias: "destination_airport",
      },
   ],
};
