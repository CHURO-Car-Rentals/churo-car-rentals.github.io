"""Stamp ?v=YYYYMMDDHHMM on the site's CSS/JS links and module imports so browsers load fresh files
after every update (GitHub Pages lets browsers reuse cached copies otherwise). Run before each push.
Usage: python3 tools/bump_version.py"""
import datetime, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = datetime.datetime.now().strftime("%Y%m%d%H%M")
FILES = ["index.html", "renter-quiz/index.html", "renter-quiz/verify.html", "renter-quiz/quiz.js", "renter-quiz/common.js"]
# local css/js references: src="js/app.js", href="quiz.css", import ... from "./common.js", import("./config.js")
pat = re.compile(r'((?:src|href)="(?![a-z]+:|//|#|\.\./)[^"?]+\.(?:css|js)|from "\./[^"?]+\.js|import\("\./[^"?]+\.js)(\?v=\d+)?"')
for f in FILES:
    p = os.path.join(ROOT, f); s = open(p).read()
    s2 = pat.sub(lambda m: f'{m.group(1)}?v={v}"', s)
    open(p, "w").write(s2)
    print(f, len(pat.findall(s)), "references")
print("version", v)
