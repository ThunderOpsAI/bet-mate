import re
with open("apps/web/app/components/BlackbookRuleBuilderSheet.tsx", "r") as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    line_stripped = re.sub(r'\{/\*.*?\*/\}', '', line) # remove jsx comments
    # find all opening and closing divs
    for match in re.finditer(r'<(div|motion\.div)[^>]*>|<\/(div|motion\.div)>|<(div|motion\.div)[^>]*\/>', line_stripped):
        tag = match.group(0)
        if tag.startswith("</"):
            if not stack:
                print(f"Unmatched closing tag at line {i+1}: {tag}")
            else:
                top = stack.pop()
                expected = "</" + top.split()[0][1:] + ">"
                if not expected.startswith("</div") and tag.startswith("</div"):
                     print(f"Mismatch at line {i+1}: expected {expected}, got {tag}")
        elif not tag.endswith("/>"):
            stack.append(tag)

if stack:
    print(f"Unclosed tags: {len(stack)}")
