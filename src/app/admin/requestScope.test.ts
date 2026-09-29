import { describe, expect, it } from "vitest";
import { departmentWhere, returnedToOfficeClause } from "./requestScope";

/** Today's live graph: the office sends to department 201090. */
const GRAPH = [{ current: "office", next: "201090" }];

describe("returned-to-office clause (rejected / replied-with-notes)", () => {
  it("gives the department the office sends to its rejected and noted requests", () => {
    expect(returnedToOfficeClause(GRAPH, "201090")).toBe(
      "(STATUS IN (7,4) AND WORKFLOW_STEPS = 'office')",
    );
  });

  it("gives any other department nothing", () => {
    expect(returnedToOfficeClause(GRAPH, "999999")).toBeNull();
  });

  it("gives only the FIRST reviewer on a longer graph, never a later one", () => {
    const longer = [
      { current: "office", next: "100" },
      { current: "100", next: "200" },
    ];
    expect(returnedToOfficeClause(longer, "100")).not.toBeNull();
    expect(returnedToOfficeClause(longer, "200")).toBeNull();
  });

  it("gives nothing when the graph is empty", () => {
    expect(returnedToOfficeClause([], "201090")).toBeNull();
  });

  it("escapes a quote in the origin step name", () => {
    const quoted = [{ current: "o'ffice", next: "201090" }];
    expect(returnedToOfficeClause(quoted, "201090")).toContain("WORKFLOW_STEPS = 'o''ffice'");
  });
});

describe("department where-clause", () => {
  it("is just the queue when there is nothing else", () => {
    expect(departmentWhere("201090")).toBe("(WORKFLOW_STEPS = '201090')");
  });

  it("ORs the queue, the returned requests and the remembered ids together", () => {
    const where = departmentWhere("201090", {
      returnedClause: returnedToOfficeClause(GRAPH, "201090"),
      handledIds: [12, 7],
    });
    expect(where).toBe(
      "(WORKFLOW_STEPS = '201090') OR " +
        "(STATUS IN (7,4) AND WORKFLOW_STEPS = 'office') OR " +
        "(OBJECTID IN (12,7))",
    );
  });

  it("rejects a department id that is not digits", () => {
    expect(() => departmentWhere("1 OR 1=1")).toThrow();
  });
});
