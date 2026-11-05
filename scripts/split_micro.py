"""Split each book into contiguous, balanced micro-chapters (~600 words, ~4-5 min read)."""
import json, sys
books = json.load(open(sys.argv[1]))
TARGET = 600
out = []
for bk in books:
    secs = bk["sections"]; w = [s["words"] for s in secs]
    total = sum(w); k = max(1, round(total / TARGET)); n = len(secs)
    pre = [0]
    for x in w: pre.append(pre[-1] + x)
    ideal = total / k
    INF = float("inf")
    # dp[j][i]: min cost to split first i sections into j groups
    dp = [[INF] * (n + 1) for _ in range(k + 1)]; cut = [[0] * (n + 1) for _ in range(k + 1)]
    dp[0][0] = 0
    for j in range(1, k + 1):
        for i in range(1, n + 1):
            for p in range(j - 1, i):
                c = dp[j - 1][p] + (pre[i] - pre[p] - ideal) ** 2
                if c < dp[j][i]: dp[j][i], cut[j][i] = c, p
    bounds, i = [], n
    for j in range(k, 0, -1):
        p = cut[j][i]; bounds.append((p, i)); i = p
    bounds.reverse()
    out.append({"book": bk["book"], "footer": bk["footer"],
                "micros": [{"sections": secs[a:b], "words": pre[b] - pre[a]} for a, b in bounds]})
json.dump(out, open(sys.argv[2], "w"), indent=1, ensure_ascii=False)
for b in out:
    print(b["book"], len(b["micros"]), [m["words"] for m in b["micros"]])
print("total", sum(len(b["micros"]) for b in out))
