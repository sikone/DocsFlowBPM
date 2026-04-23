type TokenType =
  | 'NUMBER' | 'STRING' | 'BOOL' | 'FIELD_REF' | 'IDENT'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH'
  | 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE'
  | 'AND' | 'OR' | 'NOT'
  | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

interface Token {
  type: TokenType;
  value: string | number | boolean | null;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }

    if (/[0-9]/.test(input[i])) {
      let num = '';
      while (i < input.length && /[0-9.]/.test(input[i])) num += input[i++];
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
      continue;
    }

    if (input[i] === "'") {
      i++;
      let str = '';
      while (i < input.length && input[i] !== "'") str += input[i++];
      i++;
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    if (input[i] === '{') {
      i++;
      let ref = '';
      while (i < input.length && input[i] !== '}') ref += input[i++];
      i++;
      tokens.push({ type: 'FIELD_REF', value: ref });
      continue;
    }

    if (/[a-zA-Z_]/.test(input[i])) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) ident += input[i++];
      if (ident === 'true') tokens.push({ type: 'BOOL', value: true });
      else if (ident === 'false') tokens.push({ type: 'BOOL', value: false });
      else if (ident === 'AND') tokens.push({ type: 'AND', value: 'AND' });
      else if (ident === 'OR') tokens.push({ type: 'OR', value: 'OR' });
      else if (ident === 'NOT') tokens.push({ type: 'NOT', value: 'NOT' });
      else tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    if (i + 1 < input.length) {
      const two = input.slice(i, i + 2);
      if (two === '==') { tokens.push({ type: 'EQ', value: '==' }); i += 2; continue; }
      if (two === '!=') { tokens.push({ type: 'NEQ', value: '!=' }); i += 2; continue; }
      if (two === '>=') { tokens.push({ type: 'GTE', value: '>=' }); i += 2; continue; }
      if (two === '<=') { tokens.push({ type: 'LTE', value: '<=' }); i += 2; continue; }
      if (two === '&&') { tokens.push({ type: 'AND', value: '&&' }); i += 2; continue; }
      if (two === '||') { tokens.push({ type: 'OR', value: '||' }); i += 2; continue; }
    }

    switch (input[i]) {
      case '+': tokens.push({ type: 'PLUS', value: '+' }); break;
      case '-': tokens.push({ type: 'MINUS', value: '-' }); break;
      case '*': tokens.push({ type: 'STAR', value: '*' }); break;
      case '/': tokens.push({ type: 'SLASH', value: '/' }); break;
      case '>': tokens.push({ type: 'GT', value: '>' }); break;
      case '<': tokens.push({ type: 'LT', value: '<' }); break;
      case '!': tokens.push({ type: 'NOT', value: '!' }); break;
      case '(': tokens.push({ type: 'LPAREN', value: '(' }); break;
      case ')': tokens.push({ type: 'RPAREN', value: ')' }); break;
      case ',': tokens.push({ type: 'COMMA', value: ',' }); break;
    }
    i++;
  }

  tokens.push({ type: 'EOF', value: null });
  return tokens;
}

type ASTNode =
  | { kind: 'Literal'; value: number | string | boolean }
  | { kind: 'FieldRef'; fieldId: string }
  | { kind: 'BinOp'; op: string; left: ASTNode; right: ASTNode }
  | { kind: 'UnaryOp'; op: string; operand: ASTNode }
  | { kind: 'Call'; name: string; args: ASTNode[] };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }
  private expect(type: TokenType): Token {
    const tok = this.consume();
    if (tok.type !== type) throw new Error(`Expected ${type}, got ${tok.type}`);
    return tok;
  }

  parse(): ASTNode {
    const node = this.parseOr();
    this.expect('EOF');
    return node;
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.peek().type === 'OR') {
      this.consume();
      left = { kind: 'BinOp', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseNot();
    while (this.peek().type === 'AND') {
      this.consume();
      left = { kind: 'BinOp', op: '&&', left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): ASTNode {
    if (this.peek().type === 'NOT') {
      this.consume();
      return { kind: 'UnaryOp', op: '!', operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdd();
    const ops: TokenType[] = ['EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE'];
    while (ops.includes(this.peek().type)) {
      const op = this.consume().value as string;
      left = { kind: 'BinOp', op, left, right: this.parseAdd() };
    }
    return left;
  }

  private parseAdd(): ASTNode {
    let left = this.parseMul();
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.consume().value as string;
      left = { kind: 'BinOp', op, left, right: this.parseMul() };
    }
    return left;
  }

  private parseMul(): ASTNode {
    let left = this.parseUnary();
    while (this.peek().type === 'STAR' || this.peek().type === 'SLASH') {
      const op = this.consume().value as string;
      left = { kind: 'BinOp', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.peek().type === 'MINUS') {
      this.consume();
      return { kind: 'UnaryOp', op: '-', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek();

    if (tok.type === 'NUMBER') { this.consume(); return { kind: 'Literal', value: tok.value as number }; }
    if (tok.type === 'STRING') { this.consume(); return { kind: 'Literal', value: tok.value as string }; }
    if (tok.type === 'BOOL') { this.consume(); return { kind: 'Literal', value: tok.value as boolean }; }
    if (tok.type === 'FIELD_REF') { this.consume(); return { kind: 'FieldRef', fieldId: tok.value as string }; }

    if (tok.type === 'IDENT') {
      const name = tok.value as string;
      this.consume();
      if (this.peek().type === 'LPAREN') {
        this.consume();
        const args: ASTNode[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseOr());
          while (this.peek().type === 'COMMA') { this.consume(); args.push(this.parseOr()); }
        }
        this.expect('RPAREN');
        return { kind: 'Call', name, args };
      }
      return { kind: 'FieldRef', fieldId: name };
    }

    if (tok.type === 'LPAREN') {
      this.consume();
      const inner = this.parseOr();
      this.expect('RPAREN');
      return inner;
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }
}

function evalNode(node: ASTNode, values: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'Literal': return node.value;

    case 'FieldRef': {
      const val = values[node.fieldId];
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'boolean') return val;
      const n = Number(val);
      return isNaN(n) ? val : n;
    }

    case 'BinOp': {
      const l = evalNode(node.left, values);
      const r = evalNode(node.right, values);
      switch (node.op) {
        case '+': return (l as number) + (r as number);
        case '-': return (l as number) - (r as number);
        case '*': return (l as number) * (r as number);
        case '/': return (r as number) !== 0 ? (l as number) / (r as number) : 0;
        case '==': return String(l) === String(r) || l === r;
        case '!=': return String(l) !== String(r) && l !== r;
        case '>': return (l as number) > (r as number);
        case '<': return (l as number) < (r as number);
        case '>=': return (l as number) >= (r as number);
        case '<=': return (l as number) <= (r as number);
        case '&&': return Boolean(l) && Boolean(r);
        case '||': return Boolean(l) || Boolean(r);
        default: return 0;
      }
    }

    case 'UnaryOp': {
      const val = evalNode(node.operand, values);
      if (node.op === '-') return -(val as number);
      if (node.op === '!') return !Boolean(val);
      return val;
    }

    case 'Call': {
      const fn = node.name.toUpperCase();
      switch (fn) {
        case 'IF': {
          const cond = evalNode(node.args[0], values);
          return Boolean(cond)
            ? evalNode(node.args[1], values)
            : (node.args[2] ? evalNode(node.args[2], values) : null);
        }
        case 'ROUND': {
          const v = evalNode(node.args[0], values) as number;
          const d = node.args[1] ? (evalNode(node.args[1], values) as number) : 2;
          const factor = Math.pow(10, d);
          return Math.round(v * factor) / factor;
        }
        case 'ABS': return Math.abs(evalNode(node.args[0], values) as number);
        case 'MIN': return Math.min(...node.args.map((a) => evalNode(a, values) as number));
        case 'MAX': return Math.max(...node.args.map((a) => evalNode(a, values) as number));
        case 'AND': return node.args.every((a) => Boolean(evalNode(a, values)));
        case 'OR': return node.args.some((a) => Boolean(evalNode(a, values)));
        case 'NOT': return !Boolean(evalNode(node.args[0], values));
        default: throw new Error(`Unknown function: ${fn}`);
      }
    }
  }
}

export interface FormulaResult {
  value: unknown;
  error: string | null;
}

export function evaluateFormula(
  formula: string,
  fieldValues: Record<string, unknown>,
): FormulaResult {
  try {
    const tokens = tokenize(formula);
    const ast = new Parser(tokens).parse();
    const value = evalNode(ast, fieldValues);
    return { value, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[formula]', msg, '\nформула:', formula, '\nполя:', fieldValues);
    return { value: null, error: msg };
  }
}

export function formatFormulaResult(value: unknown, prefix?: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return '';
    const formatted = Number.isInteger(value)
      ? value.toLocaleString('ru-RU')
      : value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return prefix ? `${prefix} ${formatted}` : formatted;
  }
  return String(value);
}
