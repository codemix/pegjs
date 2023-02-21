"use strict";

const chai = require("chai");
const peg = require("../../lib/peg");
const pkg = require("../../package.json");
const { SourceMapConsumer } = require("source-map");
const { spy } = require("../utils.js");

exports.peggyVersion = function peggyVersion() {
  return peg.VERSION;
};

chai.use(require("chai-like"));

beforeEach(() => {
  // In the browser, initialize SourceMapConsumer's wasm bits.
  // This is *async*, so make sure to return the promise to make
  // Mocha (which is what we use in the browser) pause until we're ready.
  if (typeof window !== "undefined") {
    return SourceMapConsumer.initialize({
      "lib/mappings.wasm": "https://raw.githubusercontent.com/mozilla/source-map/0.7.3/lib/mappings.wasm",
    });
  }
  return null;
});

const expect = chai.expect;

describe("Peggy API", () => {
  it("has the correct VERSION", () => {
    expect(peg.VERSION).to.equal(pkg.version);
  });

  describe("generate", () => {
    it("generates a parser", () => {
      const parser = peg.generate("start = 'a'");

      expect(parser).to.be.an("object");
      expect(parser.parse("a")).to.equal("a");
    });

    it("throws an exception on syntax error", () => {
      expect(() => { peg.generate("start = @"); }).to.throw();
    });

    it("throws an exception on semantic error", () => {
      expect(() => { peg.generate("start = undefined"); }).to.throw();
    });

    describe("allowed start rules", () => {
      const grammar = [
        "a = 'x'",
        "b = 'x'",
        "c = 'x'",
      ].join("\n");

      describe("when |allowedStartRules| is not set", () => {
        it("generated parser can start only from the first rule", () => {
          const parser = peg.generate(grammar);

          expect(parser.parse("x", { startRule: "a" })).to.equal("x");
          expect(() => { parser.parse("x", { startRule: "b" }); }).to.throw();
          expect(() => { parser.parse("x", { startRule: "c" }); }).to.throw();
        });
      });

      describe("when |allowedStartRules| is set", () => {
        it("generated parser can start only from specified rules", () => {
          const parser = peg.generate(grammar, {
            allowedStartRules: ["b", "c"],
          });

          expect(() => { parser.parse("x", { startRule: "a" }); }).to.throw();
          expect(parser.parse("x", { startRule: "b" })).to.equal("x");
          expect(parser.parse("x", { startRule: "c" })).to.equal("x");
        });
      });
    });

    describe("intermediate results caching", () => {
      const grammar = [
        "{ var n = 0; }",
        "start = (a 'b') / (a 'c') { return n; }",
        "a = 'a' { n++; }",
      ].join("\n");

      describe("when |cache| is not set", () => {
        it("generated parser doesn't cache intermediate parse results", () => {
          const parser = peg.generate(grammar);

          expect(parser.parse("ac")).to.equal(2);
        });
      });

      describe("when |cache| is set to |false|", () => {
        it("generated parser doesn't cache intermediate parse results", () => {
          const parser = peg.generate(grammar, { cache: false });

          expect(parser.parse("ac")).to.equal(2);
        });
      });

      describe("when |cache| is set to |true|", () => {
        it("generated parser caches intermediate parse results", () => {
          const parser = peg.generate(grammar, { cache: true });

          expect(parser.parse("ac")).to.equal(1);
        });
      });
    });

    describe("tracing", () => {
      const grammar = "start = 'a'";

      describe("when |trace| is not set", () => {
        it("generated parser doesn't trace", () => {
          const parser = peg.generate(grammar);
          const tracer = { trace: spy() };

          parser.parse("a", { tracer });

          expect(tracer.trace.called).to.equal(false);
        });
      });

      describe("when |trace| is set to |false|", () => {
        it("generated parser doesn't trace", () => {
          const parser = peg.generate(grammar, { trace: false });
          const tracer = { trace: spy() };

          parser.parse("a", { tracer });

          expect(tracer.trace.called).to.equal(false);
        });
      });

      describe("when |trace| is set to |true|", () => {
        it("generated parser traces", () => {
          const parser = peg.generate(grammar, { trace: true });
          const tracer = { trace: spy() };

          parser.parse("a", { tracer });

          expect(tracer.trace.called).to.equal(true);
        });
      });
    });

    describe("output", () => {
      const grammar = "start = 'a'";

      describe("when |output| is not set", () => {
        it("returns generated parser object", () => {
          const parser = peg.generate(grammar);

          expect(parser).to.be.an("object");
          expect(parser.parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"parser\"|", () => {
        it("returns generated parser object", () => {
          const parser = peg.generate(grammar, { output: "parser" });

          expect(parser).to.be.an("object");
          expect(parser.parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"source\"|", () => {
        it("returns generated parser source code", () => {
          const source = peg.generate(grammar, { output: "source" });

          expect(source).to.be.a("string");
          expect(eval(source).parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"ast\"|", () => {
        it("returns generated parser AST", () => {
          const ast = peg.generate(grammar, { output: "ast" });

          expect(ast).to.be.an("object");
          expect(ast).to.be.like(peg.parser.parse(grammar));
        });
      });
    });

    // The |format|, |exportVars|, and |dependencies| options are not tested
    // because there is no meaningful way to test their effects without turning
    // this into an integration test.

    // The |plugins| option is tested in plugin API tests.

    describe("reserved words", () => {
      describe("throws an exception on reserved JS words used as a label", () => {
        for (const label of peg.RESERVED_WORDS) {
          it(label, () => {
            expect(() => {
              peg.generate([
                "start = " + label + ":end",
                "end = 'a'",
              ].join("\n"), { output: "source" });
            }).to.throw(peg.parser.SyntaxError);
          });
        }
      });

      describe("does not throws an exception on reserved JS words used as a rule name", () => {
        for (const rule of peg.RESERVED_WORDS) {
          it(rule, () => {
            expect(() => {
              peg.generate([
                "start = " + rule,
                rule + " = 'a'",
              ].join("\n"), { output: "source" });
            }).to.not.throw(peg.parser.SyntaxError);
          });
        }
      });
    });

    it("accepts custom options", () => {
      peg.generate("start = 'a'", { grammarSource: 42 });
    });

    describe("generates source map", () => {
      function findLocationOf(input, chunk, source) {
        const offset = chunk instanceof RegExp
          ? input.search(chunk)
          : input.indexOf(chunk);
        let line = 1;
        let column = 0;

        for (let i = 0; i < offset; ++i) {
          if (input.charCodeAt(i) === 10) {
            ++line;
            column = 0;
          } else {
            ++column;
          }
        }

        if (source && source.offset) {
          const o = source.offset({ line, column, offset });
          delete o.offset;
          return o;
        }
        return { line, column };
      }

      const GLOBAL_INITIALIZER = "GLOBAL\nINITIALIZER";
      const PER_PARSE_INITIALIZER = "PER-PARSE\nINITIALIZER";
      const NOT_BLOCK = "NOT\nBLOCK";
      const AND_BLOCK = "AND\nBLOCK";
      const ACTION_BLOCK = "ACTION\nBLOCK";
      const MIN_BLOCK = "MIN\nBLOCK";
      const MAX_BLOCK = "MAX\nBLOCK";
      const EXACT_BLOCK = "EXACT\nBLOCK";
      const SOURCE = `
        {{${GLOBAL_INITIALIZER}}}
        {${PER_PARSE_INITIALIZER}}
        RULE_1 = !{${NOT_BLOCK}} 'a' rule:RULE_2 {${ACTION_BLOCK}};
        RULE_2 'named' = &{${AND_BLOCK}} @'b' [abc] 'def';
        RULE_3 = RULE_1 / RULE_2;
        RULE_4 = RULE_1|{${MIN_BLOCK}} .. {${MAX_BLOCK}}, RULE_2|{${EXACT_BLOCK}}| |;
      `;

      function check(chunk, source, name, generatedChunk = chunk) {
        const node = peg.generate(SOURCE, {
          grammarSource: source,
          output: "source-and-map",
        });
        const { code, map } = node.toStringWithSourceMap();

        const original  = findLocationOf(SOURCE, chunk, source);
        const generated = findLocationOf(code, generatedChunk);

        delete original.offset;
        delete generated.offset;

        return SourceMapConsumer.fromSourceMap(map).then(consumer => {
          expect(consumer.originalPositionFor(generated))
            .to.be.deep.equal(Object.assign(original, {
              source: String(source),
              name,
            }));
        });
      }

      const gl = new peg.GrammarLocation("-", {
        offset: 51,
        line: 13,
        column: 7,
      });

      for (const source of [
        // Because of https://github.com/mozilla/source-map/issues/444 this variants not working
        // undefined,
        // null,
        // "",
        "-",
        gl,
      ]) {
        describe(`with source = ${chai.util.inspect(source)}`, () => {
          it("global initializer", () => check(GLOBAL_INITIALIZER, source, "$top_level_initializer"));
          it("per-parse initializer", () => check(PER_PARSE_INITIALIZER, source, "$initializer"));
          it("action block", () => check(ACTION_BLOCK, source, null));
          it("semantic and predicate", () => check(AND_BLOCK, source, null));
          it("semantic not predicate", () => check(NOT_BLOCK, source, null));
          it("min function boundary", () => check(MIN_BLOCK, source, null));
          it("max function boundary", () => check(MAX_BLOCK, source, null));
          it("exact function boundary", () => check(EXACT_BLOCK, source, null));

          it("rule name", () => check("RULE_1", source, "RULE_1", "peg$parseRULE_1() {"));
          it("labelled rule name", () => check("RULE_2 'named'", source, "RULE_2", "peg$parseRULE_2() {"));
          it("literal expression", () => check("'a'", source, null, "input.charCodeAt(peg$currPos) === 97"));
          it("multichar literal", () => check("'def'", source, null, "input.substr(peg$currPos, 3) === peg$c3"));
          it("chars expression", () => check("[abc]", source, null, "peg$r0.test(input.charAt(peg$currPos))"));
          it("rule expression", () => check("RULE_2", source, null, "peg$parseRULE_2();"));
          it("choice expression", () => check(
            "RULE_1 / RULE_2",
            source,
            null,
            new RegExp([
              // Lint complained about a long regex, so split and join.
              /peg\$parseRULE_1\(\);\s*/,
              /if \(s. === peg\$FAILED\) \{\s*/,
              /s. = peg\$parseRULE_2/,
            ].map(r => r.source).join(""))
          ));
        });
      }
    });
  });
});
