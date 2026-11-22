import type { ReactNode } from 'react';

/**
 * A small Markdown renderer for the changelog (ADR-061): headings, paragraphs,
 * nested bullet lists, and inline code, bold and links. That is all
 * Changesets writes; anything else renders as plain text.
 */

function inline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > last) parts.push(text.slice(last, at));
    const id = `${key}-${String(index++)}`;
    if (match[1] !== undefined) parts.push(<code key={id}>{match[1]}</code>);
    else if (match[2] !== undefined) parts.push(<strong key={id}>{match[2]}</strong>);
    else if (match[3] !== undefined && match[4] !== undefined) {
      parts.push(
        <a key={id} href={match[4]} rel="noopener">
          {match[3]}
        </a>,
      );
    }
    last = at + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

interface Item {
  text: string;
  children: Item[];
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: Item[] };

const BULLET = /^(\s*)[-*] (.*)$/;

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  // Open list items by indentation, innermost last.
  let stack: { indent: number; item: Item }[] = [];
  let list: Item[] | null = null;
  const endParagraph = (): void => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const endList = (): void => {
    list = null;
    stack = [];
  };
  for (const line of lines) {
    const heading = /^(#{1,4}) (.*)$/.exec(line);
    const bullet = BULLET.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      endParagraph();
      endList();
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
    } else if (bullet?.[1] !== undefined && bullet[2] !== undefined) {
      endParagraph();
      const indent = bullet[1].length;
      const item: Item = { text: bullet[2], children: [] };
      while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop();
      const parent = stack.at(-1);
      if (parent) parent.item.children.push(item);
      else {
        if (!list) {
          list = [];
          blocks.push({ kind: 'list', items: list });
        }
        list.push(item);
      }
      stack.push({ indent, item });
    } else if (line.trim() === '') {
      endParagraph();
    } else if (stack.length > 0 && /^\s+/.test(line)) {
      // A continuation line of the open list item.
      const open = stack.at(-1);
      if (open) open.item.text += ` ${line.trim()}`;
    } else {
      endList();
      paragraph.push(line.trim());
    }
  }
  endParagraph();
  return blocks;
}

function renderItems(items: readonly Item[], key: string): ReactNode {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={`${key}-${String(i)}`}>
          {inline(item.text, `${key}-${String(i)}`)}
          {item.children.length > 0 ? renderItems(item.children, `${key}-${String(i)}`) : null}
        </li>
      ))}
    </ul>
  );
}

/** The Markdown as React nodes; headings are shifted down by `shift` levels. */
export function Markdown({ source, shift = 0 }: { source: string; shift?: number }): ReactNode {
  return parse(source).map((block, i) => {
    const key = `b${String(i)}`;
    if (block.kind === 'heading') {
      const level = Math.min(6, block.level + shift);
      const Tag = `h${String(level)}` as 'h2';
      return <Tag key={key}>{inline(block.text, key)}</Tag>;
    }
    if (block.kind === 'paragraph') return <p key={key}>{inline(block.text, key)}</p>;
    return <div key={key}>{renderItems(block.items, key)}</div>;
  });
}
