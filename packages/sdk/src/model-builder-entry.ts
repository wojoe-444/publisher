// Copyright (c) Credible Data Inc.
// SPDX-License-Identifier: MIT

// The model builder's entry point, separate from the SDK's main entry on
// purpose: it carries the node-graph canvas, which most Console users never
// open. A host loads it on demand (`import("@malloy-publisher/sdk/model-builder")`)
// and nothing reachable from the main entry imports it.
export * from "./components/ModelBuilder";
