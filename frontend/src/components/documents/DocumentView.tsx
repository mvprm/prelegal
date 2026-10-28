import type { Block, Inline, ListItem } from "@/lib/documents/document";

/** Renders a parsed agreement as HTML, styled like a printed page. */
export function DocumentView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3 text-[0.9rem] leading-relaxed">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Heading depth={block.depth}>{renderInlines(block.children)}</Heading>;
    case "paragraph":
      return <p>{renderInlines(block.children)}</p>;
    case "list":
      return <List ordered={block.ordered} start={block.start} items={block.items} />;
    case "table":
      return (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {block.header.map((cell, i) => (
                <th key={i} className="border border-neutral-300 px-2 py-1.5 font-semibold">
                  {renderInlines(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`border border-neutral-300 px-2 py-1.5 align-top ${c === 0 ? "font-medium" : ""}`}
                  >
                    {renderInlines(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

function Heading({ depth, children }: { depth: number; children: React.ReactNode }) {
  if (depth === 1) return <h1 className="pb-2 text-center text-xl font-bold">{children}</h1>;
  if (depth === 2) return <h2 className="pt-2 text-sm font-bold tracking-wide">{children}</h2>;
  return <h3 className="pt-2 font-semibold">{children}</h3>;
}

function List({ ordered, start, items }: { ordered: boolean; start: number; items: ListItem[] }) {
  if (items.every((item) => item.checked !== null)) {
    return (
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span
              role="img"
              aria-label={item.checked ? "Selected" : "Not selected"}
              className="mt-1 flex size-3.5 shrink-0 items-center justify-center border border-neutral-500 text-[0.6rem] leading-none font-bold"
            >
              {item.checked ? "X" : ""}
            </span>
            <div>{renderItem(item)}</div>
          </li>
        ))}
      </ul>
    );
  }
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      start={ordered ? start : undefined}
      className={`space-y-3 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}
    >
      {items.map((item, i) => (
        <li key={i}>{renderItem(item)}</li>
      ))}
    </Tag>
  );
}

function renderItem(item: ListItem) {
  // Tight list items hold a single paragraph; render it inline to avoid extra spacing.
  const [first] = item.children;
  if (item.children.length === 1 && first.type === "paragraph") {
    return renderInlines(first.children);
  }
  return <DocumentView blocks={item.children} />;
}

function renderInlines(inlines: Inline[]): React.ReactNode {
  return inlines.map((inline, i) => {
    switch (inline.type) {
      case "text":
        return inline.value;
      case "break":
        return <br key={i} />;
      case "strong":
        return <strong key={i}>{renderInlines(inline.children)}</strong>;
      case "emphasis":
        return <em key={i}>{renderInlines(inline.children)}</em>;
      case "link":
        return (
          <a key={i} href={inline.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            {renderInlines(inline.children)}
          </a>
        );
      case "term":
        return (
          <span key={i} className="rounded-sm bg-amber-100 px-0.5">
            {renderInlines(inline.children)}
          </span>
        );
    }
  });
}
