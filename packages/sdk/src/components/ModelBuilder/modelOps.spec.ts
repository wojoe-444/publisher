// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import {
   addField,
   addJoin,
   addTable,
   emptyModel,
   removeTable,
   uniqueSourceName,
   updateField,
   updateTable,
} from "./modelOps";

describe("model operations", () => {
   it("names new tables uniquely and legally", () => {
      const { model } = addTable(emptyModel, { name: "my-table" });
      expect(model.tables[0].name).toBe("my_table");
      expect(uniqueSourceName(model, "my_table")).toBe("my_table_2");
      expect(uniqueSourceName(model, "1st")).toBe("_1st");
   });

   it("joins a table to another, defaulting to its primary key, and refuses a self-join", () => {
      let { model } = addTable(emptyModel, { name: "flights" });
      const flights = model.tables[0].id;
      const added = addTable(model, { name: "carriers" });
      model = updateTable(added.model, added.id, { primaryKey: "code" });
      const join = addJoin(model, flights, added.id);
      expect(join?.model.joins[0]).toMatchObject({
         from: flights,
         to: added.id,
         mode: "with",
         withKey: "code",
      });
      expect(addJoin(model, flights, flights)).toBeUndefined();
      expect(addJoin(model, flights, "missing")).toBeUndefined();
   });

   it("starts an unkeyed join as an `on` join", () => {
      let { model } = addTable(emptyModel, { name: "a" });
      const added = addTable(model, { name: "b" });
      model = added.model;
      expect(
         addJoin(model, model.tables[0].id, added.id)?.model.joins[0].mode,
      ).toBe("on");
   });

   it("removing a table removes its joins", () => {
      let { model } = addTable(emptyModel, { name: "a" });
      const b = addTable(model, { name: "b" });
      model = addJoin(b.model, model.tables[0].id, b.id)!.model;
      expect(removeTable(model, b.id).joins).toEqual([]);
   });

   it("edits fields in place", () => {
      let { model } = addTable(emptyModel, { name: "a" });
      const id = model.tables[0].id;
      model = addField(model, id, "dimensions");
      const field = model.tables[0].dimensions[0];
      model = updateField(model, id, "dimensions", field.id, {
         name: "x",
         expr: "1",
      });
      expect(model.tables[0].dimensions[0]).toMatchObject({
         name: "x",
         expr: "1",
      });
   });
});
