import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { minifyGlslChunk, minifyGlslTemplates } from '../build/glsl';
import { assembleEffect } from '../src/engine/effects/assemble';
import { explodeEffect } from '../src/engine/effects/explode';
import { flipEffect } from '../src/engine/effects/flip';
import { implodeEffect } from '../src/engine/effects/implode';
import { shatterEffect } from '../src/engine/effects/shatter';
import {
  PAGE_FRAGMENT,
  PAGE_VERTEX,
  shardFragmentSource,
  shardVertexSource,
} from '../src/engine/shaders';

/** GLSL tokens, comments and blanks ignored; `#` lines kept whole (they are line-sensitive). */
function tokens(source: string): string[] {
  const out: string[] = [];
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
  for (const line of stripped.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      out.push(trimmed.replace(/\s+/g, ' '));
      continue;
    }
    const re = /[A-Za-z_]\w*|\d[\w.]*|\.\d\w*|\+\+|--|&&|\|\||[-+*/%=<>!^&|]=?|\S/g;
    for (const match of trimmed.matchAll(re)) out.push(match[0]);
  }
  return out;
}

function allShaders(): string[] {
  const sources = [PAGE_VERTEX, PAGE_FRAGMENT];
  for (const effect of [shatterEffect, explodeEffect, implodeEffect, flipEffect, assembleEffect]) {
    sources.push(shardVertexSource(effect.vertexChunk));
    sources.push(shardFragmentSource(effect.fragmentChunk));
  }
  return sources;
}

describe('build-time GLSL minifier (ADR-039)', () => {
  it('keeps every token of every built-in shader and makes each one smaller', () => {
    let before = 0;
    let after = 0;
    for (const source of allShaders()) {
      const minified = minifyGlslChunk(source);
      expect(tokens(minified)).toEqual(tokens(source));
      expect(minified.length).toBeLessThan(source.length);
      before += source.length;
      after += minified.length;
      expect(minified.startsWith('#version 300 es\n')).toBe(true);
      expect(minified).not.toMatch(/\/\/|\/\*/);
    }
    expect(after).toBeLessThan(before * 0.75);
  });

  it('never joins tokens across + and -, nor changes preprocessor lines', () => {
    expect(minifyGlslChunk('a = b - -c;\nd = e + +f;')).toBe('a=b - -c;\nd=e + +f;');
    expect(minifyGlslChunk('\n  #define F (x)  \n  #ifdef  A\n')).toBe(
      '\n#define F (x)\n#ifdef A\n',
    );
    expect(minifyGlslChunk('x =  1.0 ;   // note\n\n\n  y  *= 2.0;')).toBe('x=1.0;\ny*=2.0;');
  });

  it('does not trim at an interpolation boundary', () => {
    const source = 'const s = /* glsl */ `\n  float ${name} = ${value} ;\n`;';
    expect(minifyGlslTemplates(source)).toBe('const s = /* glsl */ `\nfloat ${name}=${value};\n`;');
  });

  it('leaves interpolations (with nested templates, strings and braces) untouched', () => {
    const inner = "${chunk ? `${chunk}\\n#define HOOK 1` : '}'}";
    const source = `x(/* glsl */ \`\n  // c\n  void f() {}\n${inner}\n  int a;\n\`);\nnext();`;
    const out = minifyGlslTemplates(source);
    expect(out).toContain(inner);
    expect(out.startsWith('x(/* glsl */ `\nvoid f(){}\n')).toBe(true);
    expect(out.endsWith('\nint a;\n`\n);\nnext();')).toBe(true);
  });

  it('keeps the line count of every source file (source maps stay right)', () => {
    const dirs = ['src/core', 'src/engine', 'src/engine/effects'];
    let rewritten = 0;
    for (const dir of dirs) {
      for (const name of readdirSync(dir).filter((file) => file.endsWith('.ts'))) {
        const source = readFileSync(join(dir, name), 'utf8');
        if (!source.includes('/* glsl */')) continue;
        const out = minifyGlslTemplates(source);
        expect(out.split('\n').length, name).toBe(source.split('\n').length);
        expect(out.length, name).toBeLessThan(source.length);
        rewritten++;
      }
    }
    expect(rewritten).toBe(8);
  });

  it('refuses inputs it cannot rewrite safely', () => {
    expect(() => minifyGlslChunk('a; // x')).toThrow(/line comment/);
    expect(() => minifyGlslChunk('a; /* x')).toThrow(/block comment/);
    expect(() => minifyGlslChunk('a = "\\n";')).toThrow(/backslash/);
  });
});
