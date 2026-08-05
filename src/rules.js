/*
 * Rule engine: parses a small DSL into a rule spec, and resolves the next
 * build target from current building levels — no eval(), hand-written
 * tokenizer/parser/evaluator only.
 *
 * DSL text (one rule block):
 *
 *   repeat:
 *     Metal = Crystal + 2
 *     Solar >= ceil((Metal + Crystal)/2)
 *   until:
 *     Metal = 22
 *   then:
 *     Robotics = 4
 *     Shipyard = 2
 *
 * Leading "- " bullets (as in idea.md) are accepted and stripped.
 *
 * Resolution semantics:
 *   - While `until` is not yet satisfied: walk `repeat` constraints in order,
 *     return the first one whose target building hasn't reached the level the
 *     constraint implies (computed fresh from current levels every call, so
 *     building things out of order just changes what's "next", nothing goes
 *     stale).
 *   - Once `until` is satisfied: walk `then` (an ordered map) and return the
 *     first entry whose target level hasn't been reached.
 *   - Returns null when everything is satisfied (queue complete) or when a
 *     repeat cycle is stuck (all repeat constraints satisfied but `until`
 *     still not met - nothing left for the rules to ask for).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      typeof require !== 'undefined' ? require('./buildings') : root.OQueue.Buildings
    );
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Rules = factory(root.OQueue.Buildings);
  }
})(typeof self !== 'undefined' ? self : this, function (Buildings) {
  'use strict';

  // ---- Tokenizer ----------------------------------------------------------

  const TOKEN_RE = /\s*(>=|<=|=|>|<|\+|-|\*|\/|\(|\)|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)/g;

  function tokenize(line) {
    const tokens = [];
    let match;
    let lastIndex = 0;
    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(line))) {
      if (match.index !== lastIndex) {
        const skipped = line.slice(lastIndex, match.index);
        if (skipped.trim()) throw new Error(`Unexpected character near "${skipped}" in: ${line}`);
      }
      tokens.push(match[1]);
      lastIndex = TOKEN_RE.lastIndex;
    }
    if (lastIndex !== line.length && line.slice(lastIndex).trim()) {
      throw new Error(`Unexpected trailing content in: ${line}`);
    }
    return tokens;
  }

  // ---- Expression parser/evaluator ----------------------------------------

  const FUNCS = {
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
  };

  function makeExprParser(tokens) {
    let pos = 0;

    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }

    function parseExpression() {
      let node = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = next();
        const right = parseTerm();
        node = { type: 'binop', op, left: node, right };
      }
      return node;
    }

    function parseTerm() {
      let node = parseFactor();
      while (peek() === '*' || peek() === '/') {
        const op = next();
        const right = parseFactor();
        node = { type: 'binop', op, left: node, right };
      }
      return node;
    }

    function parseFactor() {
      const tok = peek();
      if (tok === undefined) throw new Error('Unexpected end of expression');
      if (tok === '(') {
        next();
        const node = parseExpression();
        if (next() !== ')') throw new Error('Expected closing )');
        return node;
      }
      if (/^\d/.test(tok)) {
        next();
        return { type: 'num', value: parseFloat(tok) };
      }
      if (/^[A-Za-z_]/.test(tok)) {
        next();
        if (peek() === '(') {
          if (!FUNCS[tok]) throw new Error(`Unknown function: ${tok}`);
          next(); // (
          const arg = parseExpression();
          if (next() !== ')') throw new Error('Expected closing ) after function arg');
          return { type: 'call', fn: tok, arg };
        }
        return { type: 'var', name: tok };
      }
      throw new Error(`Unexpected token: ${tok}`);
    }

    return { parseExpression, rest: () => tokens.slice(pos) };
  }

  function evalNode(node, levels) {
    switch (node.type) {
      case 'num': return node.value;
      case 'var': {
        const code = Buildings.codeForAlias(node.name);
        if (!code) throw new Error(`Unknown variable: ${node.name}`);
        return levels[code] || 0;
      }
      case 'call':
        return FUNCS[node.fn](evalNode(node.arg, levels));
      case 'binop': {
        const l = evalNode(node.left, levels);
        const r = evalNode(node.right, levels);
        switch (node.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
          default: throw new Error(`Unknown operator: ${node.op}`);
        }
      }
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  // ---- Statement parser: "Identifier CompareOp Expression" ----------------

  const COMPARE_OPS = ['>=', '<=', '=', '>', '<'];

  function parseStatement(line) {
    const tokens = tokenize(line);
    if (tokens.length < 3) throw new Error(`Malformed rule statement: ${line}`);
    const varName = tokens[0];
    const op = tokens[1];
    if (!COMPARE_OPS.includes(op)) {
      throw new Error(`Expected comparison operator after "${varName}" in: ${line}`);
    }
    const code = Buildings.codeForAlias(varName);
    if (!code) throw new Error(`Unknown building variable: ${varName}`);
    const parser = makeExprParser(tokens.slice(2));
    const expr = parser.parseExpression();
    if (parser.rest().length) throw new Error(`Unexpected trailing tokens in: ${line}`);
    return { code, name: varName, op, expr, raw: line.trim() };
  }

  function satisfies(currentLevel, op, targetValue) {
    switch (op) {
      case '=': return currentLevel >= targetValue;
      case '>=': return currentLevel >= targetValue;
      case '<=': return currentLevel <= targetValue;
      case '>': return currentLevel > targetValue;
      case '<': return currentLevel < targetValue;
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  function targetLevelFor(op, exprValue) {
    // Buildings only ever go up, so for "less than" style operators there's
    // nothing constructive to build toward - treat as already satisfied by caller.
    return Math.ceil(exprValue);
  }

  // ---- DSL text -> rule spec ------------------------------------------------

  function stripBullet(line) {
    return line.replace(/^\s*-\s*/, '').trim();
  }

  function parseRuleText(text) {
    const lines = text.split('\n');
    const sections = { repeat: [], until: [], then: [] };
    let current = null;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const headerMatch = /^(repeat|until|then)\s*:\s*$/i.exec(line);
      if (headerMatch) {
        current = headerMatch[1].toLowerCase();
        continue;
      }
      // allow "until: Metal = 22" on one line
      const inlineMatch = /^(repeat|until|then)\s*:\s*(.+)$/i.exec(line);
      if (inlineMatch) {
        current = inlineMatch[1].toLowerCase();
        sections[current].push(stripBullet(inlineMatch[2]));
        continue;
      }
      if (!current) throw new Error(`Rule line outside of a section: ${line}`);
      sections[current].push(stripBullet(line));
    }

    const repeat = sections.repeat.map(parseStatement);
    const until = sections.until.length ? parseStatement(sections.until[0]) : null;
    const then = sections.then.map(parseStatement);

    return { repeat, until, then };
  }

  // ---- Resolver -------------------------------------------------------------

  function resolveStatement(stmt, levels) {
    const targetValue = evalNode(stmt.expr, levels);
    const currentLevel = levels[stmt.code] || 0;
    const target = targetLevelFor(stmt.op, targetValue);
    const done = satisfies(currentLevel, stmt.op, targetValue);
    return { done, target, code: stmt.code };
  }

  function resolveRule(ruleSpec, currentLevels) {
    const untilDone = ruleSpec.until ? resolveStatement(ruleSpec.until, currentLevels).done : false;

    if (!untilDone) {
      for (const stmt of ruleSpec.repeat) {
        const r = resolveStatement(stmt, currentLevels);
        if (!r.done) {
          const b = Buildings.byCode(r.code);
          return { code: b.code, id: b.id, name: b.name, level: r.target };
        }
      }
      return null; // stuck: repeat cycle satisfied but `until` not yet met
    }

    for (const stmt of ruleSpec.then) {
      const r = resolveStatement(stmt, currentLevels);
      if (!r.done) {
        const b = Buildings.byCode(r.code);
        return { code: b.code, id: b.id, name: b.name, level: r.target };
      }
    }
    return null; // fully complete
  }

  return { parseRuleText, resolveRule, tokenize, parseStatement };
});
