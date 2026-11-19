import type { ReactNode } from "react";

const KEYWORDS = new Set(
  "select from where group by order having limit join left right inner outer full on as and or not in is null with distinct case when then else end asc desc union all filter over partition interval date true false using between like ilike cross lateral".split(
    " ",
  ),
);

/** Tiny SQL highlighter: keywords, functions, strings, numbers, comments. */
export function highlightSql(sql: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re =
    /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|(\b[a-z_][a-z0-9_]*\b)(?=\s*\()|(\b[a-z_][a-z0-9_]*\b)|(\s+|.)/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(sql))) {
    const [tok, com, str, num, fn, word] = m;
    const k = i++;
    if (com)
      out.push(
        <span key={k} className="sql-com">
          {com}
        </span>,
      );
    else if (str)
      out.push(
        <span key={k} className="sql-str">
          {str}
        </span>,
      );
    else if (num)
      out.push(
        <span key={k} className="sql-num">
          {num}
        </span>,
      );
    else if (fn)
      out.push(
        <span key={k} className={KEYWORDS.has(fn.toLowerCase()) ? "sql-kw" : "sql-fn"}>
          {fn}
        </span>,
      );
    else if (word && KEYWORDS.has(word.toLowerCase()))
      out.push(
        <span key={k} className="sql-kw">
          {word}
        </span>,
      );
    else out.push(tok);
  }
  return out;
}

export function SqlBlock({ sql, className = "" }: { sql: string; className?: string }) {
  return (
    <pre
      className={`overflow-x-auto whitespace-pre font-mono text-[12.5px] leading-relaxed text-ink-2 ${className}`}
    >
      <code>{highlightSql(sql)}</code>
    </pre>
  );
}
