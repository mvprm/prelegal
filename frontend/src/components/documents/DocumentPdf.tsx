import { Document, Link, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Block, Inline, ListItem } from "@/lib/documents/document";

// This module pulls in @react-pdf/renderer, so it is imported on demand when the user
// downloads, keeping it out of the page's initial bundle.

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 60, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.45 },
  block: { marginBottom: 6 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 8 },
  h2: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 4 },
  h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 4 },
  strong: { fontFamily: "Helvetica-Bold" },
  emphasis: { fontFamily: "Helvetica-Oblique" },
  link: { color: "#1d4ed8", textDecoration: "underline" },
  term: { backgroundColor: "#fef3c7" },
  listItem: { flexDirection: "row", marginBottom: 4 },
  listMarker: { width: 18 },
  listBody: { flex: 1 },
  checkbox: {
    width: 9,
    height: 9,
    marginTop: 2.5,
    marginRight: 9,
    borderWidth: 0.75,
    borderColor: "#404040",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1.2,
  },
  table: { borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: "#a3a3a3", marginVertical: 6 },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: "#a3a3a3", padding: 4, minHeight: 22 },
});

const COLUMN_WIDTHS = ["30%", "35%", "35%"];

/** Renders each part (e.g. the cover page and the standard terms) starting on a new page. */
function PdfDocument({ title, parts }: { title: string; parts: Block[][] }) {
  return (
    <Document title={title} creator="Prelegal" producer="Prelegal">
      {parts.map((blocks, i) => (
        <Page key={i} size="LETTER" style={styles.page}>
          {blocks.map((block, j) => (
            <PdfBlock key={j} block={block} />
          ))}
        </Page>
      ))}
    </Document>
  );
}

function PdfBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const style = block.depth === 1 ? styles.h1 : block.depth === 2 ? styles.h2 : styles.h3;
      return <Text style={style}>{renderInlines(block.children)}</Text>;
    }
    case "paragraph":
      return <Text style={styles.block}>{renderInlines(block.children)}</Text>;
    case "list":
      return (
        <View style={styles.block}>
          {block.items.map((item, i) => (
            // Keep each clause on one page so its number never strands at a page bottom.
            // A whole section (a clause with sub-clauses) can be longer than a page, so it may break.
            <View key={i} style={styles.listItem} wrap={item.children.some((child) => child.type === "list")}>
              {item.checked !== null ? (
                <Text style={styles.checkbox}>{item.checked ? "X" : ""}</Text>
              ) : (
                <Text style={styles.listMarker}>{block.ordered ? `${block.start + i}.` : "•"}</Text>
              )}
              <View style={styles.listBody}>{renderItem(item)}</View>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View style={styles.table} wrap={false}>
          {[block.header, ...block.rows].map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((cell, c) => (
                <Text
                  key={c}
                  style={[
                    styles.cell,
                    { width: COLUMN_WIDTHS[c] },
                    r === 0 || c === 0 ? styles.strong : {},
                    r === 0 && c > 0 ? { textAlign: "center" } : {},
                  ]}
                >
                  {renderInlines(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
  }
}

function renderItem(item: ListItem) {
  return item.children.map((block, i) =>
    // Paragraphs inside list items carry their own spacing from the list item.
    block.type === "paragraph" ? (
      <Text key={i}>{renderInlines(block.children)}</Text>
    ) : (
      <PdfBlock key={i} block={block} />
    ),
  );
}

function renderInlines(inlines: Inline[]): React.ReactNode {
  return inlines.map((inline, i) => {
    switch (inline.type) {
      case "text":
        return inline.value;
      case "break":
        return "\n";
      case "strong":
        return <Text key={i} style={styles.strong}>{renderInlines(inline.children)}</Text>;
      case "emphasis":
        return <Text key={i} style={styles.emphasis}>{renderInlines(inline.children)}</Text>;
      case "link":
        return (
          <Link key={i} src={inline.url} style={styles.link}>
            {renderInlines(inline.children)}
          </Link>
        );
      case "term":
        return <Text key={i} style={styles.term}>{renderInlines(inline.children)}</Text>;
    }
  });
}

export function renderDocumentPdf(title: string, parts: Block[][]): Promise<Blob> {
  return pdf(<PdfDocument title={title} parts={parts} />).toBlob();
}
