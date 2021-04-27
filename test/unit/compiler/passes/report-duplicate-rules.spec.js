"use strict";

const chai = require("chai");
const helpers = require("./helpers");
const pass = require("../../../../lib/compiler/passes/report-duplicate-rules");

chai.use(helpers);

const expect = chai.expect;

describe("compiler pass |reportDuplicateRules|", function() {
  it("reports duplicate rules", function() {
    expect(pass).to.reportError([
      "start = 'a'",
      "start = 'b'"
    ].join("\n"), {
      message: "Rule \"start\" is already defined at line 1, column 1.",
      location: {
        source: undefined,
        start: { offset: 12, line: 2, column: 1 },
        end: { offset: 23, line: 2, column: 12 }
      }
    });
  });
});
