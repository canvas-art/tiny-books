"""Parse Project Gutenberg #2680 (Meditations) into books -> numbered sections."""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding="utf-8").read().replace("\r\n", "\n").split("\n")
ORD = ["FIRST","SECOND","THIRD","FOURTH","FIFTH","SIXTH","SEVENTH","EIGHTH","NINTH","TENTH","ELEVENTH","TWELFTH"]
starts = []
for i, l in enumerate(lines):
    m = re.fullmatch(r"THE (\w+) BOOK", l.strip())
    if m and m.group(1) in ORD:
        starts.append(i)
end = next(i for i, l in enumerate(lines) if i > starts[-1] and l.strip() == "APPENDIX")
starts.append(end)
books = []
for b in range(12):
    body = "\n".join(lines[starts[b] + 1:starts[b + 1]])
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", body)]
    paras = [p for p in paras if p]
    sections, footer = [], None
    for p in paras:
        m = re.match(r"^([IVXLC]+)\. (.*)$", p)
        if m:
            sections.append({"n": m.group(1), "paras": [m.group(2)]})
        elif re.fullmatch(r"_.*_", p):
            footer = p.strip("_")
        elif sections:
            sections[-1]["paras"].append(p)
    for s in sections:
        s["paras"] = [re.sub(r"_([^_]+)_", r"\1", x) for x in s["paras"]]
        s["words"] = sum(len(x.split()) for x in s["paras"])
    books.append({"book": b + 1, "sections": sections, "footer": footer})
json.dump(books, open(out, "w"), indent=1, ensure_ascii=False)
for bk in books:
    print(bk["book"], len(bk["sections"]), sum(s["words"] for s in bk["sections"]), bk["footer"])
